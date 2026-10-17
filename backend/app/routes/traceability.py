import hashlib
import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import TraceabilityEvent, Order, ProduceListing, User, BlockchainTxReference
from app.schemas.schemas import TraceabilityCreateRequest, TraceabilityResponse
from app.api.deps import get_current_user, verify_order_participant
from app.services.blockchain_service import blockchain_service

router = APIRouter(prefix="/traceability", tags=["Produce Traceability"])

VALID_STAGES = ["harvest", "packing", "handover", "receipt"]

@router.post("/events", response_model=TraceabilityResponse, status_code=status.HTTP_201_CREATED)
def record_traceability_event(
    payload: TraceabilityCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Record produce traceability event (harvest, packing, handover, receipt).
    Calculates cryptographic hash of event metadata, registers on ProduceTraceability
    smart contract, and stores details off-chain in PostgreSQL.
    Clearly records whether claim is self-reported or independently verified.
    """
    stage_normalized = payload.stage_name.lower().strip()
    if stage_normalized not in VALID_STAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid stage '{payload.stage_name}'. Must be one of: {VALID_STAGES}"
        )

    order = db.query(Order).filter(Order.id == payload.order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found for traceability record."
        )

    # Authorization check
    is_seller = (current_user.id == order.seller_id)
    is_buyer = (current_user.id == order.buyer_id)
    is_admin = (current_user.role == "admin")

    # Only farmer can log harvest and packing; only buyer or carrier can log receipt; handover can be either
    if stage_normalized in ["harvest", "packing"] and not (is_seller or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the producer farmer can log harvest and packing events."
        )
    if stage_normalized == "receipt" and not (is_buyer or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the purchasing buyer can confirm receipt at delivery destination."
        )

    # Determine independent verification source
    # For demo: if logged by admin or marked as independently inspected (e.g. APMC yard), set verified flag
    is_verified = payload.is_independently_verified or (current_user.role == "admin")
    verification_source = payload.verification_source
    if not verification_source:
        verification_source = "APMC Yard Inspector" if is_verified else f"Self-reported by {current_user.role.title()} ({current_user.full_name})"

    metadata = payload.metadata or {}
    metadata.update({
        "order_id": order.id,
        "order_code": order.order_code,
        "stage": stage_normalized,
        "location": payload.location.strip(),
        "quality_grade": payload.quality_grade,
        "notes": payload.notes,
        "recorded_by_id": current_user.id,
        "recorded_by_name": current_user.full_name,
        "is_independently_verified": is_verified,
        "verification_source": verification_source,
        "recorded_at": datetime.utcnow().isoformat()
    })

    canonical_meta_json = json.dumps(metadata, sort_keys=True, separators=(',', ':'))
    event_hash = "0x" + hashlib.sha256(canonical_meta_json.encode('utf-8')).hexdigest()

    # Anchor on ProduceTraceability smart contract
    on_chain_res = blockchain_service.record_traceability_milestone(
        tracking_id=order.order_code,
        stage=stage_normalized,
        metadata_hash=event_hash,
        location=payload.location.strip()
    )

    trace_event = TraceabilityEvent(
        order_id=order.id,
        listing_id=payload.listing_id,
        stage_name=stage_normalized,
        location=payload.location.strip(),
        recorded_by=current_user.full_name,
        quality_grade=payload.quality_grade,
        is_independently_verified=is_verified,
        verification_source=verification_source,
        event_hash=event_hash,
        on_chain_tx_hash=on_chain_res.get("tx_hash"),
        metadata_json=metadata
    )
    db.add(trace_event)

    tx_ref = BlockchainTxReference(
        order_id=order.id,
        contract_name="ProduceTraceability",
        contract_address=on_chain_res.get("contract_address", blockchain_service.traceability_address),
        action_type=f"traceability:{stage_normalized}",
        tx_hash=on_chain_res.get("tx_hash"),
        block_number=on_chain_res.get("block_number"),
        network_id=str(blockchain_service.chain_id),
        status="confirmed",
        payload_snapshot=metadata
    )
    db.add(tx_ref)

    db.commit()
    db.refresh(trace_event)

    return TraceabilityResponse.model_validate(trace_event)

@router.get("/{order_id}", response_model=List[TraceabilityResponse])
def get_traceability_timeline(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve complete chronological produce traceability timeline for an order.
    Displays harvest, packing, handover and receipt with on-chain hashes and
    verification status.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    # Check participant authorization
    if current_user.role != "admin" and current_user.id != order.buyer_id and current_user.id != order.seller_id:
        # Check if user is a contributing farmer
        is_contributor = any(item.contributing_farmer_id == current_user.id for item in order.items)
        if not is_contributor:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to order traceability.")

    events = (
        db.query(TraceabilityEvent)
        .filter(TraceabilityEvent.order_id == order_id)
        .order_by(TraceabilityEvent.event_timestamp.asc())
        .all()
    )

    return [TraceabilityResponse.model_validate(e) for e in events]
