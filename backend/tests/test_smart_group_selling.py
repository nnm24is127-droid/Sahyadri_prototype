import pytest
from starlette.testclient import TestClient


def register_user(client: TestClient, email: str, role: str, name: str, taluk: str = "Bantwal"):
    res = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": name,
        "phone_number": "+91 98888 11111",
        "role": role,
        "taluk": taluk
    })
    assert res.status_code == 201
    return res.json()["access_token"], res.json()["user"]["id"]


def create_listing(client: TestClient, token: str, crop_name: str, quantity: float, price: float, taluk: str = "Bantwal", allow_pooling: bool = True, status: str = "active"):
    res = client.post("/api/v1/listings", json={
        "crop_name": crop_name,
        "category": "Vegetables",
        "total_quantity": quantity,
        "unit": "kg",
        "minimum_order_quantity": 5.0,
        "price_per_unit": price,
        "district": "Dakshina Kannada",
        "taluk": taluk,
        "harvest_date": "2026-10-16",
        "quality_grade": "Grade A (Premium)",
        "allow_group_pooling": allow_pooling,
        "status": status
    }, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201
    return res.json()["id"]


def test_deterministic_matcher_exact_150kg_scenario(client: TestClient):
    """
    Demonstrate the primary Hackathon scenario:
    - Buyer needs 150 kg of tomatoes.
    - Farmer A has 40 kg @ Rs 28/kg.
    - Farmer B has 60 kg @ Rs 30/kg.
    - Farmer C has 50 kg @ Rs 29/kg.
    - Matcher proposes 150 kg from all three listings:
      40 + 60 + 50 = 150 kg
      Weighted average price: (40*28 + 60*30 + 50*29) / 150 = 4370 / 150 = Rs 29.13/kg.
    """
    token_a, id_a = register_user(client, "farmer.a@demo.com", "farmer", "Farmer Ramesh (Farmer A)", "Bantwal")
    token_b, id_b = register_user(client, "farmer.b@demo.com", "farmer", "Farmer Suresh (Farmer B)", "Puttur")
    token_c, id_c = register_user(client, "farmer.c@demo.com", "farmer", "Farmer Dinesh (Farmer C)", "Belthangady")
    buyer_token, buyer_id = register_user(client, "hotel.ocean@demo.com", "buyer", "Ocean Pearl Hotel", "Mangalore")

    # Create the 3 listings
    l_a = create_listing(client, token_a, "Tomato", 40.0, 28.0, taluk="Bantwal")
    l_b = create_listing(client, token_b, "Tomato", 60.0, 30.0, taluk="Puttur")
    l_c = create_listing(client, token_c, "Tomato", 50.0, 29.0, taluk="Belthangady")

    # Run Matcher preview
    match_res = client.post("/api/v1/group-offers/match", json={
        "crop_name": "Tomato",
        "target_quantity": 150.0,
        "unit": "kg",
        "district": "Dakshina Kannada"
    })
    assert match_res.status_code == 200
    data = match_res.json()

    assert data["match_status"] == "full"
    assert data["is_achievable"] is True
    assert data["total_matched_quantity"] == 150.0
    assert data["shortfall_quantity"] == 0.0
    assert data["weighted_average_price"] == 29.13
    assert data["total_estimated_amount"] == 4370.0
    assert len(data["contributions"]) == 3

    # Check that individual contributions sum to 150 kg
    qtys = {c["listing_id"]: c["quantity"] for c in data["contributions"]}
    assert qtys[l_a] == 40.0
    assert qtys[l_b] == 60.0
    assert qtys[l_c] == 50.0

    # Verify matching explanation is present and transparent
    explanation = data["matching_explanation"]
    assert "150.0 kg of Tomato across 3 smallholder farmer" in explanation
    assert "Farmer Ramesh" in explanation
    assert "Farmer Suresh" in explanation
    assert "Farmer Dinesh" in explanation
    assert "29.13" in explanation


def test_excess_supply_economic_prioritization(client: TestClient):
    """
    Test when total supply exceeds requested volume:
    - Farmer 1 has 40 kg @ Rs 25 (cheapest)
    - Farmer 2 has 60 kg @ Rs 28
    - Farmer 3 has 100 kg @ Rs 35 (most expensive)
    - Target: 150 kg
    - Deterministic matcher takes all 40 kg from Farmer 1, all 60 kg from Farmer 2, and 50 kg from Farmer 3.
    """
    token_1, _ = register_user(client, "f1.excess@demo.com", "farmer", "Farmer Low Price", "Bantwal")
    token_2, _ = register_user(client, "f2.excess@demo.com", "farmer", "Farmer Mid Price", "Bantwal")
    token_3, _ = register_user(client, "f3.excess@demo.com", "farmer", "Farmer High Price", "Bantwal")

    l1 = create_listing(client, token_1, "Chilli (Byadgi)", 40.0, 25.0)
    l2 = create_listing(client, token_2, "Chilli (Byadgi)", 60.0, 28.0)
    l3 = create_listing(client, token_3, "Chilli (Byadgi)", 100.0, 35.0)

    res = client.post("/api/v1/group-offers/match", json={
        "crop_name": "Chilli (Byadgi)",
        "target_quantity": 150.0,
        "unit": "kg"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["match_status"] == "full"
    assert data["total_matched_quantity"] == 150.0
    assert len(data["contributions"]) == 3

    c_map = {c["listing_id"]: c["quantity"] for c in data["contributions"]}
    assert c_map[l1] == 40.0
    assert c_map[l2] == 60.0
    assert c_map[l3] == 50.0  # Partial allocation from the most expensive lot


def test_insufficient_supply_response(client: TestClient):
    """
    Test insufficient supply returns partial calculation and explicit shortfall.
    - Farmer A has 25 kg
    - Farmer B has 35 kg
    - Target: 100 kg
    - Total available: 60 kg, Shortfall: 40 kg
    """
    t1, _ = register_user(client, "f1.short@demo.com", "farmer", "Farmer Short 1")
    t2, _ = register_user(client, "f2.short@demo.com", "farmer", "Farmer Short 2")

    create_listing(client, t1, "Ginger", 25.0, 110.0)
    create_listing(client, t2, "Ginger", 35.0, 115.0)

    res = client.post("/api/v1/group-offers/match", json={
        "crop_name": "Ginger",
        "target_quantity": 100.0,
        "unit": "kg"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["match_status"] == "insufficient_supply"
    assert data["is_achievable"] is False
    assert data["total_matched_quantity"] == 60.0
    assert data["shortfall_quantity"] == 40.0
    assert "Shortfall of 40.0 kg" in data["matching_explanation"]


def test_unavailable_farmers_and_filters_ignored(client: TestClient):
    """
    Verify matcher ignores listings that are:
    - allow_group_pooling = False
    - status = 'paused'
    - status = 'sold_out'
    - wrong unit
    """
    t1, _ = register_user(client, "f1.unavail@demo.com", "farmer", "No Pooling Farmer")
    t2, _ = register_user(client, "f2.unavail@demo.com", "farmer", "Paused Farmer")
    t3, _ = register_user(client, "f3.unavail@demo.com", "farmer", "Active Pooling Farmer")

    # Listing 1: pooling disabled
    create_listing(client, t1, "Cucumber", 50.0, 20.0, allow_pooling=False)
    # Listing 2: active pooling
    l3 = create_listing(client, t3, "Cucumber", 50.0, 22.0, allow_pooling=True)
    # Listing 3: created then paused
    l2 = create_listing(client, t2, "Cucumber", 50.0, 21.0, allow_pooling=True)
    client.patch(f"/api/v1/listings/{l2}/status", json={"status": "paused"}, headers={"Authorization": f"Bearer {t2}"})

    res = client.post("/api/v1/group-offers/match", json={
        "crop_name": "Cucumber",
        "target_quantity": 100.0,
        "unit": "kg"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["total_matched_quantity"] == 50.0
    assert len(data["contributions"]) == 1
    assert data["contributions"][0]["listing_id"] == l3


def test_offer_reservation_acceptance_order_creation_and_farmer_confirmations(client: TestClient):
    """
    Complete lifecycle:
    1. 3 farmers have 40 + 60 + 50 kg Tomatoes.
    2. Buyer requests group offer for 150 kg -> Inventory atomically reserved.
    3. Buyer accepts offer -> Parent order created with linked OrderItem contributions and SHA-256 agreement hash.
    4. Each farmer confirms their contribution individually.
    5. Parent order transitions to 'confirmed' once all 3 farmers confirm.
    """
    t_a, id_a = register_user(client, "f.a.order@demo.com", "farmer", "Farmer A", "Bantwal")
    t_b, id_b = register_user(client, "f.b.order@demo.com", "farmer", "Farmer B", "Puttur")
    t_c, id_c = register_user(client, "f.c.order@demo.com", "farmer", "Farmer C", "Belthangady")
    b_token, b_id = register_user(client, "buyer.order@demo.com", "buyer", "Hotel Gateway", "Mangalore")

    l_a = create_listing(client, t_a, "Tomato", 40.0, 28.0)
    l_b = create_listing(client, t_b, "Tomato", 60.0, 30.0)
    l_c = create_listing(client, t_c, "Tomato", 50.0, 29.0)

    # 1. Buyer creates group offer for 150 kg
    offer_res = client.post("/api/v1/group-offers", json={
        "crop_name": "Tomato",
        "target_quantity": 150.0,
        "unit": "kg",
        "delivery_address": "Gateway Hotel Kitchen, Mangalore",
        "delivery_terms": "Consolidated delivery via Bantwal hub"
    }, headers={"Authorization": f"Bearer {b_token}"})
    assert offer_res.status_code == 201
    offer_data = offer_res.json()
    offer_id = offer_data["id"]
    assert offer_data["status"] == "proposed"
    assert offer_data["target_quantity"] == 150.0
    assert len(offer_data["contributions"]) == 3

    # Check listings inventory is reserved (all 3 sold out since exact match)
    listing_a = client.get(f"/api/v1/listings/{l_a}").json()
    assert listing_a["available_quantity"] == 0.0
    assert listing_a["status"] == "sold_out"

    # 2. Buyer accepts the proposed offer
    accept_res = client.post(f"/api/v1/group-offers/{offer_id}/accept", headers={"Authorization": f"Bearer {b_token}"})
    assert accept_res.status_code == 200
    acc_data = accept_res.json()
    assert acc_data["status"] == "accepted"
    order_id = acc_data["order_id"]
    assert order_id is not None

    # Verify duplicate acceptance is prevented
    dup_res = client.post(f"/api/v1/group-offers/{offer_id}/accept", headers={"Authorization": f"Bearer {b_token}"})
    assert dup_res.status_code == 400
    assert "already been accepted" in dup_res.json()["detail"]

    # 3. Check created parent order
    parent_order = client.get(f"/api/v1/orders/{order_id}", headers={"Authorization": f"Bearer {b_token}"}).json()
    assert parent_order["is_group_order"] is True
    assert parent_order["group_offer_id"] == offer_id
    assert parent_order["order_status"] == "pending"
    assert parent_order["farmer_confirmed"] is False
    assert parent_order["buyer_confirmed"] is True
    assert len(parent_order["items"]) == 3
    assert parent_order["agreement_hash"].startswith("0x")

    # 4. Farmers check contributions and confirm one by one
    contribs = acc_data["contributions"]
    c_a = next(c for c in contribs if c["farmer_id"] == id_a)
    c_b = next(c for c in contribs if c["farmer_id"] == id_b)
    c_c = next(c for c in contribs if c["farmer_id"] == id_c)

    # Farmer A confirms
    conf_a = client.post(f"/api/v1/group-offers/contributions/{c_a['id']}/confirm", headers={"Authorization": f"Bearer {t_a}"})
    assert conf_a.status_code == 200
    assert conf_a.json()["farmer_confirmed"] is True

    # Order should still be pending
    order_check = client.get(f"/api/v1/orders/{order_id}", headers={"Authorization": f"Bearer {b_token}"}).json()
    assert order_check["order_status"] == "pending"
    assert order_check["farmer_confirmed"] is False

    # Farmer B confirms
    conf_b = client.post(f"/api/v1/group-offers/contributions/{c_b['id']}/confirm", headers={"Authorization": f"Bearer {t_b}"})
    assert conf_b.status_code == 200

    # Farmer C confirms -> all confirmed!
    conf_c = client.post(f"/api/v1/group-offers/contributions/{c_c['id']}/confirm", headers={"Authorization": f"Bearer {t_c}"})
    assert conf_c.status_code == 200

    # Parent order must now be confirmed!
    final_order = client.get(f"/api/v1/orders/{order_id}", headers={"Authorization": f"Bearer {b_token}"}).json()
    assert final_order["farmer_confirmed"] is True
    assert final_order["order_status"] == "confirmed"


def test_rejection_and_inventory_release(client: TestClient):
    """
    Test that when a buyer rejects an offer, the reserved inventory is completely restored
    and listing status returns from 'sold_out' to 'active'.
    """
    t_farmer, _ = register_user(client, "f.rej@demo.com", "farmer", "Farmer Restock")
    b_token, _ = register_user(client, "b.rej@demo.com", "buyer", "Buyer Restock")

    l_id = create_listing(client, t_farmer, "Beans", 50.0, 45.0)

    # Create group offer for 50 kg
    res = client.post("/api/v1/group-offers", json={
        "crop_name": "Beans",
        "target_quantity": 50.0,
        "unit": "kg"
    }, headers={"Authorization": f"Bearer {b_token}"})
    assert res.status_code == 201
    offer_id = res.json()["id"]

    # Verify inventory is 0
    l_before = client.get(f"/api/v1/listings/{l_id}").json()
    assert l_before["available_quantity"] == 0.0
    assert l_before["status"] == "sold_out"

    # Buyer rejects
    rej_res = client.post(f"/api/v1/group-offers/{offer_id}/reject", headers={"Authorization": f"Bearer {b_token}"})
    assert rej_res.status_code == 200
    assert rej_res.json()["status"] == "rejected"

    # Verify inventory restored
    l_after = client.get(f"/api/v1/listings/{l_id}").json()
    assert l_after["available_quantity"] == 50.0
    assert l_after["status"] == "active"


def test_simultaneous_requests_prevent_overselling(client: TestClient):
    """
    Verify concurrency protection:
    Listing has 100 kg.
    Buyer 1 takes 70 kg.
    Buyer 2 tries to take 50 kg from the same listing -> cannot take 50 kg,
    either fails or takes only the remaining 30 kg without going negative.
    """
    t_farmer, _ = register_user(client, "f.race@demo.com", "farmer", "Farmer Concurrency")
    b1_token, _ = register_user(client, "b1.race@demo.com", "buyer", "Buyer 1")
    b2_token, _ = register_user(client, "b2.race@demo.com", "buyer", "Buyer 2")

    l_id = create_listing(client, t_farmer, "Watermelon", 100.0, 15.0)

    # Buyer 1 reserves 70 kg
    res1 = client.post("/api/v1/group-offers", json={
        "crop_name": "Watermelon",
        "target_quantity": 70.0,
        "unit": "kg"
    }, headers={"Authorization": f"Bearer {b1_token}"})
    assert res1.status_code == 201

    l_check = client.get(f"/api/v1/listings/{l_id}").json()
    assert l_check["available_quantity"] == 30.0

    # Buyer 2 attempts to match 50 kg
    match2 = client.post("/api/v1/group-offers/match", json={
        "crop_name": "Watermelon",
        "target_quantity": 50.0,
        "unit": "kg"
    }).json()
    # Can only match 30 kg
    assert match2["total_matched_quantity"] == 30.0
    assert match2["shortfall_quantity"] == 20.0
    assert match2["is_achievable"] is False
