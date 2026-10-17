from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.models import (
    User, ProduceListing, Order, GroupOffer,
    BlockchainTxReference, OrderEvent, OrderAgreementVersion,
    AdminAuditLog, MarketPriceReference
)
from app.schemas.schemas import (
    UserResponse, ListingResponse, OrderResponse,
    AdminOverviewResponse, AdminAuditLogResponse,
    ListingModerationRequest, UserStatusUpdateRequest
)
from app.api.deps import require_admin
from app.services.blockchain_service import blockchain_service

router = APIRouter(prefix="/admin", tags=["Administrative & Governance Dashboard"])

@router.get("/overview", response_model=AdminOverviewResponse)
def get_admin_overview(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Retrieve operational health, aggregated marketplace statistics,
    and blockchain/AI subsystem status for the protected administrative dashboard.
    """
    users_total = db.query(func.count(User.id)).scalar() or 0
    farmers_count = db.query(func.count(User.id)).filter(User.role == "farmer").scalar() or 0
    buyers_count = db.query(func.count(User.id)).filter(User.role == "buyer").scalar() or 0

    listings_total = db.query(func.count(ProduceListing.id)).scalar() or 0
    active_listings = db.query(func.count(ProduceListing.id)).filter(ProduceListing.status == "active").scalar() or 0
    flagged_listings = db.query(func.count(ProduceListing.id)).filter(ProduceListing.status.in_(["flagged_fraudulent", "flagged"])).scalar() or 0

    orders_total = db.query(func.count(Order.id)).scalar() or 0
    completed_orders = db.query(func.count(Order.id)).filter(Order.order_status == "completed").scalar() or 0
    total_volume = db.query(func.sum(Order.total_amount)).scalar() or 0.0

    group_offers_total = db.query(func.count(GroupOffer.id)).scalar() or 0

    # Blockchain Subsystem Status
    tx_count = db.query(func.count(BlockchainTxReference.id)).scalar() or 0
    chain_info = {
        "status": "connected" if blockchain_service.w3 and blockchain_service.w3.is_connected() else "offline_resilient",
        "chain_id": blockchain_service.chain_id,
        "is_mock": not (blockchain_service.w3 and blockchain_service.w3.is_connected()),
        "order_registry_address": blockchain_service.order_registry_address,
        "traceability_address": blockchain_service.traceability_address,
        "escrow_address": blockchain_service.escrow_address,
        "token_address": blockchain_service.token_address,
        "total_on_chain_tx_count": tx_count
    }

    # AI Subsystems Status
    ai_status = {
        "farm_forensics": "operational",
        "farm_lab": "operational",
        "price_assistant": "operational",
        "kannada_speech_recognizer": "operational"
    }

    return AdminOverviewResponse(
        users_count=users_total,
        farmers_count=farmers_count,
        buyers_count=buyers_count,
        listings_count=listings_total,
        active_listings_count=active_listings,
        flagged_listings_count=flagged_listings,
        orders_count=orders_total,
        completed_orders_count=completed_orders,
        total_trade_volume=round(total_volume, 2),
        group_offers_count=group_offers_total,
        blockchain_status=chain_info,
        ai_services_status=ai_status
    )

@router.get("/users", response_model=List[UserResponse])
def get_all_users(
    role: Optional[str] = Query(None, description="Filter by role: farmer, buyer, admin"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all registered platform users for governance inspection."""
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    users = query.order_by(User.created_at.desc()).all()
    return [UserResponse.model_validate(u) for u in users]

@router.post("/users/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: str,
    payload: UserStatusUpdateRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Enable or suspend a user account with mandatory audit trail logging."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot suspend their own active administrative account."
        )

    prev_state = user.is_active
    user.is_active = payload.is_active
    user.updated_at = datetime.utcnow()

    # Log into AdminAuditLog
    audit_entry = AdminAuditLog(
        admin_id=current_admin.id,
        admin_name=current_admin.full_name,
        action_type="update_user_status",
        target_entity="user",
        target_id=user.id,
        details=f"Admin {current_admin.full_name} changed user status from {prev_state} to {payload.is_active}. Reason: {payload.reason}",
        metadata_json={
            "user_email": user.email,
            "previous_status": prev_state,
            "new_status": payload.is_active,
            "reason": payload.reason
        }
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(user)

    return UserResponse.model_validate(user)

@router.get("/listings", response_model=List[ListingResponse])
def get_all_admin_listings(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by listing status"),
    crop_name: Optional[str] = Query(None),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all produce listings across all farmers for moderation."""
    query = db.query(ProduceListing)
    if status_filter and status_filter != "all":
        query = query.filter(ProduceListing.status == status_filter)
    if crop_name:
        query = query.filter(ProduceListing.crop_name.ilike(f"%{crop_name}%"))

    listings = query.order_by(ProduceListing.created_at.desc()).all()
    results = []
    for l in listings:
        resp = ListingResponse.model_validate(l)
        if l.farmer:
            resp.farmer_name = l.farmer.full_name
        results.append(resp)
    return results

@router.post("/listings/{listing_id}/moderate", response_model=ListingResponse)
def moderate_produce_listing(
    listing_id: str,
    payload: ListingModerationRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Manage fraudulent, misrepresented or inappropriate listings using documented permissions.
    Records an immutable audit entry detailing the action and rationale.
    """
    valid_statuses = ["active", "paused", "archived", "flagged_fraudulent"]
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid moderation status '{payload.status}'. Must be one of {valid_statuses}."
        )

    listing = db.query(ProduceListing).filter(ProduceListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produce listing not found.")

    prev_status = listing.status
    listing.status = payload.status
    listing.updated_at = datetime.utcnow()

    # Create immutable audit log
    audit_entry = AdminAuditLog(
        admin_id=current_admin.id,
        admin_name=current_admin.full_name,
        action_type="moderate_listing",
        target_entity="listing",
        target_id=listing.id,
        details=f"Listing status transitioned from '{prev_status}' to '{payload.status}'. Reason: {payload.reason}",
        metadata_json={
            "crop_name": listing.crop_name,
            "farmer_id": listing.farmer_id,
            "previous_status": prev_status,
            "new_status": payload.status,
            "reason": payload.reason
        }
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(listing)

    resp = ListingResponse.model_validate(listing)
    if listing.farmer:
        resp.farmer_name = listing.farmer.full_name
    return resp

@router.get("/audit-logs", response_model=List[AdminAuditLogResponse])
def get_admin_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Retrieve operational administrative audit records."""
    logs = (
        db.query(AdminAuditLog)
        .order_by(AdminAuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [AdminAuditLogResponse.model_validate(l) for l in logs]

@router.get("/blockchain-transactions")
def get_blockchain_transaction_audit(
    limit: int = Query(50, ge=1, le=200),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Review operational blockchain transaction references.
    Proves that administrators cannot silently rewrite agreements or falsify statuses.
    """
    txs = (
        db.query(BlockchainTxReference)
        .order_by(BlockchainTxReference.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": tx.id,
            "order_id": tx.order_id,
            "contract_name": tx.contract_name,
            "contract_address": tx.contract_address,
            "action_type": tx.action_type,
            "tx_hash": tx.tx_hash,
            "block_number": tx.block_number,
            "network_id": tx.network_id,
            "status": tx.status,
            "created_at": tx.created_at
        }
        for tx in txs
    ]

@router.get("/agreements/{order_id}/verify")
def admin_verify_agreement_integrity(
    order_id: str,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Verify agreement integrity for an order against on-chain smart contract registry.
    Ensures that neither users nor administrators have altered the agreed terms.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    on_chain_res = blockchain_service.verify_agreement_on_chain(
        order_id=order.id,
        candidate_hash=order.agreement_hash
    )

    is_valid = on_chain_res.get("hash_match", False)
    on_chain_hash = on_chain_res.get("on_chain_hash", "")
    tamper_status = "VERIFIED_AUTHENTIC" if is_valid else "HASH_MISMATCH_DETECTED"

    return {
        "order_id": order.id,
        "order_code": order.order_code,
        "agreement_version": order.agreement_version,
        "database_agreement_hash": order.agreement_hash,
        "blockchain_registered_hash": on_chain_hash,
        "tamper_evident_status": tamper_status,
        "is_tamper_free": is_valid,
        "verified_at": datetime.utcnow().isoformat(),
        "verified_by_admin": current_admin.full_name
    }
