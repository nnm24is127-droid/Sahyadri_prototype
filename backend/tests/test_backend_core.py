import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import Base, get_db

from sqlalchemy.pool import StaticPool

# Use shared in-memory SQLite database with StaticPool for isolated test execution
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

def test_health_and_readiness_endpoints(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "FarmConnect AI" in data["project"]

    ready_res = client.get("/api/v1/ready")
    assert ready_res.status_code == 200
    assert ready_res.json()["ready"] is True

def test_user_registration_and_login_flow(client):
    # 1. Register a Farmer
    farmer_payload = {
        "email": "farmer.ramesh@farmconnect.demo",
        "password": "SecurePassword123!",
        "full_name": "Ramesh Rai",
        "phone_number": "+91 98450 12345",
        "role": "farmer",
        "preferred_language": "kn",
        "district": "Dakshina Kannada",
        "taluk": "Bantwal"
    }
    reg_res = client.post("/api/v1/auth/register", json=farmer_payload)
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["role"] == "farmer"
    assert reg_data["user"]["email"] == "farmer.ramesh@farmconnect.demo"

    # 2. Duplicate registration rejection
    dup_res = client.post("/api/v1/auth/register", json=farmer_payload)
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"]

    # 3. Successful Login
    login_res = client.post("/api/v1/auth/login", json={
        "email": "farmer.ramesh@farmconnect.demo",
        "password": "SecurePassword123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # 4. Failed Login (Wrong password)
    fail_res = client.post("/api/v1/auth/login", json={
        "email": "farmer.ramesh@farmconnect.demo",
        "password": "WrongPassword"
    })
    assert fail_res.status_code == 401

    # 5. Fetch /auth/me with valid Bearer token
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["full_name"] == "Ramesh Rai"

def test_role_based_access_controls(client):
    # Register Farmer
    f_res = client.post("/api/v1/auth/register", json={
        "email": "farmer.ananda@farmconnect.demo",
        "password": "Password123!",
        "full_name": "Ananda Poojary",
        "phone_number": "+91 94812 45678",
        "role": "farmer",
        "taluk": "Udupi"
    })
    farmer_token = f_res.json()["access_token"]

    # Register Buyer
    b_res = client.post("/api/v1/auth/register", json={
        "email": "buyer.ocean@farmconnect.demo",
        "password": "Password123!",
        "full_name": "Ocean Pearl Procurement",
        "phone_number": "+91 824 249 1000",
        "role": "buyer",
        "taluk": "Mangalore"
    })
    buyer_token = b_res.json()["access_token"]

    # Test 1: Buyer tries to create a farm -> MUST FAIL 403 Forbidden
    buyer_farm_res = client.post("/api/v1/farms", json={
        "farm_name": "Illegal Buyer Farm",
        "total_area_acres": 2.0,
    }, headers={"Authorization": f"Bearer {buyer_token}"})
    assert buyer_farm_res.status_code == 403
    assert "Requires 'farmer' role" in buyer_farm_res.json()["detail"]

    # Test 2: Farmer successfully creates a farm
    farmer_farm_res = client.post("/api/v1/farms", json={
        "farm_name": "Mattu Gulla Fields",
        "total_area_acres": 2.5,
        "soil_type": "Coastal Alluvial",
        "irrigation_source": "Perennial Lake"
    }, headers={"Authorization": f"Bearer {farmer_token}"})
    assert farmer_farm_res.status_code == 201
    farm_id = farmer_farm_res.json()["id"]

    # Test 3: Farmer tries to create a bulk demand pool -> MUST FAIL 403 Forbidden
    farmer_pool_res = client.post("/api/v1/group-offers", json={
        "crop_name": "Arecanut",
        "target_quantity": 2000,
        "offered_unit_price": 465,
        "target_taluk": "Bantwal",
        "aggregation_hub_name": "Bantwal APMC"
    }, headers={"Authorization": f"Bearer {farmer_token}"})
    assert farmer_pool_res.status_code == 403
    assert "Requires 'buyer' role" in farmer_pool_res.json()["detail"]

    # Test 4: Buyer successfully creates a bulk demand pool
    buyer_pool_res = client.post("/api/v1/group-offers", json={
        "crop_name": "Arecanut",
        "target_quantity": 2000,
        "offered_unit_price": 465,
        "target_taluk": "Bantwal",
        "aggregation_hub_name": "Bantwal APMC"
    }, headers={"Authorization": f"Bearer {buyer_token}"})
    assert buyer_pool_res.status_code == 201
    assert buyer_pool_res.json()["status"] == "open"

def test_data_privacy_and_ownership_enforcement(client):
    # Register Farmer A
    f1 = client.post("/api/v1/auth/register", json={
        "email": "farmer1@farmconnect.demo",
        "password": "Password123!",
        "full_name": "Farmer One",
        "phone_number": "+91 99000 11111",
        "role": "farmer",
        "taluk": "Bantwal"
    }).json()

    # Register Farmer B
    f2 = client.post("/api/v1/auth/register", json={
        "email": "farmer2@farmconnect.demo",
        "password": "Password123!",
        "full_name": "Farmer Two",
        "phone_number": "+91 99000 22222",
        "role": "farmer",
        "taluk": "Puttur"
    }).json()

    # Farmer A creates a farm
    farm_a = client.post("/api/v1/farms", json={
        "farm_name": "Farmer A Farm",
        "total_area_acres": 3.0
    }, headers={"Authorization": f"Bearer {f1['access_token']}"}).json()

    # Farmer B attempts to edit Farmer A's farm -> MUST FAIL 403 Forbidden
    hack_res = client.put(f"/api/v1/farms/{farm_a['id']}", json={
        "farm_name": "Hijacked Farm"
    }, headers={"Authorization": f"Bearer {f2['access_token']}"})
    assert hack_res.status_code == 403
    assert "You do not own this farm" in hack_res.json()["detail"]

    # Farmer B attempts to view Farmer A's private user record -> MUST FAIL 403 Forbidden
    profile_hack_res = client.get(f"/api/v1/users/{f1['user']['id']}", headers={"Authorization": f"Bearer {f2['access_token']}"})
    assert profile_hack_res.status_code == 403

def test_orders_state_machine_and_agreement_hash(client):
    # 1. Register Farmer
    farmer = client.post("/api/v1/auth/register", json={
        "email": "farmer.ramesh2@farmconnect.demo",
        "password": "Password123!",
        "full_name": "Ramesh Rai",
        "phone_number": "+91 98450 12345",
        "role": "farmer",
        "taluk": "Bantwal"
    }).json()

    # 2. Farmer creates a produce listing (500 kg Arecanut @ Rs 460/kg)
    listing = client.post("/api/v1/listings", json={
        "crop_name": "Arecanut (Chali)",
        "category": "plantation",
        "total_quantity": 500,
        "price_per_unit": 460,
        "harvest_date": "2026-10-15",
        "taluk": "Bantwal"
    }, headers={"Authorization": f"Bearer {farmer['access_token']}"}).json()

    # 3. Register Buyer
    buyer = client.post("/api/v1/auth/register", json={
        "email": "procurement@oceanpearl.demo",
        "password": "Password123!",
        "full_name": "Ocean Pearl Hotel",
        "phone_number": "+91 824 249 1000",
        "role": "buyer",
        "taluk": "Mangalore"
    }).json()

    # 4. Buyer places an order for 200 kg
    order_res = client.post("/api/v1/orders", json={
        "listing_id": listing["id"],
        "quantity": 200,
        "delivery_terms": "Direct farm collection",
        "delivery_address": "Navabharath Circle, Mangalore"
    }, headers={"Authorization": f"Bearer {buyer['access_token']}"})
    assert order_res.status_code == 201
    order = order_res.json()
    assert order["total_amount"] == 92000.0  # 200 * 460
    assert order["order_status"] == "created"
    assert order["agreement_hash"].startswith("0x")
    assert len(order["agreement_hash"]) == 66  # SHA-256 with 0x prefix

    # 5. Check remaining listing stock was deducted (500 - 200 = 300)
    listing_check = client.get(f"/api/v1/listings/{listing['id']}").json()
    assert listing_check["available_quantity"] == 300.0

    # 6. Test illegal transition (created -> delivered directly without confirmation/escrow)
    illegal_res = client.post(f"/api/v1/orders/{order['id']}/transition", json={
        "new_status": "delivered"
    }, headers={"Authorization": f"Bearer {buyer['access_token']}"})
    assert illegal_res.status_code == 400
    assert "Invalid state transition" in illegal_res.json()["detail"]

    # 7. Valid transition: Seller confirms order
    confirm_res = client.post(f"/api/v1/orders/{order['id']}/transition", json={
        "new_status": "confirmed"
    }, headers={"Authorization": f"Bearer {farmer['access_token']}"})
    assert confirm_res.status_code == 200
    assert confirm_res.json()["order_status"] == "confirmed"

    # 8. Valid transition: Buyer funds escrow
    escrow_res = client.post(f"/api/v1/orders/{order['id']}/transition", json={
        "new_status": "escrow_funded"
    }, headers={"Authorization": f"Bearer {buyer['access_token']}"})
    assert escrow_res.status_code == 200
    assert escrow_res.json()["order_status"] == "escrow_funded"
    assert escrow_res.json()["escrow_status"] == "deposited"
