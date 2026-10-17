from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import MarketPriceReference
from app.schemas.schemas import (
    PriceBenchmarkResponse,
    PriceComparisonRequest,
    PriceComparisonResponse,
)
from app.services.ai_service import ai_service

router = APIRouter(prefix="/pricing", tags=["AI Price Assistant & Mandi Benchmarks"])

# Regional Mandi seeds for initial state if DB is empty
SEED_PRICES = [
    {
        "crop_name": "Arecanut (Chali)",
        "variety": "Chali Supari",
        "district": "Dakshina Kannada",
        "market_yard": "APMC Bantwal & CAMPCO",
        "min_price": 420.0,
        "modal_price": 452.0,
        "max_price": 478.0,
        "unit": "kg",
        "data_source": "Karnataka State Agricultural Marketing Board (KSAMB)",
        "is_demonstration_data": True,
    },
    {
        "crop_name": "Udupi Mattu Gulla",
        "variety": "GI Green Brinjal",
        "district": "Udupi",
        "market_yard": "Udupi Kissan Mandi",
        "min_price": 50.0,
        "modal_price": 62.0,
        "max_price": 75.0,
        "unit": "kg",
        "data_source": "Udupi Mattu Gulla Belegarara Sangha",
        "is_demonstration_data": True,
    },
    {
        "crop_name": "Black Pepper",
        "variety": "Panniyur-1 Bold",
        "district": "Dakshina Kannada",
        "market_yard": "APMC Puttur Yard",
        "min_price": 580.0,
        "modal_price": 615.0,
        "max_price": 640.0,
        "unit": "kg",
        "data_source": "Spices Board Regional Bulletin",
        "is_demonstration_data": True,
    },
    {
        "crop_name": "Coconut",
        "variety": "West Coast Tall",
        "district": "Dakshina Kannada",
        "market_yard": "Mangalore Bunder Wholesale",
        "min_price": 18.0,
        "modal_price": 22.0,
        "max_price": 26.0,
        "unit": "nut",
        "data_source": "Coconut Development Board",
        "is_demonstration_data": True,
    },
    {
        "crop_name": "Shankarpura Mallige",
        "variety": "GI Coastal Jasmine",
        "district": "Udupi",
        "market_yard": "Shankarpura Jasmine Exchange",
        "min_price": 620.0,
        "modal_price": 780.0,
        "max_price": 950.0,
        "unit": "atte",
        "data_source": "Mallige Growers Association",
        "is_demonstration_data": True,
    },
    {
        "crop_name": "Tomato",
        "variety": "Local Hybrid",
        "district": "Dakshina Kannada",
        "market_yard": "APMC Mangaluru Wholesale",
        "min_price": 24.0,
        "modal_price": 28.0,
        "max_price": 32.0,
        "unit": "kg",
        "data_source": "KSAMB Daily Mandi Bulletin",
        "is_demonstration_data": True,
    },
]


def _seed_benchmarks_if_needed(db: Session):
    count = db.query(MarketPriceReference).count()
    if count == 0:
        for item in SEED_PRICES:
            record = MarketPriceReference(
                crop_name=item["crop_name"],
                variety=item["variety"],
                district=item["district"],
                market_yard=item["market_yard"],
                min_price=item["min_price"],
                modal_price=item["modal_price"],
                max_price=item["max_price"],
                unit=item["unit"],
                data_source=item["data_source"],
                is_demonstration_data=item["is_demonstration_data"],
                as_of_date=datetime.now(timezone.utc),
            )
            db.add(record)
        db.commit()


@router.get("/benchmark", response_model=List[PriceBenchmarkResponse])
def get_price_benchmarks(
    crop_name: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Retrieve official Mandi benchmark price references clearly labeled with market yard, source and date."""
    _seed_benchmarks_if_needed(db)
    query = db.query(MarketPriceReference)
    if crop_name:
        query = query.filter(MarketPriceReference.crop_name.ilike(f"%{crop_name}%"))
    if district and district != "all":
        query = query.filter(MarketPriceReference.district == district)

    results = query.order_by(MarketPriceReference.crop_name.asc()).all()
    return [PriceBenchmarkResponse.model_validate(r) for r in results]


@router.post("/compare", response_model=PriceComparisonResponse)
async def compare_farmer_price(
    payload: PriceComparisonRequest,
    db: Session = Depends(get_db),
):
    """
    AI Price Assistant:
    1. Compare farmer's asking price with suitable reference data in DB.
    2. Deterministically calculate difference and percentage in backend code.
    3. Display market yard, source, observation date, unit and data limitations.
    4. Provide simple, prudent AI explanation without fabricating prices or promising guaranteed profits.
    5. Explicitly state when reference data is unavailable.
    """
    _seed_benchmarks_if_needed(db)

    # Search for matching benchmark
    clean_crop = payload.crop_name.strip().lower()
    benchmarks = db.query(MarketPriceReference).all()

    matched_ref: Optional[MarketPriceReference] = None
    for b in benchmarks:
        b_name = b.crop_name.lower()
        if (
            clean_crop in b_name
            or b_name in clean_crop
            or clean_crop.rstrip("s").rstrip("es") in b_name
        ):
            if b.unit.lower().strip() == payload.unit.lower().strip():
                matched_ref = b
                break

    district = payload.district or "Dakshina Kannada"
    taluk = payload.taluk or "Bantwal"

    if not matched_ref:
        explanation = await ai_service.explain_price_comparison(
            crop_name=payload.crop_name,
            asking_price=payload.asking_price,
            unit=payload.unit,
            district=district,
            taluk=taluk,
            reference_data=None,
            difference=None,
            pct_difference=None,
        )
        return PriceComparisonResponse(
            crop_name=payload.crop_name,
            asking_price=payload.asking_price,
            unit=payload.unit,
            district=district,
            taluk=taluk,
            has_reference_data=False,
            position_relative_to_mandi="no_reference_data",
            ai_explanation=explanation,
            disclaimer=(
                "Data Limitation Notice: No official APMC Mandi price benchmark currently exists in the database "
                f"for {payload.crop_name} in {district}. FarmConnect AI will never fabricate market rates. "
                "Verify local physical arrivals at the nearest APMC yard before selling."
            ),
        )

    # DETERMINISTIC CALCULATION (Do NOT rely on LLM for arithmetic!)
    diff = round(payload.asking_price - matched_ref.modal_price, 2)
    pct_diff = round(((payload.asking_price - matched_ref.modal_price) / matched_ref.modal_price) * 100, 2)

    if diff > 1.0:
        position = "above_modal_rate"
    elif diff < -1.0:
        position = "below_modal_rate"
    else:
        position = "at_market_modal_rate"

    ref_dict = {
        "modal_price": matched_ref.modal_price,
        "min_price": matched_ref.min_price,
        "max_price": matched_ref.max_price,
        "market_yard": matched_ref.market_yard,
        "data_source": matched_ref.data_source,
        "as_of_date": matched_ref.as_of_date.strftime("%Y-%m-%d"),
    }

    explanation = await ai_service.explain_price_comparison(
        crop_name=payload.crop_name,
        asking_price=payload.asking_price,
        unit=payload.unit,
        district=district,
        taluk=taluk,
        reference_data=ref_dict,
        difference=diff,
        pct_difference=pct_diff,
    )

    demo_badge = " [Demonstration Dataset]" if matched_ref.is_demonstration_data else ""

    return PriceComparisonResponse(
        crop_name=payload.crop_name,
        asking_price=payload.asking_price,
        unit=payload.unit,
        district=district,
        taluk=taluk,
        has_reference_data=True,
        reference_modal_price=matched_ref.modal_price,
        reference_min_price=matched_ref.min_price,
        reference_max_price=matched_ref.max_price,
        reference_market_yard=matched_ref.market_yard,
        reference_source=f"{matched_ref.data_source}{demo_badge}",
        observation_date=matched_ref.as_of_date.strftime("%Y-%m-%d"),
        difference=diff,
        percentage_difference=pct_diff,
        position_relative_to_mandi=position,
        ai_explanation=explanation,
        disclaimer=(
            "Reference Data Notice: APMC Mandi rates reflect wholesale auction modal prices recorded at "
            f"{matched_ref.market_yard} ({matched_ref.data_source}). They are independent benchmarks separate from "
            "farmers' direct asking prices and do not guarantee final buyer transaction amounts."
        ),
    )
