import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.database import Base, get_db

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

def test_valid_registered_farmer_and_buyer_credentials(client):
    # 1. Valid registered farmer credentials succeed
    f_res = client.post("/api/v1/auth/register", json={
        "email": "farmer.valid@farmconnect.demo",
        "password": "FarmerPassword123!",
        "full_name": "Ramesh Kumar Rai",
        "phone_number": "+91 98451 11223",
        "role": "farmer",
        "taluk": "Bantwal"
    })
    assert f_res.status_code == 201
    f_data = f_res.json()
    assert f_data["user"]["role"] == "farmer"
    assert "access_token" in f_data

    # Farmer logs in with registered credentials
    f_login = client.post("/api/v1/auth/login", json={
        "email": "farmer.valid@farmconnect.demo",
        "password": "FarmerPassword123!"
    })
    assert f_login.status_code == 200
    assert f_login.json()["user"]["full_name"] == "Ramesh Kumar Rai"

    # 2. Valid registered buyer credentials succeed
    b_res = client.post("/api/v1/auth/register", json={
        "email": "buyer.valid@farmconnect.demo",
        "password": "BuyerPassword123!",
        "full_name": "Ocean Pearl Procurement",
        "phone_number": "+91 94481 99887",
        "role": "buyer",
        "taluk": "Mangalore"
    })
    assert b_res.status_code == 201
    b_data = b_res.json()
    assert b_data["user"]["role"] == "buyer"

    # Buyer logs in with registered credentials
    b_login = client.post("/api/v1/auth/login", json={
        "email": "buyer.valid@farmconnect.demo",
        "password": "BuyerPassword123!"
    })
    assert b_login.status_code == 200
    assert b_login.json()["user"]["role"] == "buyer"

def test_unknown_email_and_wrong_password_fail(client):
    # Register an account
    client.post("/api/v1/auth/register", json={
        "email": "existing@farmconnect.demo",
        "password": "CorrectPassword123!",
        "full_name": "Real User",
        "phone_number": "+91 99000 00000",
        "role": "farmer",
        "taluk": "Bantwal"
    })

    # Unknown email fails (401)
    unknown_res = client.post("/api/v1/auth/login", json={
        "email": "unknown.person@nonexistent.org",
        "password": "CorrectPassword123!"
    })
    assert unknown_res.status_code == 401
    assert "Incorrect email or password" in unknown_res.json()["detail"]

    # Wrong password fails (401)
    wrong_pw_res = client.post("/api/v1/auth/login", json={
        "email": "existing@farmconnect.demo",
        "password": "WrongPassword999!"
    })
    assert wrong_pw_res.status_code == 401
    assert "Incorrect email or password" in wrong_pw_res.json()["detail"]

def test_empty_or_malformed_credentials_fail(client):
    # Empty email
    res1 = client.post("/api/v1/auth/login", json={
        "email": "",
        "password": "SomePassword"
    })
    assert res1.status_code in [400, 422]

    # Malformed email
    res2 = client.post("/api/v1/auth/login", json={
        "email": "not-an-email",
        "password": "SomePassword"
    })
    assert res2.status_code in [400, 422]

def test_duplicate_email_registration_fails(client):
    payload = {
        "email": "duplicate@farmconnect.demo",
        "password": "Password123!",
        "full_name": "First Registrant",
        "phone_number": "+91 99000 12345",
        "role": "farmer",
        "taluk": "Bantwal"
    }
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    # Second registration with identical email (case-insensitive) fails
    dup_payload = {**payload, "email": "DUPLICATE@farmconnect.demo", "full_name": "Second Registrant"}
    res2 = client.post("/api/v1/auth/register", json=dup_payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]

def test_public_user_cannot_register_as_admin(client):
    admin_attempt = {
        "email": "hacker@farmconnect.demo",
        "password": "HackerPassword123!",
        "full_name": "Fake Admin",
        "phone_number": "+91 99999 99999",
        "role": "admin",
        "taluk": "Mangalore"
    }
    res = client.post("/api/v1/auth/register", json=admin_attempt)
    assert res.status_code == 400
    assert "restricted" in res.json()["detail"].lower() or "administrator" in res.json()["detail"].lower()

def test_farmer_cannot_access_protected_admin_endpoints(client):
    # Register Farmer
    f_res = client.post("/api/v1/auth/register", json={
        "email": "farmer.strict@farmconnect.demo",
        "password": "FarmerPassword123!",
        "full_name": "Strict Farmer",
        "phone_number": "+91 98451 00000",
        "role": "farmer",
        "taluk": "Bantwal"
    })
    token = f_res.json()["access_token"]

    # Attempt to access admin moderation overview
    admin_res = client.get("/api/v1/admin/overview", headers={"Authorization": f"Bearer {token}"})
    assert admin_res.status_code == 403
    assert "admin" in admin_res.json()["detail"].lower()

def test_buyer_cannot_access_farmer_operations(client):
    # Register Buyer
    b_res = client.post("/api/v1/auth/register", json={
        "email": "buyer.strict@farmconnect.demo",
        "password": "BuyerPassword123!",
        "full_name": "Strict Buyer",
        "phone_number": "+91 94481 00000",
        "role": "buyer",
        "taluk": "Mangalore"
    })
    token = b_res.json()["access_token"]

    # Attempt to create a farm
    farm_res = client.post("/api/v1/farms", json={
        "farm_name": "Unauthorized Farm",
        "total_area_acres": 5.0
    }, headers={"Authorization": f"Bearer {token}"})
    assert farm_res.status_code == 403
    assert "farmer" in farm_res.json()["detail"].lower()

def test_invalid_or_expired_token_rejected(client):
    fake_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.signature"
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {fake_token}"})
    assert res.status_code == 401
