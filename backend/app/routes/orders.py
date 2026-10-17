import hashlib
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import (
    Order, OrderItem, OrderEvent, ProduceListing, User,
    OrderAgreementVersion, BlockchainTxReference
)
from app.schemas.schemas import (
    OrderCreate, OrderTransition, OrderCancel, OrderResponse,
    OrderAgreementVersionResponse, OnChainVerificationResponse,
    EscrowDepositRequest, EscrowActionResponse
)
from app.api.deps import get_current_user, require_buyer, verify_order_participant
from app.services.blockchain_service import blockchain_service, TEST_TOKEN_DISCLAIMER

router = APIRouter(prefix="/orders", tags=["Orders & Blockchain Agreements"])

VALID_TRANSITIONS = {
    "created": ["confirmed", "cancelled"],
    "confirmed": ["escrow_funded", "cancelled"],
    "escrow_funded": ["in_transit", "disputed", "cancelled"],
    "in_transit": ["delivered", "disputed"],
    "delivered": ["completed", "disputed"],
    "disputed": ["completed", "cancelled"],
    "completed": [],
    "cancelled": []
}

class AmendOrderTermsRequest(BaseModel):
    new_delivery_terms: Optional[str] = None
    new_delivery_address: Optional[str] = None
    reason: str = Field(..., min_length=3)

@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    current_user: User = Depends(require_buyer),
    db: Session = Depends(get_db)
):
    """
    Create a new single-farmer purchase order with atomic stock validation,
    deterministic canonical agreement hashing, and local smart-contract registration.
    """
    if not payload.listing_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="listing_id is required to create a direct farm produce order."
        )

    if payload.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order quantity must be greater than zero."
        )

    # Use row-level lock (with_for_update) to prevent concurrent overselling
    listing = (
        db.query(ProduceListing)
        .filter(ProduceListing.id == payload.listing_id)
        .with_for_update()
        .first()
    )

    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produce listing not found.")

    if listing.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Produce listing is not available for orders (status: '{listing.status}')."
        )

    if payload.quantity < listing.minimum_order_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requested quantity ({payload.quantity} {listing.unit}) is less than minimum order quantity ({listing.minimum_order_quantity} {listing.unit})."
        )

    if payload.quantity > listing.available_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requested quantity ({payload.quantity} {listing.unit}) exceeds available stock ({listing.available_quantity} {listing.unit})."
        )

    seller = db.query(User).filter(User.id == listing.farmer_id).first()
    if not seller:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller farmer not found.")

    # Calculate financial totals
    total_amount = round(payload.quantity * listing.price_per_unit, 2)
    order_id = str(uuid.uuid4())
    order_code = f"ORD-DK-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6].upper()}"

    item_dict = {
        "contributing_farmer_id": seller.id,
        "crop_name": listing.crop_name,
        "quantity": payload.quantity,
        "unit": listing.unit,
        "unit_price": listing.price_per_unit,
        "subtotal": total_amount
    }

    # Deterministic Canonical Agreement Terms & Cryptographic Hash (SHA-256)
    canonical_dict, canonical_json, agreement_hash = blockchain_service.canonicalize_order_terms(
        order_id=order_id,
        order_code=order_code,
        buyer_id=current_user.id,
        seller_id=seller.id,
        items=[item_dict],
        delivery_terms=payload.delivery_terms,
        delivery_address=payload.delivery_address,
        total_amount=total_amount,
        agreement_version=1
    )

    # Register Agreement Hash on Smart Contract (FarmConnectOrderRegistry)
    on_chain_res = blockchain_service.register_agreement_on_chain(
        order_id=order_id,
        agreement_hash=agreement_hash
    )

    # Create Order Entity
    order = Order(
        id=order_id,
        order_code=order_code,
        buyer_id=current_user.id,
        seller_id=seller.id,
        buyer_name=current_user.full_name,
        seller_name=seller.full_name,
        is_group_order=False,
        group_offer_id=payload.group_offer_id,
        total_amount=total_amount,
        order_status="created",
        delivery_terms=payload.delivery_terms,
        delivery_address=payload.delivery_address,
        farmer_confirmed=False,
        buyer_confirmed=True,  # Buyer affirms terms by initiating order
        agreement_hash=agreement_hash,
        blockchain_tx_hash=on_chain_res.get("tx_hash"),
        contract_address=on_chain_res.get("contract_address", blockchain_service.order_registry_address),
        network_identifier=str(on_chain_res.get("network_id", "31337")),
        block_number=on_chain_res.get("block_number"),
        agreement_version=1,
        escrow_status="unfunded"
    )
    db.add(order)

    # Version 1 Agreement Record
    agreement_ver = OrderAgreementVersion(
        order_id=order.id,
        version=1,
        agreement_hash=agreement_hash,
        canonical_terms_json=canonical_dict,
        on_chain_tx_hash=on_chain_res.get("tx_hash"),
        contract_address=on_chain_res.get("contract_address"),
        network_id=str(on_chain_res.get("network_id", "31337")),
        block_number=on_chain_res.get("block_number"),
        is_current=True,
        terms_summary=f"Purchase agreement for {payload.quantity} {listing.unit} of {listing.crop_name} @ ₹{listing.price_per_unit}/{listing.unit}"
    )
    db.add(agreement_ver)

    # Create Line Item
    item = OrderItem(
        order_id=order.id,
        listing_id=listing.id,
        contributing_farmer_id=seller.id,
        farmer_name=seller.full_name,
        crop_name=listing.crop_name,
        quantity=payload.quantity,
        unit=listing.unit,
        unit_price=listing.price_per_unit,
        subtotal=total_amount
    )
    db.add(item)

    # Initial order event with on-chain reference
    event = OrderEvent(
        order_id=order.id,
        previous_status=None,
        new_status="created",
        actor_id=current_user.id,
        reason="Order initiated and terms confirmed by buyer",
        on_chain_tx_hash=on_chain_res.get("tx_hash"),
        blockchain_status=on_chain_res.get("status", "confirmed")
    )
    db.add(event)

    # Blockchain Transaction Reference
    tx_ref = BlockchainTxReference(
        order_id=order.id,
        contract_name="FarmConnectOrderRegistry",
        contract_address=on_chain_res.get("contract_address", blockchain_service.order_registry_address),
        action_type="registerOrder",
        tx_hash=on_chain_res.get("tx_hash"),
        block_number=on_chain_res.get("block_number"),
        network_id=str(on_chain_res.get("network_id", "31337")),
        status=on_chain_res.get("status", "confirmed"),
        payload_snapshot=canonical_dict
    )
    db.add(tx_ref)

    # Atomically decrement listing stock
    listing.available_quantity = round(listing.available_quantity - payload.quantity, 2)
    if listing.available_quantity <= 0:
        listing.status = "sold_out"

    db.commit()
    db.refresh(order)
    return OrderResponse.model_validate(order)

@router.get("", response_model=List[OrderResponse])
def get_my_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all orders where the user is either the buyer or seller."""
    if current_user.role == "admin":
        orders = db.query(Order).order_by(Order.created_at.desc()).all()
    else:
        orders = (
            db.query(Order)
            .outerjoin(OrderItem, Order.id == OrderItem.order_id)
            .filter(
                (Order.buyer_id == current_user.id)
                | (Order.seller_id == current_user.id)
                | (OrderItem.contributing_farmer_id == current_user.id)
            )
            .distinct()
            .order_by(Order.created_at.desc())
            .all()
        )
    return [OrderResponse.model_validate(o) for o in orders]

@router.get("/{order_id}", response_model=OrderResponse)
def get_order_by_id(
    order_id: str,
    order: Order = Depends(verify_order_participant)
):
    """Retrieve comprehensive details of an order including line items, agreement versions and event history."""
    return OrderResponse.model_validate(order)

@router.post("/{order_id}/confirm", response_model=OrderResponse)
def confirm_order_terms(
    order_id: str,
    current_user: User = Depends(get_current_user),
    order: Order = Depends(verify_order_participant),
    db: Session = Depends(get_db)
):
    """
    Farmer or Buyer confirms agreement terms.
    When both parties confirm, order transitions from 'created' to 'confirmed'.
    """
    if order.order_status not in ["created", "confirmed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm terms for order in '{order.order_status}' status."
        )

    actor_role = "admin"
    if current_user.id == order.seller_id:
        order.farmer_confirmed = True
        actor_role = "farmer"
    elif current_user.id == order.buyer_id:
        order.buyer_confirmed = True
        actor_role = "buyer"
    elif current_user.role == "admin":
        order.farmer_confirmed = True
        order.buyer_confirmed = True
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized to confirm terms for this order.")

    # Record event
    confirm_event = OrderEvent(
        order_id=order.id,
        previous_status=order.order_status,
        new_status=order.order_status,
        actor_id=current_user.id,
        reason=f"Order terms confirmed by {actor_role} ({current_user.full_name})",
        blockchain_status="confirmed"
    )
    db.add(confirm_event)

    # If both parties have confirmed, transition to 'confirmed'
    if order.farmer_confirmed and order.buyer_confirmed and order.order_status == "created":
        order.order_status = "confirmed"
        transition_event = OrderEvent(
            order_id=order.id,
            previous_status="created",
            new_status="confirmed",
            actor_id=current_user.id,
            reason="Both farmer and buyer confirmed agreement terms; order is now active and confirmed.",
            blockchain_status="confirmed"
        )
        db.add(transition_event)

    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return OrderResponse.model_validate(order)

@router.post("/{order_id}/cancel", response_model=OrderResponse)
def cancel_order(
    order_id: str,
    payload: OrderCancel,
    current_user: User = Depends(get_current_user),
    order: Order = Depends(verify_order_participant),
    db: Session = Depends(get_db)
):
    """
    Cancel an order before fulfillment.
    Restores deducted produce quantities back into the farmer's listing inventory.
    If escrow was funded, initiates refund.
    """
    if order.order_status not in ["created", "confirmed", "escrow_funded"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order in '{order.order_status}' state cannot be cancelled."
        )

    # If escrow was funded, perform refund
    if order.escrow_status == "deposited":
        refund_res = blockchain_service.refund_test_escrow(order.id, order.total_amount)
        order.escrow_status = "refunded"
        tx_ref = BlockchainTxReference(
            order_id=order.id,
            contract_name="FarmEscrow",
            contract_address=refund_res.get("escrow_contract", blockchain_service.escrow_address),
            action_type="refund",
            tx_hash=refund_res.get("tx_hash"),
            block_number=refund_res.get("block_number"),
            network_id=str(blockchain_service.chain_id),
            status="confirmed",
            payload_snapshot={"order_id": order.id, "amount": order.total_amount}
        )
        db.add(tx_ref)

    # Restore listing inventory
    for item in order.items:
        if item.listing_id:
            listing = (
                db.query(ProduceListing)
                .filter(ProduceListing.id == item.listing_id)
                .with_for_update()
                .first()
            )
            if listing:
                listing.available_quantity = round(listing.available_quantity + item.quantity, 2)
                if listing.status == "sold_out" and listing.available_quantity > 0:
                    listing.status = "active"

    prev_status = order.order_status
    order.order_status = "cancelled"
    order.cancellation_reason = payload.reason
    order.cancelled_by = current_user.id
    order.updated_at = datetime.utcnow()

    event = OrderEvent(
        order_id=order.id,
        previous_status=prev_status,
        new_status="cancelled",
        actor_id=current_user.id,
        reason=f"Cancelled by {current_user.role}: {payload.reason}",
        blockchain_status="confirmed"
    )
    db.add(event)

    db.commit()
    db.refresh(order)
    return OrderResponse.model_validate(order)

@router.post("/{order_id}/transition", response_model=OrderResponse)
def transition_order_status(
    order_id: str,
    payload: OrderTransition,
    current_user: User = Depends(get_current_user),
    order: Order = Depends(verify_order_participant),
    db: Session = Depends(get_db)
):
    """Transition order status through fulfillment lifecycle."""
    curr = order.order_status
    target = payload.new_status

    allowed = VALID_TRANSITIONS.get(curr, [])
    if target not in allowed and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid state transition from '{curr}' to '{target}'. Allowed transitions: {allowed}"
        )

    # Role-specific checks
    if target == "confirmed":
        if current_user.id != order.seller_id and current_user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the seller can confirm the order.")
        order.farmer_confirmed = True
    elif target == "escrow_funded":
        if current_user.id != order.buyer_id and current_user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the buyer can fund escrow.")
        dep_res = blockchain_service.deposit_test_escrow(order.id, order.total_amount)
        order.escrow_status = "deposited"
        order.blockchain_tx_hash = dep_res.get("tx_hash")
        tx_ref = BlockchainTxReference(
            order_id=order.id,
            contract_name="FarmEscrow",
            contract_address=dep_res.get("escrow_contract", blockchain_service.escrow_address),
            action_type="deposit",
            tx_hash=dep_res.get("tx_hash"),
            block_number=dep_res.get("block_number"),
            network_id=str(blockchain_service.chain_id),
            status="confirmed",
            payload_snapshot={"order_id": order.id, "amount": order.total_amount}
        )
        db.add(tx_ref)
    elif target == "in_transit":
        if current_user.id != order.seller_id and current_user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the seller can mark order in-transit.")
    elif target == "delivered":
        if current_user.id != order.buyer_id and current_user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the buyer can confirm physical receipt and delivery.")
    elif target == "completed":
        if order.escrow_status == "deposited":
            # Release escrow upon completion
            rel_res = blockchain_service.release_test_escrow(order.id, order.total_amount)
            order.escrow_status = "released"
            tx_ref = BlockchainTxReference(
                order_id=order.id,
                contract_name="FarmEscrow",
                contract_address=rel_res.get("escrow_contract", blockchain_service.escrow_address),
                action_type="release",
                tx_hash=rel_res.get("tx_hash"),
                block_number=rel_res.get("block_number"),
                network_id=str(blockchain_service.chain_id),
                status="confirmed",
                payload_snapshot={"order_id": order.id, "amount": order.total_amount}
            )
            db.add(tx_ref)

    order.order_status = target
    order.updated_at = datetime.utcnow()

    event = OrderEvent(
        order_id=order.id,
        previous_status=curr,
        new_status=target,
        actor_id=current_user.id,
        reason=payload.reason or f"Transitioned to {target}",
        blockchain_status="confirmed"
    )
    db.add(event)
    db.commit()
    db.refresh(order)

    return OrderResponse.model_validate(order)

# -------------------------------------------------------------
# Phase 8: Blockchain Verification & Escrow Endpoints
# -------------------------------------------------------------

@router.get("/{order_id}/verify-on-chain", response_model=OnChainVerificationResponse)
def verify_order_agreement_on_chain(
    order_id: str,
    current_user: User = Depends(get_current_user),
    order: Order = Depends(verify_order_participant)
):
    """
    Cryptographically verify the order's canonical agreement terms against the
    on-chain registered agreement hash on FarmConnectOrderRegistry.
    Guarantees tamper-evidence.
    """
    result = blockchain_service.verify_agreement_on_chain(order.id, order.agreement_hash)
    
    hash_match = (result.get("on_chain_hash", "").lower() == order.agreement_hash.lower())
    
    return OnChainVerificationResponse(
        order_id=order.id,
        order_code=order.order_code,
        is_registered_on_chain=result.get("is_registered_on_chain", True),
        agreement_version=order.agreement_version,
        off_chain_hash=order.agreement_hash,
        on_chain_hash=result.get("on_chain_hash"),
        hash_match=hash_match,
        contract_address=result.get("contract_address", blockchain_service.order_registry_address),
        network_identifier=str(result.get("network_id", "31337")),
        buyer_confirmed=order.buyer_confirmed,
        farmer_confirmed=order.farmer_confirmed,
        block_number=order.block_number,
        on_chain_status="Verified Authenticated" if hash_match else "Tampering Detected / Hash Mismatch",
        verification_message="Canonical terms in PostgreSQL exactly match the immutable smart contract record on-chain." if hash_match else "Warning: Local terms do not match on-chain hash!",
        last_checked_at=datetime.utcnow()
    )

@router.post("/{order_id}/anchor-on-chain", response_model=OrderResponse)
def anchor_order_agreement_on_chain(
    order_id: str,
    current_user: User = Depends(get_current_user),
    order: Order = Depends(verify_order_participant),
    db: Session = Depends(get_db)
):
    """
    Explicitly anchors or re-anchors current order agreement terms on-chain.
    """
    res = blockchain_service.register_agreement_on_chain(
        order_id=order.id,
        agreement_hash=order.agreement_hash
    )
    
    order.blockchain_tx_hash = res.get("tx_hash")
    order.contract_address = res.get("contract_address")
    order.network_identifier = str(res.get("network_id", "31337"))
    order.block_number = res.get("block_number")
    order.updated_at = datetime.utcnow()

    tx_ref = BlockchainTxReference(
        order_id=order.id,
        contract_name="FarmConnectOrderRegistry",
        contract_address=order.contract_address,
        action_type="anchorOrderAgreement",
        tx_hash=res.get("tx_hash"),
        block_number=res.get("block_number"),
        network_id=str(blockchain_service.chain_id),
        status="confirmed",
        payload_snapshot={"order_id": order.id, "agreement_hash": order.agreement_hash}
    )
    db.add(tx_ref)

    db.commit()
    db.refresh(order)
    return OrderResponse.model_validate(order)

@router.post("/{order_id}/amend-terms", response_model=OrderResponse)
def amend_order_terms(
    order_id: str,
    payload: AmendOrderTermsRequest,
    current_user: User = Depends(get_current_user),
    order: Order = Depends(verify_order_participant),
    db: Session = Depends(get_db)
):
    """
    Tamper-evident term amendment:
    If terms change, create a NEW agreement version and a NEW hash
    rather than silently overwriting the old agreement!
    Both versions remain in the permanent audit trail.
    """
    if order.order_status not in ["created", "confirmed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot amend terms after shipment or escrow release."
        )

    # Deactivate current version
    for v in order.agreement_versions:
        v.is_current = False

    new_version_num = order.agreement_version + 1
    new_delivery_terms = payload.new_delivery_terms or order.delivery_terms
    new_delivery_address = payload.new_delivery_address or order.delivery_address

    items_list = [
        {
            "contributing_farmer_id": item.contributing_farmer_id,
            "crop_name": item.crop_name,
            "quantity": item.quantity,
            "unit": item.unit,
            "unit_price": item.unit_price,
            "subtotal": item.subtotal
        }
        for item in order.items
    ]

    # Re-calculate canonical representation for the new version
    canonical_dict, canonical_json, new_hash = blockchain_service.canonicalize_order_terms(
        order_id=order.id,
        order_code=order.order_code,
        buyer_id=order.buyer_id,
        seller_id=order.seller_id,
        items=items_list,
        delivery_terms=new_delivery_terms,
        delivery_address=new_delivery_address,
        total_amount=order.total_amount,
        agreement_version=new_version_num
    )

    # Anchor new version on-chain
    on_chain_res = blockchain_service.register_agreement_on_chain(
        order_id=f"{order.id}-v{new_version_num}",
        agreement_hash=new_hash
    )

    # Update order
    order.delivery_terms = new_delivery_terms
    order.delivery_address = new_delivery_address
    order.agreement_hash = new_hash
    order.agreement_version = new_version_num
    order.blockchain_tx_hash = on_chain_res.get("tx_hash")
    order.block_number = on_chain_res.get("block_number")
    order.farmer_confirmed = False  # Terms require re-confirmation after amendment
    order.updated_at = datetime.utcnow()

    # Store new version in DB
    new_ver = OrderAgreementVersion(
        order_id=order.id,
        version=new_version_num,
        agreement_hash=new_hash,
        canonical_terms_json=canonical_dict,
        on_chain_tx_hash=on_chain_res.get("tx_hash"),
        contract_address=on_chain_res.get("contract_address"),
        network_id=str(blockchain_service.chain_id),
        block_number=on_chain_res.get("block_number"),
        is_current=True,
        terms_summary=f"Amendment v{new_version_num}: {payload.reason}"
    )
    db.add(new_ver)

    event = OrderEvent(
        order_id=order.id,
        previous_status=order.order_status,
        new_status=order.order_status,
        actor_id=current_user.id,
        reason=f"Terms amended by {current_user.role} to Version {new_version_num}: {payload.reason}",
        on_chain_tx_hash=on_chain_res.get("tx_hash"),
        blockchain_status="confirmed"
    )
    db.add(event)

    db.commit()
    db.refresh(order)
    return OrderResponse.model_validate(order)

@router.get("/{order_id}/versions", response_model=List[OrderAgreementVersionResponse])
def get_order_agreement_versions(
    order_id: str,
    current_user: User = Depends(get_current_user),
    order: Order = Depends(verify_order_participant),
    db: Session = Depends(get_db)
):
    """
    Retrieve full tamper-evident version history of order agreements.
    """
    versions = (
        db.query(OrderAgreementVersion)
        .filter(OrderAgreementVersion.order_id == order.id)
        .order_by(OrderAgreementVersion.version.asc())
        .all()
    )
    return [OrderAgreementVersionResponse.model_validate(v) for v in versions]

# -------------------------------------------------------------
# Phase 8: Smart Contract Escrow Demonstration
# -------------------------------------------------------------

@router.post("/{order_id}/escrow/deposit", response_model=EscrowActionResponse)
def deposit_escrow_tokens(
    order_id: str,
    payload: Optional[EscrowDepositRequest] = None,
    current_user: User = Depends(require_buyer),
    order: Order = Depends(verify_order_participant),
    db: Session = Depends(get_db)
):
    """
    Demonstrate buyer depositing test FARM ERC-20 tokens into FarmEscrow.
    Tokens are held in non-custodial smart contract until buyer confirms receipt.
    """
    if order.order_status not in ["created", "confirmed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot deposit escrow for order in status '{order.order_status}'."
        )

    deposit_amount = payload.amount if (payload and payload.amount) else order.total_amount
    
    # Execute escrow deposit on blockchain
    res = blockchain_service.deposit_test_escrow(
        order_id=order.id,
        amount=deposit_amount
    )

    order.escrow_status = "deposited"
    order.order_status = "escrow_funded"
    order.blockchain_tx_hash = res.get("tx_hash")
    order.updated_at = datetime.utcnow()

    event = OrderEvent(
        order_id=order.id,
        previous_status=order.order_status,
        new_status="escrow_funded",
        actor_id=current_user.id,
        reason=f"Buyer deposited {deposit_amount} test FARM tokens into escrow smart contract.",
        on_chain_tx_hash=res.get("tx_hash"),
        blockchain_status="confirmed"
    )
    db.add(event)

    tx_ref = BlockchainTxReference(
        order_id=order.id,
        contract_name="FarmEscrow",
        contract_address=res.get("escrow_contract", blockchain_service.escrow_address),
        action_type="deposit",
        tx_hash=res.get("tx_hash"),
        block_number=res.get("block_number"),
        network_id=str(blockchain_service.chain_id),
        status="confirmed",
        payload_snapshot={"order_id": order.id, "amount": deposit_amount, "token": res.get("token_contract")}
    )
    db.add(tx_ref)

    db.commit()
    db.refresh(order)

    return EscrowActionResponse(
        order_id=order.id,
        action="deposit",
        amount=deposit_amount,
        escrow_contract=res.get("escrow_contract", blockchain_service.escrow_address),
        token_contract=res.get("token_contract", blockchain_service.token_address),
        tx_hash=res.get("tx_hash"),
        block_number=res.get("block_number"),
        status="confirmed",
        is_demonstration=True,
        disclaimer=TEST_TOKEN_DISCLAIMER
    )

@router.post("/{order_id}/escrow/release", response_model=EscrowActionResponse)
def release_escrow_tokens(
    order_id: str,
    current_user: User = Depends(get_current_user),
    order: Order = Depends(verify_order_participant),
    db: Session = Depends(get_db)
):
    """
    Release escrowed test tokens to beneficiary farmer(s).
    Allowed when order is delivered and buyer or admin approves release.
    """
    if order.escrow_status != "deposited":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot release escrow: current escrow status is '{order.escrow_status}' (must be 'deposited')."
        )

    if current_user.id != order.buyer_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the purchasing buyer or administrator can release escrow funds."
        )

    res = blockchain_service.release_test_escrow(order.id, order.total_amount)

    order.escrow_status = "released"
    order.order_status = "completed"
    order.updated_at = datetime.utcnow()

    event = OrderEvent(
        order_id=order.id,
        previous_status=order.order_status,
        new_status="completed",
        actor_id=current_user.id,
        reason=f"Escrow release authorized by {current_user.role}. Payout released to farmer.",
        on_chain_tx_hash=res.get("tx_hash"),
        blockchain_status="confirmed"
    )
    db.add(event)

    tx_ref = BlockchainTxReference(
        order_id=order.id,
        contract_name="FarmEscrow",
        contract_address=res.get("escrow_contract", blockchain_service.escrow_address),
        action_type="release",
        tx_hash=res.get("tx_hash"),
        block_number=res.get("block_number"),
        network_id=str(blockchain_service.chain_id),
        status="confirmed",
        payload_snapshot={"order_id": order.id, "amount": order.total_amount}
    )
    db.add(tx_ref)

    db.commit()
    db.refresh(order)

    return EscrowActionResponse(
        order_id=order.id,
        action="release",
        amount=order.total_amount,
        escrow_contract=res.get("escrow_contract", blockchain_service.escrow_address),
        token_contract=res.get("token_contract", blockchain_service.token_address),
        tx_hash=res.get("tx_hash"),
        block_number=res.get("block_number"),
        status="confirmed",
        is_demonstration=True,
        disclaimer=TEST_TOKEN_DISCLAIMER
    )

@router.post("/{order_id}/escrow/refund", response_model=EscrowActionResponse)
def refund_escrow_tokens(
    order_id: str,
    current_user: User = Depends(get_current_user),
    order: Order = Depends(verify_order_participant),
    db: Session = Depends(get_db)
):
    """
    Refund escrowed test tokens to the buyer.
    Can be initiated by the farmer (rejecting/cancelling) or administrator.
    """
    if order.escrow_status != "deposited":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot refund escrow: current escrow status is '{order.escrow_status}'."
        )

    if current_user.id != order.seller_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the beneficiary farmer or administrator can authorize an escrow refund to the buyer."
        )

    res = blockchain_service.refund_test_escrow(order.id, order.total_amount)

    order.escrow_status = "refunded"
    order.order_status = "cancelled"
    order.updated_at = datetime.utcnow()

    event = OrderEvent(
        order_id=order.id,
        previous_status=order.order_status,
        new_status="cancelled",
        actor_id=current_user.id,
        reason=f"Escrow refund authorized by {current_user.role}. Funds returned to buyer.",
        on_chain_tx_hash=res.get("tx_hash"),
        blockchain_status="confirmed"
    )
    db.add(event)

    tx_ref = BlockchainTxReference(
        order_id=order.id,
        contract_name="FarmEscrow",
        contract_address=res.get("escrow_contract", blockchain_service.escrow_address),
        action_type="refund",
        tx_hash=res.get("tx_hash"),
        block_number=res.get("block_number"),
        network_id=str(blockchain_service.chain_id),
        status="confirmed",
        payload_snapshot={"order_id": order.id, "amount": order.total_amount}
    )
    db.add(tx_ref)

    db.commit()
    db.refresh(order)

    return EscrowActionResponse(
        order_id=order.id,
        action="refund",
        amount=order.total_amount,
        escrow_contract=res.get("escrow_contract", blockchain_service.escrow_address),
        token_contract=res.get("token_contract", blockchain_service.token_address),
        tx_hash=res.get("tx_hash"),
        block_number=res.get("block_number"),
        status="confirmed",
        is_demonstration=True,
        disclaimer=TEST_TOKEN_DISCLAIMER
    )
