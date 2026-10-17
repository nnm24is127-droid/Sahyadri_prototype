import pytest
from app.services.blockchain_service import BlockchainService, blockchain_service, TEST_TOKEN_DISCLAIMER
from app.models.models import User, ProduceListing, Order, OrderAgreementVersion, TraceabilityEvent, BlockchainTxReference
from app.core.security import get_password_hash, create_access_token

def create_test_user(db, email, role, full_name):
    user = User(
        email=email,
        password_hash=get_password_hash("password123"),
        full_name=full_name,
        role=role,
        phone_number="+919876543210",
        district="Dakshina Kannada",
        taluk="Bantwal",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def create_test_listing(db, farmer_id, crop_name="Bantwal Arecanut", qty=100.0, price=380.0):
    listing = ProduceListing(
        farmer_id=farmer_id,
        crop_name=crop_name,
        category="Commercial Crops",
        total_quantity=qty,
        available_quantity=qty,
        unit="kg",
        minimum_order_quantity=5.0,
        price_per_unit=price,
        quality_grade="Grade A (Premium)",
        organic_certified=False,
        harvest_date="2026-10-15",
        status="active",
        district="Dakshina Kannada",
        taluk="Bantwal"
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing

# -------------------------------------------------------------
# A. Canonicalization & Hashing Unit Tests
# -------------------------------------------------------------
def test_canonicalize_order_terms_determinism():
    """
    Ensure canonical agreement terms serialization is strictly deterministic:
    Key ordering, whitespace normalization, and item ordering must produce
    identical SHA-256 hashes regardless of dictionary insertion order.
    """
    items1 = [
        {"contributing_farmer_id": "farmer-b", "crop_name": "Tomato", "quantity": 50, "unit": "kg", "unit_price": 40, "subtotal": 2000},
        {"contributing_farmer_id": "farmer-a", "crop_name": "Arecanut", "quantity": 100, "unit": "kg", "unit_price": 380, "subtotal": 38000},
    ]
    # Reverse input order
    items2 = [
        {"crop_name": "Arecanut", "contributing_farmer_id": "farmer-a", "quantity": 100.0, "subtotal": 38000.0, "unit": "KG", "unit_price": 380.0},
        {"crop_name": "Tomato", "contributing_farmer_id": "farmer-b", "quantity": 50.0, "subtotal": 2000.0, "unit": "kg", "unit_price": 40.0},
    ]

    dict1, json1, hash1 = BlockchainService.canonicalize_order_terms(
        order_id="ORD-001",
        order_code="ORD-DK-123456",
        buyer_id="buyer-01",
        seller_id="farmer-a",
        items=items1,
        delivery_terms="Hub pickup in 48h",
        delivery_address="Mangaluru Hub",
        total_amount=40000.0,
        agreement_version=1
    )

    dict2, json2, hash2 = BlockchainService.canonicalize_order_terms(
        order_id="ORD-001",
        order_code="ORD-DK-123456",
        buyer_id="buyer-01",
        seller_id="farmer-a",
        items=items2,
        delivery_terms="  Hub pickup in 48h  ",
        delivery_address="Mangaluru Hub",
        total_amount=40000.0,
        agreement_version=1
    )

    assert hash1 == hash2, "Canonical hash must be identical for logically equivalent inputs"
    assert hash1.startswith("0x")
    assert len(hash1) == 66  # 0x + 64 hex chars (32 bytes)
    assert json1 == json2

def test_canonicalize_order_terms_sensitivity():
    """Different terms or amounts must produce different hashes."""
    _, _, hash1 = BlockchainService.canonicalize_order_terms(
        order_id="ORD-001",
        order_code="ORD-DK-123456",
        buyer_id="buyer-01",
        seller_id="farmer-01",
        items=[{"contributing_farmer_id": "farmer-01", "crop_name": "Tomato", "quantity": 50, "unit": "kg", "unit_price": 40, "subtotal": 2000}],
        delivery_terms="Door delivery",
        delivery_address="Bantwal",
        total_amount=2000.0,
        agreement_version=1
    )

    _, _, hash_different_price = BlockchainService.canonicalize_order_terms(
        order_id="ORD-001",
        order_code="ORD-DK-123456",
        buyer_id="buyer-01",
        seller_id="farmer-01",
        items=[{"contributing_farmer_id": "farmer-01", "crop_name": "Tomato", "quantity": 50, "unit": "kg", "unit_price": 42, "subtotal": 2100}],
        delivery_terms="Door delivery",
        delivery_address="Bantwal",
        total_amount=2100.0,
        agreement_version=1
    )

    _, _, hash_different_version = BlockchainService.canonicalize_order_terms(
        order_id="ORD-001",
        order_code="ORD-DK-123456",
        buyer_id="buyer-01",
        seller_id="farmer-01",
        items=[{"contributing_farmer_id": "farmer-01", "crop_name": "Tomato", "quantity": 50, "unit": "kg", "unit_price": 40, "subtotal": 2000}],
        delivery_terms="Door delivery",
        delivery_address="Bantwal",
        total_amount=2000.0,
        agreement_version=2
    )

    assert hash1 != hash_different_price
    assert hash1 != hash_different_version

# -------------------------------------------------------------
# B. Order Creation & On-Chain Anchoring Integration Tests
# -------------------------------------------------------------
def test_order_creation_anchors_agreement_and_creates_version(client, db_session):
    buyer = create_test_user(db_session, "buyer1@example.com", "buyer", "Udupi Restaurant")
    farmer = create_test_user(db_session, "farmer1@example.com", "farmer", "Ramesh Gowda")
    listing = create_test_listing(db_session, farmer.id, qty=80.0, price=350.0)

    token = create_access_token(buyer.id, buyer.role)
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "listing_id": listing.id,
        "quantity": 20.0,
        "delivery_terms": "Standard delivery to central store",
        "delivery_address": "Main Road, Mangaluru"
    }

    resp = client.post("/api/v1/orders", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()

    assert data["order_code"].startswith("ORD-DK-")
    assert data["agreement_hash"].startswith("0x")
    assert data["agreement_version"] == 1
    assert data["blockchain_tx_hash"] is not None
    assert data["contract_address"] is not None
    assert data["network_identifier"] in ["31337", "hardhat_local"]

    # Verify that OrderAgreementVersion was created in DB
    versions = db_session.query(OrderAgreementVersion).filter(OrderAgreementVersion.order_id == data["id"]).all()
    assert len(versions) == 1
    assert versions[0].version == 1
    assert versions[0].is_current is True
    assert versions[0].agreement_hash == data["agreement_hash"]

    # Verify that BlockchainTxReference was created
    tx_refs = db_session.query(BlockchainTxReference).filter(BlockchainTxReference.order_id == data["id"]).all()
    assert len(tx_refs) >= 1
    assert tx_refs[0].action_type in ["registerOrder", "anchorOrderAgreement"]

def test_verify_order_agreement_on_chain(client, db_session):
    buyer = create_test_user(db_session, "buyer2@example.com", "buyer", "Coastal Kitchen")
    farmer = create_test_user(db_session, "farmer2@example.com", "farmer", "Suresh Kumar")
    listing = create_test_listing(db_session, farmer.id, qty=50.0, price=200.0)

    token = create_access_token(buyer.id, buyer.role)
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = client.post("/api/v1/orders", json={
        "listing_id": listing.id,
        "quantity": 10.0,
        "delivery_terms": "Direct delivery",
        "delivery_address": "Surathkal"
    }, headers=headers)
    assert create_resp.status_code == 201
    order_id = create_resp.json()["id"]

    # Verify on-chain endpoint
    verify_resp = client.get(f"/api/v1/orders/{order_id}/verify-on-chain", headers=headers)
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()

    assert v_data["is_registered_on_chain"] is True
    assert v_data["hash_match"] is True
    assert v_data["off_chain_hash"] == create_resp.json()["agreement_hash"]
    assert "Verified" in v_data["on_chain_status"] or "match" in v_data["verification_message"].lower()

# -------------------------------------------------------------
# C. Agreement Versioning (No Silent Overwrites)
# -------------------------------------------------------------
def test_amend_order_terms_creates_new_version_and_hash(client, db_session):
    buyer = create_test_user(db_session, "buyer3@example.com", "buyer", "Mangalore Cafe")
    farmer = create_test_user(db_session, "farmer3@example.com", "farmer", "Venkatesh Rao")
    listing = create_test_listing(db_session, farmer.id, qty=100.0, price=150.0)

    token = create_access_token(buyer.id, buyer.role)
    headers = {"Authorization": f"Bearer {token}"}

    order_resp = client.post("/api/v1/orders", json={
        "listing_id": listing.id,
        "quantity": 15.0,
        "delivery_terms": "Initial delivery terms: Day shift",
        "delivery_address": "City Center"
    }, headers=headers)
    order_data = order_resp.json()
    order_id = order_data["id"]
    initial_hash = order_data["agreement_hash"]

    # Amend terms
    amend_resp = client.post(f"/api/v1/orders/{order_id}/amend-terms", json={
        "new_delivery_terms": "Amended delivery terms: Deliver by 6:00 AM before morning opening",
        "new_delivery_address": "City Center Loading Bay 2",
        "reason": "Kitchen opening schedule shifted earlier"
    }, headers=headers)
    assert amend_resp.status_code == 200
    amended_data = amend_resp.json()

    assert amended_data["agreement_version"] == 2
    assert amended_data["agreement_hash"] != initial_hash
    assert amended_data["delivery_terms"] == "Amended delivery terms: Deliver by 6:00 AM before morning opening"

    # Query versions endpoint
    versions_resp = client.get(f"/api/v1/orders/{order_id}/versions", headers=headers)
    assert versions_resp.status_code == 200
    versions = versions_resp.json()

    assert len(versions) == 2
    assert versions[0]["version"] == 1
    assert versions[0]["is_current"] is False
    assert versions[0]["agreement_hash"] == initial_hash
    assert versions[1]["version"] == 2
    assert versions[1]["is_current"] is True
    assert versions[1]["agreement_hash"] == amended_data["agreement_hash"]

# -------------------------------------------------------------
# D. Smart-Contract Escrow Demonstration Tests
# -------------------------------------------------------------
def test_escrow_deposit_release_and_refund_lifecycle(client, db_session):
    buyer = create_test_user(db_session, "buyer4@example.com", "buyer", "Seafood Bistro")
    farmer = create_test_user(db_session, "farmer4@example.com", "farmer", "Anand Poojary")
    listing = create_test_listing(db_session, farmer.id, qty=40.0, price=250.0)

    buyer_token = create_access_token(buyer.id, buyer.role)
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}
    farmer_token = create_access_token(farmer.id, farmer.role)
    farmer_headers = {"Authorization": f"Bearer {farmer_token}"}

    # 1. Create order
    order_resp = client.post("/api/v1/orders", json={
        "listing_id": listing.id,
        "quantity": 10.0,
        "delivery_terms": "Cold chain transport",
        "delivery_address": "Kadri, Mangaluru"
    }, headers=buyer_headers)
    order_id = order_resp.json()["id"]

    # 2. Deposit test tokens
    deposit_resp = client.post(f"/api/v1/orders/{order_id}/escrow/deposit", headers=buyer_headers)
    assert deposit_resp.status_code == 200
    dep_data = deposit_resp.json()

    assert dep_data["action"] == "deposit"
    assert dep_data["status"] == "confirmed"
    assert dep_data["is_demonstration"] is True
    assert dep_data["disclaimer"] == TEST_TOKEN_DISCLAIMER
    assert dep_data["amount"] == 2500.0  # 10 kg * ₹250

    # Verify order status updated
    order_db = db_session.query(Order).filter(Order.id == order_id).first()
    assert order_db.escrow_status == "deposited"
    assert order_db.order_status == "escrow_funded"

    # 3. Farmer attempts unauthorized early release (should be forbidden: only buyer/admin can release)
    unauthorized_rel = client.post(f"/api/v1/orders/{order_id}/escrow/release", headers=farmer_headers)
    assert unauthorized_rel.status_code == 403

    # 4. Buyer authorizes release upon fulfillment
    release_resp = client.post(f"/api/v1/orders/{order_id}/escrow/release", headers=buyer_headers)
    assert release_resp.status_code == 200
    rel_data = release_resp.json()

    assert rel_data["action"] == "release"
    assert rel_data["status"] == "confirmed"
    assert rel_data["is_demonstration"] is True

    db_session.refresh(order_db)
    assert order_db.escrow_status == "released"
    assert order_db.order_status == "completed"

def test_escrow_refund_upon_cancellation(client, db_session):
    buyer = create_test_user(db_session, "buyer5@example.com", "buyer", "Hotel Taj Gateway")
    farmer = create_test_user(db_session, "farmer5@example.com", "farmer", "Subhash Shetty")
    listing = create_test_listing(db_session, farmer.id, qty=60.0, price=180.0)

    buyer_token = create_access_token(buyer.id, buyer.role)
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}
    farmer_token = create_access_token(farmer.id, farmer.role)
    farmer_headers = {"Authorization": f"Bearer {farmer_token}"}

    # 1. Create order & deposit
    order_resp = client.post("/api/v1/orders", json={
        "listing_id": listing.id,
        "quantity": 10.0,
        "delivery_terms": "Doorstep",
        "delivery_address": "State Bank, Mangaluru"
    }, headers=buyer_headers)
    order_id = order_resp.json()["id"]

    client.post(f"/api/v1/orders/{order_id}/escrow/deposit", headers=buyer_headers)

    # 2. Farmer agrees to refund / cancel
    refund_resp = client.post(f"/api/v1/orders/{order_id}/escrow/refund", headers=farmer_headers)
    assert refund_resp.status_code == 200
    ref_data = refund_resp.json()

    assert ref_data["action"] == "refund"
    assert ref_data["status"] == "confirmed"

    order_db = db_session.query(Order).filter(Order.id == order_id).first()
    assert order_db.escrow_status == "refunded"
    assert order_db.order_status == "cancelled"

# -------------------------------------------------------------
# E. Produce Traceability Tests
# -------------------------------------------------------------
def test_produce_traceability_lifecycle(client, db_session):
    buyer = create_test_user(db_session, "buyer6@example.com", "buyer", "Green Grocers")
    farmer = create_test_user(db_session, "farmer6@example.com", "farmer", "Devdas Hegde")
    admin = create_test_user(db_session, "admin1@example.com", "admin", "APMC Yard Officer")
    listing = create_test_listing(db_session, farmer.id, crop_name="Puttur Banana", qty=100.0, price=45.0)

    buyer_token = create_access_token(buyer.id, buyer.role)
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}
    farmer_token = create_access_token(farmer.id, farmer.role)
    farmer_headers = {"Authorization": f"Bearer {farmer_token}"}
    admin_token = create_access_token(admin.id, admin.role)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create order
    order_resp = client.post("/api/v1/orders", json={
        "listing_id": listing.id,
        "quantity": 25.0,
        "delivery_terms": "Direct farm pickup",
        "delivery_address": "Puttur Farm Gate"
    }, headers=buyer_headers)
    order_id = order_resp.json()["id"]

    # 1. Farmer records harvest (Self-reported)
    harvest_resp = client.post("/api/v1/traceability/events", json={
        "order_id": order_id,
        "stage_name": "harvest",
        "location": "Puttur Farm Plot 4B",
        "quality_grade": "Grade A",
        "notes": "Harvested early morning at 6:30 AM with optimal maturity",
        "is_independently_verified": False,
        "verification_source": "Self-reported by Farmer"
    }, headers=farmer_headers)
    assert harvest_resp.status_code == 201
    h_data = harvest_resp.json()
    assert h_data["stage_name"] == "harvest"
    assert h_data["is_independently_verified"] is False
    assert h_data["event_hash"].startswith("0x")
    assert h_data["on_chain_tx_hash"] is not None

    # 2. APMC / Admin logs independent quality audit at packing
    pack_resp = client.post("/api/v1/traceability/events", json={
        "order_id": order_id,
        "stage_name": "packing",
        "location": "Bantwal APMC Aggregation Center",
        "quality_grade": "Grade A Certified",
        "notes": "Official inspection passed: moisture content and uniform weight verified",
        "is_independently_verified": True,
        "verification_source": "APMC Yard Inspector #DK-09"
    }, headers=admin_headers)
    assert pack_resp.status_code == 201
    p_data = pack_resp.json()
    assert p_data["stage_name"] == "packing"
    assert p_data["is_independently_verified"] is True
    assert p_data["verification_source"] == "APMC Yard Inspector #DK-09"

    # 3. Unauthorized user (buyer) attempts to log harvest (should be forbidden)
    unauthorized_harvest = client.post("/api/v1/traceability/events", json={
        "order_id": order_id,
        "stage_name": "harvest",
        "location": "Puttur",
        "quality_grade": "Grade A"
    }, headers=buyer_headers)
    assert unauthorized_harvest.status_code == 403

    # 4. Buyer confirms receipt
    receipt_resp = client.post("/api/v1/traceability/events", json={
        "order_id": order_id,
        "stage_name": "receipt",
        "location": "Green Grocers Central Receiving Dock",
        "quality_grade": "Grade A Received",
        "notes": "Produce inspected upon unload; crate seals intact"
    }, headers=buyer_headers)
    assert receipt_resp.status_code == 201

    # 5. Retrieve full chronological traceability timeline
    timeline_resp = client.get(f"/api/v1/traceability/{order_id}", headers=buyer_headers)
    assert timeline_resp.status_code == 200
    timeline = timeline_resp.json()

    assert len(timeline) == 3
    assert timeline[0]["stage_name"] == "harvest"
    assert timeline[0]["is_independently_verified"] is False
    assert timeline[1]["stage_name"] == "packing"
    assert timeline[1]["is_independently_verified"] is True
    assert timeline[2]["stage_name"] == "receipt"
