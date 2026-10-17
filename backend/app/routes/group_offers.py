import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import (
    GroupOffer,
    OfferContribution,
    ProduceListing,
    Order,
    OrderItem,
    OrderEvent,
    User,
    OrderAgreementVersion,
    BlockchainTxReference,
)
from app.schemas.schemas import (
    GroupMatchRequest,
    GroupMatchResponse,
    ProposedContribution,
    GroupOfferCreate,
    GroupOfferResponse,
    ContributionCreate,
    ContributionResponse,
    OrderResponse,
)
from app.api.deps import get_current_user, require_buyer, require_farmer
from app.services.blockchain_service import blockchain_service

router = APIRouter(prefix="/group-offers", tags=["Smart Group Selling"])


def _is_crop_compatible(listing_crop: str, target_crop: str) -> bool:
    l_c = listing_crop.lower().strip()
    t_c = target_crop.lower().strip()
    if l_c == t_c:
        return True
    l_stem = l_c.rstrip("es").rstrip("s")
    t_stem = t_c.rstrip("es").rstrip("s")
    if l_stem and t_stem and (l_stem == t_stem or l_stem in t_stem or t_stem in l_stem):
        return True
    return t_c in l_c or l_c in t_c


def _calculate_location_score(listing: ProduceListing, target_taluk: Optional[str], target_district: Optional[str]) -> int:
    score = 0
    if target_taluk and target_taluk.lower() not in ["all", "all taluks"]:
        if listing.taluk.lower() == target_taluk.lower():
            score -= 100
    if target_district and target_district.lower() not in ["all", "all districts"]:
        if listing.district.lower() == target_district.lower():
            score -= 50
    return score


def run_deterministic_group_matcher(db: Session, req: GroupMatchRequest) -> GroupMatchResponse:
    """
    Deterministic matching algorithm:
    1. Filter active, pooling-enabled listings with stock > 0 matching unit & crop identity.
    2. Apply quality constraints (organic, grade, max price).
    3. Order deterministically by location proximity, price ascending, and listing age.
    4. Greedily aggregate lots up to target_quantity.
    5. Formulate transparent matching explanation and weighted unit price.
    """
    query = (
        db.query(ProduceListing)
        .filter(
            ProduceListing.status == "active",
            ProduceListing.allow_group_pooling == True,
            ProduceListing.available_quantity > 0,
        )
    )

    listings = query.all()

    # Filter in memory for crop name & constraints
    compatible: List[ProduceListing] = []
    for l in listings:
        if not _is_crop_compatible(l.crop_name, req.crop_name):
            continue
        if l.unit.lower().strip() != req.unit.lower().strip():
            continue
        if req.organic_only and not l.organic_certified:
            continue
        if req.quality_grade and req.quality_grade.lower() not in ["all", "any"]:
            if l.quality_grade.lower() != req.quality_grade.lower():
                continue
        if req.max_unit_price is not None and l.price_per_unit > req.max_unit_price:
            continue
        compatible.append(l)

    # Deterministic sorting
    compatible.sort(
        key=lambda l: (
            _calculate_location_score(l, req.taluk, req.district),
            l.price_per_unit,
            l.created_at or datetime.min,
            l.id,
        )
    )

    remaining_needed = round(req.target_quantity, 2)
    contributions: List[ProposedContribution] = []
    total_matched = 0.0
    total_cost = 0.0

    for l in compatible:
        if remaining_needed <= 0:
            break
        take_qty = round(min(remaining_needed, l.available_quantity), 2)
        if take_qty <= 0:
            continue

        subtotal = round(take_qty * l.price_per_unit, 2)
        farmer_name = l.farmer.full_name if l.farmer else f"Farmer {l.farmer_id[:6]}"
        location = f"{l.taluk}, {l.district}"

        contributions.append(
            ProposedContribution(
                farmer_id=l.farmer_id,
                farmer_name=farmer_name,
                farmer_location=location,
                listing_id=l.id,
                crop_name=l.crop_name,
                quantity=take_qty,
                unit=l.unit,
                unit_price=l.price_per_unit,
                subtotal=subtotal,
                quality_grade=l.quality_grade,
                organic_certified=l.organic_certified,
            )
        )
        remaining_needed = round(remaining_needed - take_qty, 2)
        total_matched = round(total_matched + take_qty, 2)
        total_cost = round(total_cost + subtotal, 2)

    shortfall = round(max(0.0, req.target_quantity - total_matched), 2)
    weighted_avg_price = round(total_cost / total_matched, 2) if total_matched > 0 else 0.0

    if total_matched >= req.target_quantity:
        match_status = "full"
        is_achievable = True
        explanation_lines = [
            f"Deterministic match successful: Aggregated {total_matched:.1f} {req.unit} of {req.crop_name} across {len(contributions)} smallholder farmer(s)."
        ]
        breakdowns = [
            f"{c.farmer_name} ({c.farmer_location}): {c.quantity:.1f} {c.unit} @ ₹{c.unit_price:.2f}"
            for c in contributions
        ]
        explanation_lines.append("; ".join(breakdowns))
        explanation_lines.append(
            f"Weighted average price: ₹{weighted_avg_price:.2f}/{req.unit}. Total order value: ₹{total_cost:.2f}."
        )
        explanation = " ".join(explanation_lines)
    elif total_matched > 0:
        match_status = "insufficient_supply"
        is_achievable = False
        breakdowns = [
            f"{c.farmer_name} ({c.farmer_location}): {c.quantity:.1f} {c.unit}"
            for c in contributions
        ]
        explanation = (
            f"Insufficient supply: Requested {req.target_quantity:.1f} {req.unit} of {req.crop_name}, "
            f"but only {total_matched:.1f} {req.unit} is available across {len(contributions)} farmer(s) "
            f"({'; '.join(breakdowns)}). Shortfall of {shortfall:.1f} {req.unit}."
        )
    else:
        match_status = "no_supply"
        is_achievable = False
        explanation = (
            f"No matching active farmer supply found for {req.crop_name} ({req.unit}) "
            f"with group pooling enabled in the designated criteria."
        )

    return GroupMatchResponse(
        match_status=match_status,
        crop_name=req.crop_name,
        target_quantity=req.target_quantity,
        total_matched_quantity=total_matched,
        shortfall_quantity=shortfall,
        unit=req.unit,
        weighted_average_price=weighted_avg_price,
        total_estimated_amount=total_cost,
        is_achievable=is_achievable,
        matching_explanation=explanation,
        contributions=contributions,
    )


def _check_and_expire_offers(db: Session):
    """Automatically release reserved inventory for expired proposed offers."""
    now = datetime.now(timezone.utc)
    expired_offers = (
        db.query(GroupOffer)
        .filter(
            GroupOffer.status == "proposed",
            GroupOffer.expires_at < now,
        )
        .all()
    )
    for off in expired_offers:
        for c in off.contributions:
            if c.status == "reserved" and c.listing_id:
                listing = db.query(ProduceListing).filter(ProduceListing.id == c.listing_id).first()
                if listing:
                    listing.available_quantity = round(listing.available_quantity + c.contributed_quantity, 2)
                    if listing.status == "sold_out":
                        listing.status = "active"
                c.status = "released"
        off.status = "expired"
    if expired_offers:
        db.commit()


@router.post("/match", response_model=GroupMatchResponse)
def match_group_pool(
    payload: GroupMatchRequest,
    db: Session = Depends(get_db),
):
    """
    Simulate and preview deterministic group matching for buyer requirements
    without altering inventory.
    """
    return run_deterministic_group_matcher(db, payload)


@router.post("", response_model=GroupOfferResponse, status_code=status.HTTP_201_CREATED)
def create_group_offer(
    payload: GroupOfferCreate,
    current_user: User = Depends(require_buyer),
    db: Session = Depends(get_db),
):
    """
    Create a combined multi-farmer group offer.
    If matching listings are provided or found, atomically reserves inventory
    using row-level locking (with_for_update).
    If no compatible listings exist yet, creates an open demand pool for farmers to join.
    """
    _check_and_expire_offers(db)

    contributions_to_reserve = payload.contributions
    if not contributions_to_reserve:
        match_req = GroupMatchRequest(
            crop_name=payload.crop_name,
            target_quantity=payload.target_quantity,
            unit=payload.unit,
            taluk=payload.target_taluk if payload.target_taluk != "All Taluks" else None,
        )
        match_res = run_deterministic_group_matcher(db, match_req)
        if match_res.is_achievable and len(match_res.contributions) > 0:
            contributions_to_reserve = match_res.contributions

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=payload.expires_in_minutes)
    offer_id = str(uuid.uuid4())

    # Case A: We have active contributions to reserve
    if contributions_to_reserve:
        reserved_contributions: List[OfferContribution] = []
        total_amount = 0.0
        total_qty = 0.0
        sorted_contribs = sorted(contributions_to_reserve, key=lambda c: c.listing_id)
        explanation_parts = []

        for c in sorted_contribs:
            listing = (
                db.query(ProduceListing)
                .filter(ProduceListing.id == c.listing_id)
                .with_for_update()
                .first()
            )
            if not listing:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Listing {c.listing_id} no longer exists.",
                )
            if listing.status != "active":
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Listing for '{listing.crop_name}' is no longer active (status: {listing.status}).",
                )
            if listing.available_quantity < c.quantity:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Insufficient inventory for {listing.crop_name} from {c.farmer_name}. Available: {listing.available_quantity}, requested: {c.quantity}.",
                )

            # Atomically reserve inventory
            listing.available_quantity = round(listing.available_quantity - c.quantity, 2)
            if listing.available_quantity <= 0:
                listing.status = "sold_out"

            subtotal = round(c.quantity * listing.price_per_unit, 2)
            total_amount = round(total_amount + subtotal, 2)
            total_qty = round(total_qty + c.quantity, 2)

            contrib = OfferContribution(
                group_offer_id=offer_id,
                farmer_id=listing.farmer_id,
                farmer_name=c.farmer_name or (listing.farmer.full_name if listing.farmer else "Farmer"),
                farmer_location=f"{listing.taluk}, {listing.district}",
                listing_id=listing.id,
                contributed_quantity=c.quantity,
                unit_price=listing.price_per_unit,
                subtotal=subtotal,
                farmer_confirmed=False,
                status="reserved",
            )
            reserved_contributions.append(contrib)
            explanation_parts.append(
                f"{contrib.farmer_name} ({contrib.farmer_location}): {contrib.contributed_quantity} {listing.unit} @ ₹{contrib.unit_price:.2f}"
            )

        weighted_unit_price = round(total_amount / total_qty, 2) if total_qty > 0 else (payload.offered_unit_price or 0.0)

        explanation = (
            f"Group Offer #{offer_id[:8]} created: {total_qty:.1f} {payload.unit} aggregated across "
            f"{len(reserved_contributions)} farmers. Contributions: {'; '.join(explanation_parts)}. "
            f"Weighted average price: ₹{weighted_unit_price:.2f}/{payload.unit}. Total value: ₹{total_amount:.2f}."
        )

        offer = GroupOffer(
            id=offer_id,
            buyer_id=current_user.id,
            buyer_name=current_user.full_name,
            crop_name=payload.crop_name,
            variety=payload.variety,
            target_quantity=total_qty,
            current_committed_quantity=total_qty,
            unit=payload.unit,
            offered_unit_price=weighted_unit_price,
            total_amount=total_amount,
            target_taluk=payload.target_taluk,
            aggregation_hub_name=payload.aggregation_hub_name,
            status="proposed",
            matching_explanation=explanation,
            delivery_address=payload.delivery_address,
            delivery_terms=payload.delivery_terms,
            expires_at=expires_at,
        )
        db.add(offer)
        for rc in reserved_contributions:
            db.add(rc)

        db.commit()
        db.refresh(offer)

        resp = GroupOfferResponse.model_validate(offer)
        resp.contributions = [ContributionResponse.model_validate(c) for c in offer.contributions]
        return resp

    # Case B: Open demand pool (no immediate matching supply, open for farmers to join)
    unit_price = payload.offered_unit_price or 0.0
    total_val = round(payload.target_quantity * unit_price, 2)
    explanation = f"Open demand pool for {payload.target_quantity} {payload.unit} of {payload.crop_name} awaiting farmer lot commitments."

    offer = GroupOffer(
        id=offer_id,
        buyer_id=current_user.id,
        buyer_name=current_user.full_name,
        crop_name=payload.crop_name,
        variety=payload.variety,
        target_quantity=payload.target_quantity,
        current_committed_quantity=0.0,
        unit=payload.unit,
        offered_unit_price=unit_price,
        total_amount=total_val,
        target_taluk=payload.target_taluk,
        aggregation_hub_name=payload.aggregation_hub_name,
        status="open",
        matching_explanation=explanation,
        delivery_address=payload.delivery_address,
        delivery_terms=payload.delivery_terms,
        expires_at=expires_at,
    )
    db.add(offer)
    db.commit()
    db.refresh(offer)

    resp = GroupOfferResponse.model_validate(offer)
    resp.contributions = []
    return resp


@router.post("/{offer_id}/contribute", response_model=GroupOfferResponse)
def contribute_to_offer(
    offer_id: str,
    payload: ContributionCreate,
    current_user: User = Depends(require_farmer),
    db: Session = Depends(get_db),
):
    """Farmer contributes their produce lot to an open demand pool."""
    offer = db.query(GroupOffer).filter(GroupOffer.id == offer_id).with_for_update().first()
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group offer not found")

    if offer.status != "open":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot contribute to pool with status '{offer.status}'.",
        )

    # Check for existing contribution from this farmer
    existing = (
        db.query(OfferContribution)
        .filter(
            OfferContribution.group_offer_id == offer_id,
            OfferContribution.farmer_id == current_user.id,
        )
        .first()
    )

    if existing:
        existing.contributed_quantity = round(existing.contributed_quantity + payload.contributed_quantity, 2)
        existing.subtotal = round(existing.contributed_quantity * existing.unit_price, 2)
    else:
        unit_price = offer.offered_unit_price
        subtotal = round(payload.contributed_quantity * unit_price, 2)
        contrib = OfferContribution(
            group_offer_id=offer_id,
            farmer_id=current_user.id,
            farmer_name=current_user.full_name,
            farmer_location=f"{current_user.taluk or 'Local'}, Dakshina Kannada",
            listing_id=payload.listing_id,
            contributed_quantity=payload.contributed_quantity,
            unit_price=unit_price,
            subtotal=subtotal,
            status="committed",
        )
        db.add(contrib)

    offer.current_committed_quantity = round(offer.current_committed_quantity + payload.contributed_quantity, 2)
    if offer.current_committed_quantity >= offer.target_quantity:
        offer.status = "matched"

    db.commit()
    db.refresh(offer)

    resp = GroupOfferResponse.model_validate(offer)
    resp.contributions = [ContributionResponse.model_validate(c) for c in offer.contributions]
    return resp



@router.get("", response_model=List[GroupOfferResponse])
def get_group_offers(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all group offers relevant to the user, auto-checking expiration."""
    _check_and_expire_offers(db)

    query = db.query(GroupOffer)
    if current_user.role == "buyer":
        query = query.filter(GroupOffer.buyer_id == current_user.id)
    elif current_user.role == "farmer":
        # Farmer can see offers they contribute to or all open/proposed offers
        query = query.outerjoin(OfferContribution, GroupOffer.id == OfferContribution.group_offer_id).filter(
            (OfferContribution.farmer_id == current_user.id)
            | (GroupOffer.status.in_(["open", "proposed", "matched"]))
        ).distinct()

    if status_filter:
        query = query.filter(GroupOffer.status == status_filter)

    offers = query.order_by(GroupOffer.created_at.desc()).all()
    results = []
    for off in offers:
        resp = GroupOfferResponse.model_validate(off)
        resp.contributions = [ContributionResponse.model_validate(c) for c in off.contributions]
        results.append(resp)
    return results


@router.get("/farmer/my-contributions", response_model=List[ContributionResponse])
def get_my_group_contributions(
    current_user: User = Depends(require_farmer),
    db: Session = Depends(get_db),
):
    """Retrieve all group pool contributions assigned to the authenticated farmer."""
    contribs = (
        db.query(OfferContribution)
        .filter(OfferContribution.farmer_id == current_user.id)
        .order_by(OfferContribution.contribution_timestamp.desc())
        .all()
    )
    return [ContributionResponse.model_validate(c) for c in contribs]


@router.get("/{offer_id}", response_model=GroupOfferResponse)
def get_group_offer_by_id(
    offer_id: str,
    db: Session = Depends(get_db),
):
    """Get single group offer details with contribution lines."""
    _check_and_expire_offers(db)
    offer = db.query(GroupOffer).filter(GroupOffer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group offer not found")

    resp = GroupOfferResponse.model_validate(offer)
    resp.contributions = [ContributionResponse.model_validate(c) for c in offer.contributions]
    return resp


@router.post("/{offer_id}/accept", response_model=GroupOfferResponse)
def accept_group_offer(
    offer_id: str,
    current_user: User = Depends(require_buyer),
    db: Session = Depends(get_db),
):
    """
    Buyer accepts the proposed group offer.
    Creates a single parent buyer order with linked OrderItem contribution records
    using database transactions and concurrency locking. Prevents duplicate acceptance.
    """
    _check_and_expire_offers(db)

    offer = (
        db.query(GroupOffer)
        .filter(GroupOffer.id == offer_id)
        .with_for_update()
        .first()
    )
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group offer not found")

    if offer.buyer_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the buyer who requested this group pool can accept it.",
        )

    if offer.status in ["accepted", "fulfilled"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This group offer has already been accepted (status: {offer.status}).",
        )

    if offer.status not in ["proposed", "open", "matched"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot accept offer in '{offer.status}' status.",
        )

    now = datetime.now(timezone.utc)
    if offer.expires_at and offer.expires_at.replace(tzinfo=timezone.utc) < now:
        offer.status = "expired"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This group offer has expired. Please run a new match.",
        )

    contributions = offer.contributions
    if not contributions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot accept offer without farmer contributions.",
        )

    primary_seller_id = contributions[0].farmer_id
    seller_summary = f"Smart Pool ({len(contributions)} Farmers: {', '.join([c.farmer_name or 'Farmer' for c in contributions[:3]])})"

    order_id = str(uuid.uuid4())
    order_code = f"GRP-DK-{int(now.timestamp())}-{uuid.uuid4().hex[:6].upper()}"

    delivery_terms = offer.delivery_terms or "Consolidated aggregation at regional APMC hub"
    delivery_address = offer.delivery_address or "Mangaluru Central Distribution Hub"

    canonical_items = [
        {
            "contributing_farmer_id": c.farmer_id,
            "crop_name": offer.crop_name,
            "quantity": c.contributed_quantity,
            "unit": offer.unit,
            "unit_price": c.unit_price,
            "subtotal": c.subtotal,
        }
        for c in contributions
    ]

    canonical_dict, canonical_json, agreement_hash = blockchain_service.canonicalize_order_terms(
        order_id=order_id,
        order_code=order_code,
        buyer_id=current_user.id,
        seller_id=primary_seller_id,
        items=canonical_items,
        delivery_terms=delivery_terms,
        delivery_address=delivery_address,
        total_amount=offer.total_amount,
        agreement_version=1
    )

    on_chain_res = blockchain_service.register_agreement_on_chain(
        order_id=order_id,
        agreement_hash=agreement_hash
    )

    parent_order = Order(
        id=order_id,
        order_code=order_code,
        buyer_id=current_user.id,
        seller_id=primary_seller_id,
        buyer_name=current_user.full_name,
        seller_name=seller_summary,
        is_group_order=True,
        group_offer_id=offer.id,
        total_amount=offer.total_amount,
        order_status="pending",
        delivery_terms=delivery_terms,
        delivery_address=delivery_address,
        farmer_confirmed=False,
        buyer_confirmed=True,
        agreement_hash=agreement_hash,
        blockchain_tx_hash=on_chain_res.get("tx_hash"),
        contract_address=on_chain_res.get("contract_address", blockchain_service.order_registry_address),
        network_identifier=str(on_chain_res.get("network_id", "31337")),
        block_number=on_chain_res.get("block_number"),
        agreement_version=1,
        escrow_status="unfunded",
    )
    db.add(parent_order)

    agreement_ver = OrderAgreementVersion(
        order_id=parent_order.id,
        version=1,
        agreement_hash=agreement_hash,
        canonical_terms_json=canonical_dict,
        on_chain_tx_hash=on_chain_res.get("tx_hash"),
        contract_address=on_chain_res.get("contract_address"),
        network_id=str(on_chain_res.get("network_id", "31337")),
        block_number=on_chain_res.get("block_number"),
        is_current=True,
        terms_summary=f"Smart Group Order for {offer.target_quantity} {offer.unit} of {offer.crop_name} across {len(contributions)} farmers"
    )
    db.add(agreement_ver)

    tx_ref = BlockchainTxReference(
        order_id=parent_order.id,
        contract_name="FarmConnectOrderRegistry",
        contract_address=on_chain_res.get("contract_address", blockchain_service.order_registry_address),
        action_type="registerGroupOrder",
        tx_hash=on_chain_res.get("tx_hash"),
        block_number=on_chain_res.get("block_number"),
        network_id=str(on_chain_res.get("network_id", "31337")),
        status=on_chain_res.get("status", "confirmed"),
        payload_snapshot=canonical_dict
    )
    db.add(tx_ref)

    for c in contributions:
        item = OrderItem(
            order_id=parent_order.id,
            listing_id=c.listing_id,
            contributing_farmer_id=c.farmer_id,
            farmer_name=c.farmer_name or "Farmer",
            crop_name=offer.crop_name,
            quantity=c.contributed_quantity,
            unit=offer.unit,
            unit_price=c.unit_price,
            subtotal=c.subtotal,
        )
        db.add(item)
        c.status = "committed"

    event = OrderEvent(
        order_id=parent_order.id,
        previous_status=None,
        new_status="pending",
        actor_id=current_user.id,
        reason=f"Buyer accepted Smart Group Offer #{offer.id[:8]} with {len(contributions)} contributing farmers.",
        on_chain_tx_hash=on_chain_res.get("tx_hash"),
        blockchain_status="confirmed"
    )
    db.add(event)

    offer.status = "accepted"
    offer.order_id = parent_order.id

    db.commit()
    db.refresh(offer)

    resp = GroupOfferResponse.model_validate(offer)
    resp.contributions = [ContributionResponse.model_validate(c) for c in offer.contributions]
    return resp


@router.post("/{offer_id}/reject", response_model=GroupOfferResponse)
def reject_group_offer(
    offer_id: str,
    current_user: User = Depends(require_buyer),
    db: Session = Depends(get_db),
):
    """
    Buyer rejects the proposed group offer.
    Transactionally releases all reserved inventory back to farmer listings.
    """
    offer = (
        db.query(GroupOffer)
        .filter(GroupOffer.id == offer_id)
        .with_for_update()
        .first()
    )
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group offer not found")

    if offer.status not in ["proposed", "open", "matched"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject offer with status '{offer.status}'.",
        )

    # Release reserved inventory
    for c in offer.contributions:
        if c.status == "reserved" and c.listing_id:
            listing = (
                db.query(ProduceListing)
                .filter(ProduceListing.id == c.listing_id)
                .with_for_update()
                .first()
            )
            if listing:
                listing.available_quantity = round(listing.available_quantity + c.contributed_quantity, 2)
                if listing.status == "sold_out":
                    listing.status = "active"
            c.status = "released"

    offer.status = "rejected"
    db.commit()
    db.refresh(offer)

    resp = GroupOfferResponse.model_validate(offer)
    resp.contributions = [ContributionResponse.model_validate(c) for c in offer.contributions]
    return resp


@router.post("/{offer_id}/cancel", response_model=GroupOfferResponse)
def cancel_group_offer(
    offer_id: str,
    reason: str = "Group pool cancelled by participant",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cancel group offer & release inventory. If linked parent order exists, cancel it too.
    """
    offer = (
        db.query(GroupOffer)
        .filter(GroupOffer.id == offer_id)
        .with_for_update()
        .first()
    )
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group offer not found")

    # Release any active reservations or commitments
    for c in offer.contributions:
        if c.status in ["reserved", "committed"] and c.listing_id:
            listing = (
                db.query(ProduceListing)
                .filter(ProduceListing.id == c.listing_id)
                .with_for_update()
                .first()
            )
            if listing:
                listing.available_quantity = round(listing.available_quantity + c.contributed_quantity, 2)
                if listing.status == "sold_out":
                    listing.status = "active"
            c.status = "cancelled"

    if offer.order_id:
        parent_order = db.query(Order).filter(Order.id == offer.order_id).first()
        if parent_order and parent_order.order_status not in ["completed", "cancelled"]:
            parent_order.order_status = "cancelled"
            parent_order.cancellation_reason = reason
            parent_order.cancelled_by = current_user.id
            evt = OrderEvent(
                order_id=parent_order.id,
                previous_status=parent_order.order_status,
                new_status="cancelled",
                actor_id=current_user.id,
                reason=reason,
            )
            db.add(evt)

    offer.status = "cancelled"
    db.commit()
    db.refresh(offer)

    resp = GroupOfferResponse.model_validate(offer)
    resp.contributions = [ContributionResponse.model_validate(c) for c in offer.contributions]
    return resp


@router.post("/contributions/{contribution_id}/confirm", response_model=ContributionResponse)
def confirm_farmer_contribution(
    contribution_id: str,
    current_user: User = Depends(require_farmer),
    db: Session = Depends(get_db),
):
    """
    Contributing farmer confirms their assigned lot in the group pool.
    When all contributing farmers confirm, parent order transitions to 'confirmed'.
    """
    contrib = (
        db.query(OfferContribution)
        .filter(OfferContribution.id == contribution_id)
        .with_for_update()
        .first()
    )
    if not contrib:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contribution not found")

    if contrib.farmer_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to confirm this contribution.",
        )

    contrib.farmer_confirmed = True
    contrib.farmer_confirmed_at = datetime.now(timezone.utc)
    contrib.status = "confirmed"

    offer = db.query(GroupOffer).filter(GroupOffer.id == contrib.group_offer_id).first()
    if offer:
        # Check if all contributions in this offer are now confirmed
        all_confirmed = all(c.farmer_confirmed for c in offer.contributions)
        if all_confirmed:
            offer.status = "confirmed"
            if offer.order_id:
                parent_order = db.query(Order).filter(Order.id == offer.order_id).first()
                if parent_order and parent_order.order_status == "pending":
                    parent_order.farmer_confirmed = True
                    parent_order.order_status = "confirmed"
                    evt = OrderEvent(
                        order_id=parent_order.id,
                        previous_status="pending",
                        new_status="confirmed",
                        actor_id=current_user.id,
                        reason="All pool contributing farmers confirmed order terms.",
                    )
                    db.add(evt)

    db.commit()
    db.refresh(contrib)
    return ContributionResponse.model_validate(contrib)


@router.post("/contributions/{contribution_id}/reject", response_model=ContributionResponse)
def reject_farmer_contribution(
    contribution_id: str,
    reason: str = "Farmer unable to fulfill pooled lot",
    current_user: User = Depends(require_farmer),
    db: Session = Depends(get_db),
):
    """
    Farmer rejects or opts out of contribution.
    Releases that farmer's reserved quantity back to listing and triggers partial fulfillment handling.
    """
    contrib = (
        db.query(OfferContribution)
        .filter(OfferContribution.id == contribution_id)
        .with_for_update()
        .first()
    )
    if not contrib:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contribution not found")

    if contrib.farmer_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to reject this contribution.",
        )

    # Release this farmer's inventory
    if contrib.listing_id:
        listing = (
            db.query(ProduceListing)
            .filter(ProduceListing.id == contrib.listing_id)
            .with_for_update()
            .first()
        )
        if listing:
            listing.available_quantity = round(listing.available_quantity + contrib.contributed_quantity, 2)
            if listing.status == "sold_out":
                listing.status = "active"

    contrib.status = "rejected"
    contrib.farmer_confirmed = False

    offer = db.query(GroupOffer).filter(GroupOffer.id == contrib.group_offer_id).first()
    if offer:
        offer.status = "partial_fulfillment_required"
        if offer.order_id:
            parent_order = db.query(Order).filter(Order.id == offer.order_id).first()
            if parent_order and parent_order.order_status not in ["cancelled", "completed"]:
                parent_order.order_status = "action_required"
                evt = OrderEvent(
                    order_id=parent_order.id,
                    previous_status=parent_order.order_status,
                    new_status="action_required",
                    actor_id=current_user.id,
                    reason=f"Farmer {contrib.farmer_name} opted out ({reason}). Partial fulfillment required.",
                )
                db.add(evt)

    db.commit()
    db.refresh(contrib)
    return ContributionResponse.model_validate(contrib)
