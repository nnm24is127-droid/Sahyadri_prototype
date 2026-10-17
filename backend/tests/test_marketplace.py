import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.models.models import User, Farm, ProduceListing, MarketPriceReference, Order, OrderItem

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Seed an APMC benchmark price reference for Mangalore / Shankarapura Jasmine & Vegetables
        ref1 = MarketPriceReference(
            crop_name="Organic Robusta Banana",
            variety="Robusta G9",
            district="Dakshina Kannada",
            market_yard="Bantwal APMC",
            min_price=22.0,
            modal_price=26.0,
            max_price=30.0,
            unit="kg",
            data_source="Karnataka State Agricultural Marketing Board (KSAMB)",
            is_demonstration_data=True
        )
        db.add(ref1)
        db.commit()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

def get_auth_token(client: TestClient, email: str, role: str = "farmer"):
    reg_payload = {
        "email": email,
        "password": "Password123!",
        "full_name": f"User {role.capitalize()}",
        "phone_number": "+91 98450 00000",
        "role": role,
        "preferred_language": "kn",
        "district": "Dakshina Kannada",
        "taluk": "Bantwal"
    }
    client.post("/api/v1/auth/register", json=reg_payload)
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    return login_res.json()["access_token"]

def test_farmer_listing_lifecycle_and_filters(client):
    farmer_token = get_auth_token(client, "farmer1@farmconnect.demo", role="farmer")
    farmer_headers = {"Authorization": f"Bearer {farmer_token}"}

    other_token = get_auth_token(client, "farmer2@farmconnect.demo", role="farmer")
    other_headers = {"Authorization": f"Bearer {other_token}"}

    # 1. Farmer creates listing
    listing_payload = {
        "crop_name": "Organic Robusta Banana",
        "crop_kannada": "ರೋಬಸ್ಟಾ ಬಾಳೆಹಣ್ಣು",
        "variety": "Robusta G9",
        "category": "Fruits",
        "total_quantity": 200.0,
        "unit": "kg",
        "minimum_order_quantity": 10.0,
        "price_per_unit": 28.0,
        "quality_grade": "Grade A (Premium)",
        "quality_notes": "Naturally ripened on tree, no carbide, rich sweetness.",
        "organic_certified": True,
        "harvest_date": "2026-10-18",
        "sale_deadline": "2026-10-25",
        "shelf_life_days": 8,
        "district": "Dakshina Kannada",
        "taluk": "Bantwal",
        "allow_group_pooling": True,
        "status": "active"
    }
    res = client.post("/api/v1/listings", json=listing_payload, headers=farmer_headers)
    assert res.status_code == 201
    listing = res.json()
    listing_id = listing["id"]
    assert listing["crop_name"] == "Organic Robusta Banana"
    assert listing["available_quantity"] == 200.0
    assert listing["quality_notes"] == "Naturally ripened on tree, no carbide, rich sweetness."
    assert listing["sale_deadline"] == "2026-10-25"
    assert listing["market_price_reference"] is not None
    assert listing["market_price_reference"]["modal_price"] == 26.0
    assert listing["market_price_reference"]["is_demonstration_data"] is True

    # 2. Unauthorized farmer cannot edit another's listing
    unauth_edit = client.put(f"/api/v1/listings/{listing_id}", json={"price_per_unit": 25.0}, headers=other_headers)
    assert unauth_edit.status_code == 403

    # 3. Owning farmer edits listing
    edit_res = client.put(f"/api/v1/listings/{listing_id}", json={"price_per_unit": 27.5, "quality_grade": "Grade A+"}, headers=farmer_headers)
    assert edit_res.status_code == 200
    assert edit_res.json()["price_per_unit"] == 27.5
    assert edit_res.json()["quality_grade"] == "Grade A+"

    # 4. Farmer pauses listing
    pause_res = client.patch(f"/api/v1/listings/{listing_id}/status", json={"status": "paused"}, headers=farmer_headers)
    assert pause_res.status_code == 200
    assert pause_res.json()["status"] == "paused"

    # 5. Public active listings search should NOT return paused listing
    pub_res = client.get("/api/v1/listings")
    assert pub_res.status_code == 200
    assert not any(l["id"] == listing_id for l in pub_res.json())

    # Farmer's mine endpoint DOES return paused listing
    mine_res = client.get("/api/v1/listings/mine", headers=farmer_headers)
    assert mine_res.status_code == 200
    assert any(l["id"] == listing_id and l["status"] == "paused" for l in mine_res.json())

    # 6. Farmer re-publishes listing
    pub_res = client.patch(f"/api/v1/listings/{listing_id}/status", json={"status": "active"}, headers=farmer_headers)
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "active"

    # 7. Multi-filter search test
    filtered = client.get("/api/v1/listings?crop_name=Banana&category=Fruits&district=Dakshina+Kannada&min_quantity=50&max_price=30")
    assert filtered.status_code == 200
    assert len(filtered.json()) >= 1
    assert filtered.json()[0]["id"] == listing_id

    # Filter with quantity higher than available returns empty
    empty_filtered = client.get("/api/v1/listings?min_quantity=500")
    assert empty_filtered.status_code == 200
    assert len(empty_filtered.json()) == 0

def test_buyer_order_validation_and_overselling_prevention(client):
    farmer_token = get_auth_token(client, "seller.farmer@farmconnect.demo", role="farmer")
    buyer_token = get_auth_token(client, "buyer.restaurant@farmconnect.demo", role="buyer")

    farmer_headers = {"Authorization": f"Bearer {farmer_token}"}
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}

    # Create listing with exactly 100 kg stock and MOQ 15 kg
    listing_res = client.post("/api/v1/listings", json={
        "crop_name": "Fresh Mattu Gulla Brinjal",
        "category": "Vegetables",
        "total_quantity": 100.0,
        "unit": "kg",
        "minimum_order_quantity": 15.0,
        "price_per_unit": 45.0,
        "quality_grade": "GI Certified Mattu Gulla",
        "harvest_date": "2026-10-18",
        "taluk": "Udupi",
        "status": "active"
    }, headers=farmer_headers)
    assert listing_res.status_code == 201
    listing_id = listing_res.json()["id"]

    # Test 1: Buyer requests less than MOQ (10 kg < 15 kg) -> 400
    sub_moq_res = client.post("/api/v1/orders", json={
        "listing_id": listing_id,
        "quantity": 10.0,
        "delivery_terms": "Doorstep delivery to hotel kitchen",
        "delivery_address": "Main Road, Udupi"
    }, headers=buyer_headers)
    assert sub_moq_res.status_code == 400
    assert "minimum order quantity" in sub_moq_res.json()["detail"].lower()

    # Test 2: Buyer requests more than available stock (150 kg > 100 kg) -> 400
    oversell_res = client.post("/api/v1/orders", json={
        "listing_id": listing_id,
        "quantity": 150.0,
        "delivery_terms": "Doorstep delivery",
        "delivery_address": "Main Road, Udupi"
    }, headers=buyer_headers)
    assert oversell_res.status_code == 400
    assert "exceeds available stock" in oversell_res.json()["detail"].lower()

    # Test 3: Buyer places valid order for 60 kg -> 201
    order1_res = client.post("/api/v1/orders", json={
        "listing_id": listing_id,
        "quantity": 60.0,
        "delivery_terms": "Delivered in sanitized crates",
        "delivery_address": "Hotel Woodlands, Mangalore"
    }, headers=buyer_headers)
    assert order1_res.status_code == 201
    order1 = order1_res.json()
    assert order1["total_amount"] == 2700.0
    assert order1["buyer_confirmed"] is True
    assert order1["farmer_confirmed"] is False
    assert order1["order_status"] == "created"
    assert len(order1["items"]) == 1
    assert order1["items"][0]["quantity"] == 60.0

    # Verify listing stock decreased to 40 kg
    l_after_order1 = client.get(f"/api/v1/listings/{listing_id}").json()
    assert l_after_order1["available_quantity"] == 40.0
    assert l_after_order1["status"] == "active"

    # Test 4: Second order for remaining 40 kg -> 201, listing marked sold_out
    order2_res = client.post("/api/v1/orders", json={
        "listing_id": listing_id,
        "quantity": 40.0,
        "delivery_terms": "Immediate dispatch",
        "delivery_address": "Catering Hub, Udupi"
    }, headers=buyer_headers)
    assert order2_res.status_code == 201
    assert order2_res.json()["order_status"] == "created"

    l_after_order2 = client.get(f"/api/v1/listings/{listing_id}").json()
    assert l_after_order2["available_quantity"] == 0.0
    assert l_after_order2["status"] == "sold_out"

    # Test 5: Third order attempts to buy from sold_out listing -> 400
    order3_res = client.post("/api/v1/orders", json={
        "listing_id": listing_id,
        "quantity": 15.0,
        "delivery_terms": "Any delivery",
        "delivery_address": "Somewhere"
    }, headers=buyer_headers)
    assert order3_res.status_code == 400
    assert "not available" in order3_res.json()["detail"].lower()

def test_order_cancellation_and_inventory_restoration(client):
    farmer_token = get_auth_token(client, "cancel.farmer@farmconnect.demo", role="farmer")
    buyer_token = get_auth_token(client, "cancel.buyer@farmconnect.demo", role="buyer")

    farmer_headers = {"Authorization": f"Bearer {farmer_token}"}
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}

    # Create listing with 50 kg
    listing_res = client.post("/api/v1/listings", json={
        "crop_name": "Byadagi Chilli (Coastal Grade)",
        "category": "Spices",
        "total_quantity": 50.0,
        "unit": "kg",
        "price_per_unit": 220.0,
        "harvest_date": "2026-10-15",
        "taluk": "Bantwal",
        "status": "active"
    }, headers=farmer_headers)
    listing_id = listing_res.json()["id"]

    # Buyer places order for 50 kg (all available stock)
    order_res = client.post("/api/v1/orders", json={
        "listing_id": listing_id,
        "quantity": 50.0,
        "delivery_terms": "Jute bag packaging",
        "delivery_address": "Spice Market, Mangalore"
    }, headers=buyer_headers)
    assert order_res.status_code == 201
    order_id = order_res.json()["id"]

    # Verify listing is sold_out
    assert client.get(f"/api/v1/listings/{listing_id}").json()["status"] == "sold_out"
    assert client.get(f"/api/v1/listings/{listing_id}").json()["available_quantity"] == 0.0

    # Buyer cancels order with reason
    cancel_res = client.post(
        f"/api/v1/orders/{order_id}/cancel",
        json={"reason": "Change in catering event schedule"},
        headers=buyer_headers
    )
    assert cancel_res.status_code == 200
    cancelled_order = cancel_res.json()
    assert cancelled_order["order_status"] == "cancelled"
    assert cancelled_order["cancellation_reason"] == "Change in catering event schedule"

    # Verify inventory was restored and status reset to active!
    restored_listing = client.get(f"/api/v1/listings/{listing_id}").json()
    assert restored_listing["available_quantity"] == 50.0
    assert restored_listing["status"] == "active"

def test_mutual_confirmation_fulfillment_and_restricted_reviews(client):
    farmer_token = get_auth_token(client, "review.farmer@farmconnect.demo", role="farmer")
    buyer_token = get_auth_token(client, "review.buyer@farmconnect.demo", role="buyer")
    other_token = get_auth_token(client, "unrelated.user@farmconnect.demo", role="buyer")

    farmer_headers = {"Authorization": f"Bearer {farmer_token}"}
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}
    other_headers = {"Authorization": f"Bearer {other_token}"}

    # 1. Create listing
    listing_res = client.post("/api/v1/listings", json={
        "crop_name": "Mangalore Betel Leaves",
        "category": "Cash Crops",
        "total_quantity": 1000.0,
        "unit": "leaves",
        "price_per_unit": 1.5,
        "harvest_date": "2026-10-18",
        "taluk": "Belthangady",
        "status": "active"
    }, headers=farmer_headers)
    listing_id = listing_res.json()["id"]

    # 2. Buyer places order
    order_res = client.post("/api/v1/orders", json={
        "listing_id": listing_id,
        "quantity": 500.0,
        "delivery_terms": "Fresh green bundle wrapping",
        "delivery_address": "Temple Road, Dharmasthala"
    }, headers=buyer_headers)
    order_id = order_res.json()["id"]

    # 3. Try to submit review before completion -> MUST FAIL (400)
    premature_review = client.post("/api/v1/reviews", json={
        "order_id": order_id,
        "rating": 5,
        "comment": "Fast and prompt"
    }, headers=buyer_headers)
    assert premature_review.status_code == 400
    assert "only permitted for completed transactions" in premature_review.json()["detail"].lower()

    # 4. Farmer confirms order terms
    confirm_res = client.post(f"/api/v1/orders/{order_id}/confirm", headers=farmer_headers)
    assert confirm_res.status_code == 200
    assert confirm_res.json()["farmer_confirmed"] is True
    assert confirm_res.json()["order_status"] == "confirmed"

    # 5. Advance order to escrow_funded, in_transit, delivered, completed
    escrow_res = client.post(f"/api/v1/orders/{order_id}/transition", json={"new_status": "escrow_funded"}, headers=buyer_headers)
    assert escrow_res.status_code == 200
    assert escrow_res.json()["escrow_status"] == "deposited"
    assert escrow_res.json()["blockchain_tx_hash"] is not None

    transit_res = client.post(f"/api/v1/orders/{order_id}/transition", json={"new_status": "in_transit"}, headers=farmer_headers)
    assert transit_res.status_code == 200

    delivery_res = client.post(f"/api/v1/orders/{order_id}/transition", json={"new_status": "delivered"}, headers=buyer_headers)
    assert delivery_res.status_code == 200

    completed_res = client.post(f"/api/v1/orders/{order_id}/transition", json={"new_status": "completed"}, headers=farmer_headers)
    assert completed_res.status_code == 200
    assert completed_res.json()["order_status"] == "completed"
    assert completed_res.json()["escrow_status"] == "released"

    # 6. Unrelated user attempts to review this order -> MUST FAIL (403)
    unrelated_review = client.post("/api/v1/reviews", json={
        "order_id": order_id,
        "rating": 4,
        "comment": "Nice product"
    }, headers=other_headers)
    assert unrelated_review.status_code == 403

    # 7. Buyer submits valid review
    buyer_rev = client.post("/api/v1/reviews", json={
        "order_id": order_id,
        "rating": 5,
        "comment": "Exceptional quality betel leaves, properly packed and delivered on time."
    }, headers=buyer_headers)
    assert buyer_rev.status_code == 201
    review_data = buyer_rev.json()
    assert review_data["rating"] == 5
    assert review_data["reviewer_name"] == "User Buyer"

    # 8. Duplicate review by same buyer on same order -> MUST FAIL (400)
    dup_rev = client.post("/api/v1/reviews", json={
        "order_id": order_id,
        "rating": 5,
        "comment": "Submitting another review"
    }, headers=buyer_headers)
    assert dup_rev.status_code == 400
    assert "already submitted a review" in dup_rev.json()["detail"].lower()

    # 9. Seller also reviews the buyer
    seller_rev = client.post("/api/v1/reviews", json={
        "order_id": order_id,
        "rating": 5,
        "comment": "Prompt payment and clear delivery coordination."
    }, headers=farmer_headers)
    assert seller_rev.status_code == 201

    # 10. Fetch reviews for this order
    order_reviews = client.get(f"/api/v1/reviews/orders/{order_id}")
    assert order_reviews.status_code == 200
    assert len(order_reviews.json()) == 2
