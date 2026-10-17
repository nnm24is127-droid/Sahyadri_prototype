import pytest
from starlette.testclient import TestClient
from app.models.models import User
from app.core.security import get_password_hash, create_access_token
from app.core.database import SessionLocal


def register_user(client: TestClient, email: str, role: str, name: str, taluk: str = "Bantwal"):
    if role == "admin":
        from conftest import TestingSessionLocal
        db = TestingSessionLocal()
        admin_user = User(
            email=email.lower(),
            password_hash=get_password_hash("Password123!"),
            full_name=name,
            phone_number="+91 98888 11111",
            role="admin",
            taluk=taluk,
            is_active=True
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        token = create_access_token(subject=admin_user.id, role="admin")
        user_id = admin_user.id
        db.close()
        return token, user_id

    res = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": name,
        "phone_number": "+91 98888 11111",
        "role": role,
        "taluk": taluk
    })
    assert res.status_code == 201, res.text
    data = res.json()
    return data["access_token"], data["user"]["id"]


def test_journey_1_farmer_complete_workflow(client: TestClient):
    """
    Journey 1 — Farm owner:
    1. Register and log in.
    2. Open FarmForensics, create a crop investigation and save observations.
    3. Open FarmLab, create an experiment and record measurements.
    4. Create a produce listing, either manually or through Kannada voice input.
    5. Review the AI Price Assistant's comparison and its source information.
    6. Join a Smart Group Selling offer.
    7. Confirm the farmer's contribution to an accepted group order.
    8. Review the agreement hash, traceability history and transaction status.
    9. Complete the local test-token payment demonstration where appropriate.
    """
    # 1. Register & Log in
    token, farmer_id = register_user(client, "journey1.farmer@demo.com", "farmer", "Ramesh Rai", "Bantwal")
    login_res = client.post("/api/v1/auth/login", json={
        "email": "journey1.farmer@demo.com",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    headers = {"Authorization": f"Bearer {token}"}

    # Create a Farm record for this farmer
    farm_res = client.post("/api/v1/farms", json={
        "farm_name": "Rai Organic Plantations",
        "kannada_farm_alias": "ರೈ ಸಾವಯವ ತೋಟ",
        "total_area_acres": 4.5,
        "soil_type": "Coastal Laterite",
        "irrigation_source": "Borewell & Drip Irrigation"
    }, headers=headers)
    assert farm_res.status_code == 201
    farm_id = farm_res.json()["id"]

    # 2. FarmForensics: create investigation and record observations
    forensics_res = client.post("/api/v1/forensics/investigations", json={
        "farm_id": farm_id,
        "crop_name": "Arecanut (ಅಡಿಕೆ)",
        "symptoms_description": "Monsoon water rot and fruit dropping with white mycelium lesions",
        "affected_percentage": 25.0,
        "irrigation_details": "Rainfed Coastal Monsoon"
    }, headers=headers)
    assert forensics_res.status_code == 201
    case_data = forensics_res.json()
    case_id = case_data["id"]
    assert "Koleroga" in case_data["ai_preliminary_diagnosis"]
    assert case_data["ai_confidence_score"] >= 0.8
    assert "AI-assisted preliminary observation" in case_data["ai_disclaimer_notice"]

    # Add follow-up observation
    obs_res = client.post(f"/api/v1/forensics/investigations/{case_id}/observations", json={
        "action_taken": "Sprayed 1% Bordeaux mixture on bunches and tied aerated polythene covers",
        "treatment_type": "chemical_preventive",
        "spread_status": "contained",
        "notes": "Rain paused for 36 hours; treatment successfully adhered to nuts."
    }, headers=headers)
    assert obs_res.status_code == 200
    assert obs_res.json()["status"] == "monitoring"

    # 3. FarmLab: create experiment and record measurements
    lab_res = client.post("/api/v1/lab/experiments", json={
        "farm_id": farm_id,
        "title": "Neem Oil & Jeevamrutha Organic Bio-repellent on Mattu Gulla",
        "hypothesis": "Bi-weekly foliar application of Jeevamrutha reduces shoot borer infestation by 30% compared to untreated control",
        "crop_tested": "Mattu Gulla (Brinjal)",
        "control_method": "Plain water spray and manual weeding",
        "experimental_method": "Jeevamrutha (5%) foliar spray every 14 days",
        "plot_size_description": "2 plots of 0.25 acres each (100 plants per plot)",
        "duration_days": 45
    }, headers=headers)
    assert lab_res.status_code == 201
    exp_id = lab_res.json()["id"]

    meas_res = client.post(f"/api/v1/lab/experiments/{exp_id}/observations", json={
        "metric_name": "Infested Shoots per 10 Plants",
        "control_metric_value": 18.0,
        "experimental_metric_value": 7.0,
        "notes": "Experimental plot showed significantly less wilting and healthier foliage."
    }, headers=headers)
    assert meas_res.status_code == 200
    meas_data = meas_res.json()["observations"][-1]
    assert meas_data["numerical_difference"] == -11.0
    assert round(meas_data["percentage_change"], 1) == -61.1

    # 4. Produce Listing via Kannada Voice Parser & Direct Listing
    voice_parse = client.post("/api/v1/voice/parse-kannada", json={
        "transcript_kannada": "ನನ್ನಲ್ಲಿ 100 ಕೆಜಿ ಮಟ್ಟುಗುಳ್ಳ ಇದೆ, ಕೆಜಿಗೆ 65 ರೂಪಾಯಿ"
    }, headers=headers)
    assert voice_parse.status_code == 200
    parsed = voice_parse.json()
    assert "Mattu Gulla" in parsed["crop_name"]
    assert parsed["quantity"] == 100.0

    # Publish listing with parsed details
    listing_res = client.post("/api/v1/listings", json={
        "farm_id": farm_id,
        "crop_name": parsed["crop_name"],
        "category": "Vegetables",
        "total_quantity": parsed["quantity"],
        "unit": "kg",
        "minimum_order_quantity": 10.0,
        "price_per_unit": parsed["price_per_unit"],
        "district": "Dakshina Kannada",
        "taluk": "Bantwal",
        "harvest_date": "2026-10-18",
        "quality_grade": "Grade A (Premium)",
        "allow_group_pooling": True,
        "created_via_voice": True,
        "voice_transcript_kannada": "ನನ್ನಲ್ಲಿ 80 ಕೆಜಿ ಹಸಿ ಮೆಣಸಿನಕಾಯಿ ಇದೆ, ಕೆಜಿಗೆ 45 ರೂಪಾಯಿ"
    }, headers=headers)
    assert listing_res.status_code == 201

    # 5. Review AI Price Assistant comparison and source information
    pricing_res = client.post(
        "/api/v1/pricing/compare",
        json={
            "crop_name": "Tomato",
            "asking_price": 32.0,
            "unit": "kg",
            "district": "Dakshina Kannada",
            "taluk": "Bantwal"
        },
        headers=headers
    )
    assert pricing_res.status_code == 200
    pdata = pricing_res.json()
    assert pdata["has_reference_data"] is True
    assert pdata["reference_source"] is not None
    assert "APMC" in pdata["reference_market_yard"]
    assert pdata["reference_modal_price"] == 28.0
    assert pdata["difference"] == 4.0


def test_journey_2_and_3_with_150kg_tomato_e2e_scenario(client: TestClient):
    """
    Complete end-to-end test of the 150 kg Tomato Scenario:
    - Buyer needs 150 kg of tomatoes.
    - Farmer A contributes 40 kg @ Rs 28/kg.
    - Farmer B contributes 60 kg @ Rs 30/kg.
    - Farmer C contributes 50 kg @ Rs 29/kg.
    - Matcher pools all 3 farmers (40 + 60 + 50 = 150 kg).
    - Weighted average unit price: (40*28 + 60*30 + 50*29)/150 = Rs 29.13/kg. Total: Rs 4370.
    - Buyer accepts group offer -> Group order created with canonical SHA-256 agreement hash.
    - All 3 contributing farmers confirm their allocation.
    - Buyer deposits 4370 test FARM tokens into FarmEscrow.
    - Traceability milestones logged (harvest -> packing -> handover -> receipt).
    - Order delivered, escrow released to farmers.
    - Demonstrates refund process upon order cancellation.
    - Journey 3 Admin: inspects health, moderates fraudulent listing, verifies agreement integrity on-chain.
    """
    # Register Farmers A, B, C
    tok_a, id_a = register_user(client, "e2e.farmer.a@demo.com", "farmer", "Farmer Ramesh (Farmer A)", "Bantwal")
    tok_b, id_b = register_user(client, "e2e.farmer.b@demo.com", "farmer", "Farmer Suresh (Farmer B)", "Puttur")
    tok_c, id_c = register_user(client, "e2e.farmer.c@demo.com", "farmer", "Farmer Dinesh (Farmer C)", "Belthangady")

    # Register Buyer
    tok_buyer, id_buyer = register_user(client, "e2e.buyer.ocean@demo.com", "buyer", "Ocean Pearl Hospitality", "Mangalore")

    # Register Administrator
    tok_admin, id_admin = register_user(client, "e2e.admin@demo.com", "admin", "State Horticulture Admin", "Mangalore")

    # Farmers create tomato listings with 40kg, 60kg, 50kg supplies
    l_a = client.post("/api/v1/listings", json={
        "crop_name": "Tomato",
        "category": "Vegetables",
        "total_quantity": 40.0,
        "unit": "kg",
        "minimum_order_quantity": 5.0,
        "price_per_unit": 28.0,
        "district": "Dakshina Kannada",
        "taluk": "Bantwal",
        "harvest_date": "2026-10-18",
        "allow_group_pooling": True
    }, headers={"Authorization": f"Bearer {tok_a}"}).json()["id"]

    l_b = client.post("/api/v1/listings", json={
        "crop_name": "Tomato",
        "category": "Vegetables",
        "total_quantity": 60.0,
        "unit": "kg",
        "minimum_order_quantity": 5.0,
        "price_per_unit": 30.0,
        "district": "Dakshina Kannada",
        "taluk": "Puttur",
        "harvest_date": "2026-10-18",
        "allow_group_pooling": True
    }, headers={"Authorization": f"Bearer {tok_b}"}).json()["id"]

    l_c = client.post("/api/v1/listings", json={
        "crop_name": "Tomato",
        "category": "Vegetables",
        "total_quantity": 50.0,
        "unit": "kg",
        "minimum_order_quantity": 5.0,
        "price_per_unit": 29.0,
        "district": "Dakshina Kannada",
        "taluk": "Belthangady",
        "harvest_date": "2026-10-18",
        "allow_group_pooling": True
    }, headers={"Authorization": f"Bearer {tok_c}"}).json()["id"]

    # Buyer Journey: Search & Filter Produce
    search_res = client.get("/api/v1/listings?crop_name=Tomato&district=Dakshina+Kannada", headers={"Authorization": f"Bearer {tok_buyer}"})
    assert search_res.status_code == 200
    assert len(search_res.json()) >= 3

    # Buyer requests combined 150 kg Group Offer Match Preview
    match_res = client.post("/api/v1/group-offers/match", json={
        "crop_name": "Tomato",
        "target_quantity": 150.0,
        "unit": "kg",
        "district": "Dakshina Kannada"
    }, headers={"Authorization": f"Bearer {tok_buyer}"})
    assert match_res.status_code == 200
    match_data = match_res.json()

    assert match_data["match_status"] == "full"
    assert match_data["total_matched_quantity"] == 150.0
    assert len(match_data["contributions"]) == 3
    # Check individual allocations: 40 kg, 60 kg, 50 kg
    allocations = {c["listing_id"]: c["quantity"] for c in match_data["contributions"]}
    assert allocations[l_a] == 40.0
    assert allocations[l_b] == 60.0
    assert allocations[l_c] == 50.0
    assert match_data["total_estimated_amount"] == 4370.0
    assert match_data["weighted_average_price"] == 29.13

    # Submit official Group Offer
    offer_req = client.post("/api/v1/group-offers", json={
        "crop_name": "Tomato",
        "target_quantity": 150.0,
        "unit": "kg",
        "delivery_address": "Navabharath Circle, Kodialbail, Mangalore",
        "delivery_terms": "Aggregated morning delivery to central kitchen by 7:30 AM"
    }, headers={"Authorization": f"Bearer {tok_buyer}"})
    assert offer_req.status_code == 201
    offer_id = offer_req.json()["id"]

    # Buyer accepts the group offer -> Creates group order, registers agreement hash on-chain
    accept_res = client.post(
        f"/api/v1/group-offers/{offer_id}/accept",
        headers={"Authorization": f"Bearer {tok_buyer}"}
    )
    assert accept_res.status_code == 200
    accepted_data = accept_res.json()
    order_id = accepted_data["order_id"]
    assert order_id is not None

    # Inspect the generated Order
    order_res = client.get(f"/api/v1/orders/{order_id}", headers={"Authorization": f"Bearer {tok_buyer}"})
    assert order_res.status_code == 200
    order_data = order_res.json()
    assert order_data["total_amount"] == 4370.0
    assert order_data["is_group_order"] is True
    assert len(order_data["items"]) == 3
    assert order_data["agreement_hash"].startswith("0x")
    assert len(order_data["agreement_hash"]) == 66
    assert order_data["blockchain_tx_hash"] is not None

    # Verify inventory was reserved atomically
    for lid in [l_a, l_b, l_c]:
        chk = client.get(f"/api/v1/listings/{lid}").json()
        assert chk["available_quantity"] == 0.0
        assert chk["status"] == "sold_out"

    # Farmers confirm their contributions individually
    contributions = accepted_data["contributions"]
    for c in contributions:
        farmer_tok = tok_a if c["farmer_id"] == id_a else tok_b if c["farmer_id"] == id_b else tok_c
        conf_res = client.post(
            f"/api/v1/group-offers/contributions/{c['id']}/confirm",
            headers={"Authorization": f"Bearer {farmer_tok}"}
        )
        assert conf_res.status_code == 200
        assert conf_res.json()["farmer_confirmed"] is True

    # Order is now fully confirmed
    confirmed_order = client.get(f"/api/v1/orders/{order_id}", headers={"Authorization": f"Bearer {tok_buyer}"}).json()
    assert confirmed_order["farmer_confirmed"] is True
    assert confirmed_order["order_status"] == "confirmed"

    verify_res = client.get(f"/api/v1/orders/{order_id}/verify-on-chain", headers={"Authorization": f"Bearer {tok_buyer}"})
    assert verify_res.status_code == 200
    v_data = verify_res.json()
    assert v_data["hash_match"] is True
    assert v_data["on_chain_status"] == "Verified Authenticated"

    # Escrow Demonstration: Buyer deposits test FARM tokens into smart contract
    deposit_res = client.post(
        f"/api/v1/orders/{order_id}/escrow/deposit",
        json={"amount": 4370.0},
        headers={"Authorization": f"Bearer {tok_buyer}"}
    )
    assert deposit_res.status_code == 200
    assert deposit_res.json()["status"] == "confirmed"
    assert deposit_res.json()["amount"] == 4370.0
    assert deposit_res.json()["is_demonstration"] is True

    # Order status now escrow_funded
    order_after_deposit = client.get(f"/api/v1/orders/{order_id}", headers={"Authorization": f"Bearer {tok_buyer}"}).json()
    assert order_after_deposit["order_status"] == "escrow_funded"
    assert order_after_deposit["escrow_status"] == "deposited"

    # Produce Traceability Events
    # Farmers / carrier / buyer record milestone traceability
    trace_stages = [
        ("harvest", "Bantwal & Puttur Farm Hubs", "Farmer Ramesh & Group", "Grade A (Premium)", tok_admin),
        ("packing", "Bantwal Aggregation Cold Hub", "Hub Logistics Operator", "Grade A (Standard Packed)", tok_admin),
        ("handover", "Kodialbail Intake Gate", "Transporter DK-Express", "Inspected Clean", tok_admin),
        ("receipt", "Ocean Pearl Central Kitchen", "Procurement QC Officer", "Accepted 150 kg", tok_buyer)
    ]
    for stage, loc, rec, qg, auth_token in trace_stages:
        t_res = client.post("/api/v1/traceability/events", json={
            "order_id": order_id,
            "stage_name": stage,
            "location": loc,
            "recorded_by": rec,
            "quality_grade": qg,
            "verification_source": "Joint Farmer-Buyer Digital QC",
            "metadata_json": {"temp_celsius": 18.5, "humidity": 65}
        }, headers={"Authorization": f"Bearer {auth_token}"})
        assert t_res.status_code == 201, t_res.text
        assert t_res.json()["event_hash"].startswith("0x")

    # Fetch complete timeline
    timeline = client.get(f"/api/v1/traceability/{order_id}", headers={"Authorization": f"Bearer {tok_buyer}"}).json()
    assert len(timeline) == 4

    # Release Escrow payout to farmers upon delivery
    release_res = client.post(
        f"/api/v1/orders/{order_id}/escrow/release",
        headers={"Authorization": f"Bearer {tok_buyer}"}
    )
    assert release_res.status_code == 200
    assert release_res.json()["action"] == "release"
    assert release_res.json()["status"] == "confirmed"

    order_completed = client.get(f"/api/v1/orders/{order_id}", headers={"Authorization": f"Bearer {tok_buyer}"}).json()
    assert order_completed["order_status"] == "completed"
    assert order_completed["escrow_status"] == "released"

    # Eligible Review restricted to completed orders
    rev_res = client.post("/api/v1/reviews", json={
        "order_id": order_id,
        "rating": 5,
        "comment": "Outstanding 150kg tomato pool. Quality is fresh and consistent across all 3 farmers."
    }, headers={"Authorization": f"Bearer {tok_buyer}"})
    assert rev_res.status_code == 201
    assert rev_res.json()["rating"] == 5

    # Test Escrow Refund Process on a cancelled order
    # Create an order to test escrow refund
    l_temp = client.post("/api/v1/listings", json={
        "crop_name": "Cucumber",
        "category": "Vegetables",
        "total_quantity": 25.0,
        "unit": "kg",
        "minimum_order_quantity": 5.0,
        "price_per_unit": 20.0,
        "district": "Dakshina Kannada",
        "taluk": "Bantwal",
        "harvest_date": "2026-10-18"
    }, headers={"Authorization": f"Bearer {tok_a}"}).json()["id"]

    order_temp_id = client.post("/api/v1/orders", json={
        "listing_id": l_temp,
        "quantity": 10.0,
        "delivery_address": "Ocean Pearl Mangalore",
        "delivery_terms": "Standard"
    }, headers={"Authorization": f"Bearer {tok_buyer}"}).json()["id"]

    # Deposit escrow
    client.post(f"/api/v1/orders/{order_temp_id}/escrow/deposit", headers={"Authorization": f"Bearer {tok_buyer}"})

    # Refund escrow to buyer (authorized by administrator)
    refund_res = client.post(
        f"/api/v1/orders/{order_temp_id}/escrow/refund",
        headers={"Authorization": f"Bearer {tok_admin}"}
    )
    assert refund_res.status_code == 200
    assert refund_res.json()["action"] == "refund"

    order_refunded = client.get(f"/api/v1/orders/{order_temp_id}", headers={"Authorization": f"Bearer {tok_buyer}"}).json()
    assert order_refunded["order_status"] == "cancelled"
    assert order_refunded["escrow_status"] == "refunded"

    # Journey 3 Administrator Tests:
    admin_headers = {"Authorization": f"Bearer {tok_admin}"}

    # 1. Access protected dashboard
    overview = client.get("/api/v1/admin/overview", headers=admin_headers)
    assert overview.status_code == 200
    ov = overview.json()
    assert ov["users_count"] >= 5
    assert ov["completed_orders_count"] >= 1
    assert ov["blockchain_status"]["chain_id"] == 31337

    # 2. View user registry
    users = client.get("/api/v1/admin/users", headers=admin_headers)
    assert users.status_code == 200
    assert len(users.json()) >= 5

    # 3. Moderate listing (Flag fraudulent listing)
    mod_res = client.post(f"/api/v1/admin/listings/{l_temp}/moderate", json={
        "status": "flagged_fraudulent",
        "reason": "Suspicious listing price discrepancy reported by community"
    }, headers=admin_headers)
    assert mod_res.status_code == 200
    assert mod_res.json()["status"] == "flagged_fraudulent"

    # 4. Review operational audit logs
    audit_logs = client.get("/api/v1/admin/audit-logs", headers=admin_headers)
    assert audit_logs.status_code == 200
    logs = audit_logs.json()
    assert any("flagged_fraudulent" in l["details"] for l in logs)

    # 5. Verify Agreement Integrity (proves silent overwrites are blocked)
    integrity_res = client.get(f"/api/v1/admin/agreements/{order_id}/verify", headers=admin_headers)
    assert integrity_res.status_code == 200
    assert integrity_res.json()["tamper_evident_status"] == "VERIFIED_AUTHENTIC"
    assert integrity_res.json()["is_tamper_free"] is True
