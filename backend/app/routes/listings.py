from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import ProduceListing, User, MarketPriceReference, OrderItem, Order
from app.schemas.schemas import ListingCreate, ListingUpdate, ListingStatusUpdate, ListingResponse, PriceBenchmarkResponse
from app.api.deps import get_current_user, require_farmer

router = APIRouter(prefix="/listings", tags=["Produce Marketplace & Listings"])

def attach_reference_price(listing: ProduceListing, resp: ListingResponse, db: Session):
    ref = db.query(MarketPriceReference).filter(
        MarketPriceReference.crop_name.ilike(f"%{listing.crop_name}%")
    ).first()
    if ref:
        resp.market_price_reference = PriceBenchmarkResponse.model_validate(ref)
    return resp

@router.get("", response_model=List[ListingResponse])
def get_listings(
    crop_name: Optional[str] = Query(None, description="Filter by crop name or keyword"),
    category: Optional[str] = Query(None, description="Filter by category (Vegetables, Fruits, Spices, Grains)"),
    district: Optional[str] = Query(None, description="Filter by district"),
    taluk: Optional[str] = Query(None, description="Filter by taluk"),
    min_quantity: Optional[float] = Query(None, ge=0, description="Minimum available quantity required"),
    min_price: Optional[float] = Query(None, ge=0, description="Minimum asking price"),
    max_price: Optional[float] = Query(None, ge=0, description="Maximum asking price"),
    organic_only: Optional[bool] = Query(None, description="Filter for certified organic produce only"),
    status_filter: Optional[str] = Query("active", alias="status", description="Filter by listing status (default: active)"),
    db: Session = Depends(get_db)
):
    query = db.query(ProduceListing)

    if status_filter and status_filter != "all":
        query = query.filter(ProduceListing.status == status_filter)
    if crop_name:
        query = query.filter(
            (ProduceListing.crop_name.ilike(f"%{crop_name}%")) |
            (ProduceListing.crop_kannada.ilike(f"%{crop_name}%"))
        )
    if category and category != "all":
        query = query.filter(ProduceListing.category == category)
    if district and district != "all":
        query = query.filter(ProduceListing.district == district)
    if taluk and taluk != "all":
        query = query.filter(ProduceListing.taluk == taluk)
    if min_quantity is not None:
        query = query.filter(ProduceListing.available_quantity >= min_quantity)
    if min_price is not None:
        query = query.filter(ProduceListing.price_per_unit >= min_price)
    if max_price is not None:
        query = query.filter(ProduceListing.price_per_unit <= max_price)
    if organic_only:
        query = query.filter(ProduceListing.organic_certified == True)

    listings = query.order_by(ProduceListing.created_at.desc()).all()
    results = []
    for l in listings:
        resp = ListingResponse.model_validate(l)
        if l.farmer:
            resp.farmer_name = l.farmer.full_name
        attach_reference_price(l, resp, db)
        results.append(resp)
    return results

@router.get("/mine", response_model=List[ListingResponse])
def get_my_listings(
    current_user: User = Depends(require_farmer),
    db: Session = Depends(get_db)
):
    """Retrieve all listings owned by the logged-in farmer regardless of status."""
    listings = (
        db.query(ProduceListing)
        .filter(ProduceListing.farmer_id == current_user.id)
        .order_by(ProduceListing.created_at.desc())
        .all()
    )
    results = []
    for l in listings:
        resp = ListingResponse.model_validate(l)
        resp.farmer_name = current_user.full_name
        attach_reference_price(l, resp, db)
        results.append(resp)
    return results

@router.post("", response_model=ListingResponse, status_code=status.HTTP_201_CREATED)
def create_produce_listing(
    payload: ListingCreate,
    current_user: User = Depends(require_farmer),
    db: Session = Depends(get_db)
):
    """Create a new farmer produce listing."""
    listing = ProduceListing(
        farmer_id=current_user.id,
        farm_id=payload.farm_id,
        crop_name=payload.crop_name,
        crop_kannada=payload.crop_kannada,
        variety=payload.variety,
        category=payload.category,
        total_quantity=payload.total_quantity,
        available_quantity=payload.total_quantity,
        unit=payload.unit,
        minimum_order_quantity=payload.minimum_order_quantity,
        price_per_unit=payload.price_per_unit,
        quality_grade=payload.quality_grade,
        quality_notes=payload.quality_notes,
        organic_certified=payload.organic_certified,
        harvest_date=payload.harvest_date,
        sale_deadline=payload.sale_deadline,
        shelf_life_days=payload.shelf_life_days,
        district=payload.district,
        taluk=payload.taluk,
        allow_group_pooling=payload.allow_group_pooling,
        ai_suggested_price=payload.ai_suggested_price,
        created_via_voice=payload.created_via_voice,
        voice_transcript_kannada=payload.voice_transcript_kannada,
        status=payload.status or "active"
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)

    resp = ListingResponse.model_validate(listing)
    resp.farmer_name = current_user.full_name
    attach_reference_price(listing, resp, db)
    return resp

@router.get("/{listing_id}", response_model=ListingResponse)
def get_listing_by_id(listing_id: str, db: Session = Depends(get_db)):
    """Retrieve full details of a specific produce listing, including reference benchmark pricing."""
    listing = db.query(ProduceListing).filter(ProduceListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produce listing not found")
    resp = ListingResponse.model_validate(listing)
    if listing.farmer:
        resp.farmer_name = listing.farmer.full_name
    attach_reference_price(listing, resp, db)
    return resp

@router.put("/{listing_id}", response_model=ListingResponse)
def update_produce_listing(
    listing_id: str,
    payload: ListingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Edit an existing listing. Only the owning farmer or admin can edit."""
    listing = db.query(ProduceListing).filter(ProduceListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produce listing not found")

    if listing.farmer_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to edit this listing.")

    update_data = payload.model_dump(exclude_unset=True)

    # Validate quantities
    if "total_quantity" in update_data and update_data["total_quantity"] is not None:
        new_total = update_data["total_quantity"]
        # adjust available_quantity proportionately or ensure non-negative
        sold_quantity = listing.total_quantity - listing.available_quantity
        if new_total < sold_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reduce total quantity below already sold quantity ({sold_quantity} {listing.unit})."
            )
        listing.available_quantity = new_total - sold_quantity
        listing.total_quantity = new_total
        del update_data["total_quantity"]
        if "available_quantity" in update_data:
            del update_data["available_quantity"]

    for field, val in update_data.items():
        setattr(listing, field, val)

    listing.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(listing)

    resp = ListingResponse.model_validate(listing)
    if listing.farmer:
        resp.farmer_name = listing.farmer.full_name
    attach_reference_price(listing, resp, db)
    return resp

@router.patch("/{listing_id}/status", response_model=ListingResponse)
def update_listing_status(
    listing_id: str,
    payload: ListingStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Publish, pause, or archive a listing."""
    listing = db.query(ProduceListing).filter(ProduceListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produce listing not found")

    if listing.farmer_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to modify this listing.")

    listing.status = payload.status
    listing.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(listing)

    resp = ListingResponse.model_validate(listing)
    if listing.farmer:
        resp.farmer_name = listing.farmer.full_name
    attach_reference_price(listing, resp, db)
    return resp

@router.delete("/{listing_id}", status_code=status.HTTP_200_OK)
def delete_produce_listing(
    listing_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a listing. If active orders reference it, the listing is archived instead."""
    listing = db.query(ProduceListing).filter(ProduceListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produce listing not found")

    if listing.farmer_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to remove this listing.")

    # Check for active unresolved orders
    active_orders = (
        db.query(Order)
        .join(OrderItem, Order.id == OrderItem.order_id)
        .filter(
            OrderItem.listing_id == listing_id,
            Order.order_status.in_(["created", "confirmed", "escrow_funded", "in_transit"])
        )
        .count()
    )

    if active_orders > 0:
        # Soft delete by archiving to protect ongoing order transactions
        listing.status = "archived"
        db.commit()
        return {"message": "Listing has ongoing active orders; status updated to archived for audit integrity."}

    db.delete(listing)
    db.commit()
    return {"message": "Listing deleted successfully."}
