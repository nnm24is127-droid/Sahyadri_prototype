import pytest
from starlette.testclient import TestClient


def register_farmer(client: TestClient, email: str = "farmer.ai@test.com"):
    res = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": "Mahalinga Naik (Farmer)",
        "phone_number": "+91 94488 22222",
        "role": "farmer",
        "taluk": "Bantwal",
        "district": "Dakshina Kannada"
    })
    assert res.status_code == 201
    return res.json()["access_token"], res.json()["user"]["id"]


# ====================================================================
# A. FarmForensics — Crop Investigation Tests
# ====================================================================

def test_farm_forensics_investigation_and_timeline(client: TestClient):
    """
    Test FarmForensics crop disease investigation flow:
    1. Create investigation with symptoms, crop, irrigation, and image.
    2. Verify AI preliminary diagnosis includes causes, likelihood, recommended next checks, and disclaimers.
    3. Verify non-definitive diagnosis language (never claims 100% lab confirmation).
    4. Record follow-up observation.
    5. Retrieve chronological timeline.
    """
    token, _ = register_farmer(client, "forensics.farmer@test.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create investigation
    create_payload = {
        "crop_name": "Arecanut (Betel Nut)",
        "symptoms_description": "Water-soaked green nuts dropping heavily after 3 days of torrential rain. Rotting bunches at crown.",
        "affected_percentage": 25.0,
        "irrigation_details": "Rain-fed coastal monsoon, natural soil drainage",
        "image_url": "https://farmconnect.example.com/images/areca_rot.jpg"
    }
    res = client.post("/api/v1/forensics/investigations", json=create_payload, headers=headers)
    assert res.status_code == 201
    inv_data = res.json()

    assert inv_data["crop_name"] == "Arecanut (Betel Nut)"
    assert "Koleroga" in inv_data["ai_preliminary_diagnosis"] or "Phytophthora" in inv_data["ai_preliminary_diagnosis"]
    assert len(inv_data["possible_causes"]) > 0
    assert inv_data["possible_causes"][0]["likelihood"] in ["Probable", "Possible", "High"]
    assert len(inv_data["recommended_next_checks"]) > 0
    assert len(inv_data["remedies"]) > 0
    # Must communicate uncertainty and include KVK advisory
    assert "KVK" in inv_data["ai_disclaimer_notice"] or "Krishi Vigyan Kendra" in inv_data["ai_disclaimer_notice"]
    assert "early warning" in inv_data["ai_disclaimer_notice"].lower() or "preliminary" in inv_data["ai_disclaimer_notice"].lower()

    inv_id = inv_data["id"]

    # 2. Record follow-up observation (farmer update)
    obs_payload = {
        "action_taken": "Covered bunches with polythene hoods and applied 1% Bordeaux mixture on dry interval",
        "treatment_type": "Protective copper fungicide & physical covering",
        "spread_status": "Nut dropping slowed down significantly; no new bunches affected",
        "notes": "Verified after 4 days. Sunshine returned."
    }
    obs_res = client.post(f"/api/v1/forensics/investigations/{inv_id}/observations", json=obs_payload, headers=headers)
    assert obs_res.status_code == 200
    updated_inv = obs_res.json()
    assert len(updated_inv["observations"]) >= 2
    assert updated_inv["observations"][-1]["spread_status"] == obs_payload["spread_status"]

    # 3. Retrieve chronological timeline
    timeline_res = client.get(f"/api/v1/forensics/investigations/{inv_id}/timeline", headers=headers)
    assert timeline_res.status_code == 200
    timeline = timeline_res.json()
    assert isinstance(timeline, list)
    assert len(timeline) >= 2  # initial report observation + follow-up observation
    assert timeline[0]["investigation_id"] == inv_id
    assert timeline[-1]["action_taken"] == obs_payload["action_taken"]


# ====================================================================
# B. FarmLab — Farming Experiment Assistance Tests
# ====================================================================

def test_farmlab_deterministic_calculations_and_synthesis(client: TestClient):
    """
    Test FarmLab trial tracking:
    1. Define experiment with control vs. experimental methods.
    2. Record observation with control & experimental metrics and costs.
    3. Assert deterministic calculation of difference and percentage (NOT hallucinated).
    4. Assert cost delta calculation.
    5. Check AI explanation, limitations, and next trial suggestions.
    """
    token, _ = register_farmer(client, "farmlab.farmer@test.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Define experiment
    exp_payload = {
        "title": "Bio-Enzyme Panchagavya vs Chemical Fertilizer in Mattu Gulla",
        "hypothesis": "Foliar application of fermented Panchagavya increases fruit set by 15% and reduces input cost",
        "crop_tested": "Udupi Mattu Gulla",
        "control_method": "Conventional synthetic NPK 19-19-19 chemical drenching",
        "experimental_method": "Bi-weekly foliar spray of 3% organic Panchagavya with cow urine base",
        "plot_size_description": "2 plots of 20 cents each in Shankarpura",
        "duration_days": 45
    }
    res = client.post("/api/v1/lab/experiments", json=exp_payload, headers=headers)
    assert res.status_code == 201
    exp = res.json()
    exp_id = exp["id"]
    assert exp["title"] == exp_payload["title"]

    # 2. Record observation:
    # Control yield = 120.0 kg, Experimental yield = 144.0 kg
    # Control cost = 850.0 Rs, Experimental cost = 350.0 Rs
    # Expected deterministic math:
    # diff = 144.0 - 120.0 = +24.0 kg
    # pct_change = (24.0 / 120.0) * 100 = +20.0%
    # cost_delta = 350.0 - 850.0 = -500.0 Rs (cost savings)
    obs_payload = {
        "metric_name": "Harvest Yield (kg)",
        "control_metric_value": 120.0,
        "experimental_metric_value": 144.0,
        "input_cost_control": 850.0,
        "input_cost_experimental": 350.0,
        "notes": "First picking cycle at 30 days after transplanting."
    }
    obs_res = client.post(f"/api/v1/lab/experiments/{exp_id}/observations", json=obs_payload, headers=headers)
    assert obs_res.status_code == 200
    updated_exp = obs_res.json()

    assert len(updated_exp["observations"]) == 1
    obs_record = updated_exp["observations"][0]

    # Verify DETERMINISTIC BACKEND CALCULATIONS:
    assert obs_record["numerical_difference"] == 24.0
    assert obs_record["percentage_change"] == 20.0
    assert obs_record["cost_delta"] == -500.0

    # Verify AI synthesis and limitations
    assert updated_exp["ai_synthesis_summary"] is not None
    assert updated_exp["limitations_summary"] is not None
    # Crucial safety check: system must acknowledge that small trial does NOT prove general effectiveness
    assert "preliminary" in updated_exp["limitations_summary"].lower() or "micro-plot" in updated_exp["limitations_summary"].lower() or "caution" in updated_exp["limitations_summary"].lower() or "limitation" in updated_exp["limitations_summary"].lower()


# ====================================================================
# C. AI Price Assistant Tests
# ====================================================================

def test_price_assistant_with_available_reference_benchmark(client: TestClient):
    """
    Test Price Assistant when reference benchmark exists in database:
    1. Compare asking price of 480 Rs/kg for Arecanut with APMC benchmark (452 Rs/kg).
    2. Verify deterministic calculations: diff = 480 - 452 = +28.0 Rs, pct = +6.19%.
    3. Verify market yard, data source, and observation date are present.
    4. Verify simple language AI explanation.
    """
    token, _ = register_farmer(client, "price.farmer@test.com")
    headers = {"Authorization": f"Bearer {token}"}

    compare_payload = {
        "crop_name": "Arecanut (Chali)",
        "asking_price": 480.0,
        "unit": "kg",
        "district": "Dakshina Kannada",
        "taluk": "Bantwal"
    }
    res = client.post("/api/v1/pricing/compare", json=compare_payload, headers=headers)
    assert res.status_code == 200
    comp = res.json()

    assert comp["has_reference_data"] is True
    assert comp["reference_modal_price"] == 452.0
    assert comp["difference"] == 28.0
    assert comp["percentage_difference"] == 6.19
    assert comp["position_relative_to_mandi"] == "above_modal_rate"
    assert "Bantwal" in comp["reference_market_yard"] or "CAMPCO" in comp["reference_market_yard"]
    assert comp["reference_source"] is not None
    assert comp["observation_date"] is not None
    assert len(comp["ai_explanation"]) > 20
    assert "do not guarantee" in comp["disclaimer"].lower() or "independent" in comp["disclaimer"].lower()


def test_price_assistant_with_unavailable_reference_benchmark(client: TestClient):
    """
    Test Price Assistant when NO reference benchmark exists in database:
    1. Must explicitly inform user that no official mandi benchmark exists.
    2. Must NOT fabricate market rates.
    3. Must NOT claim guaranteed profits.
    """
    token, _ = register_farmer(client, "noprice.farmer@test.com")
    headers = {"Authorization": f"Bearer {token}"}

    compare_payload = {
        "crop_name": "Exotic Dragon Fruit (Rare)",
        "asking_price": 250.0,
        "unit": "kg",
        "district": "Dakshina Kannada"
    }
    res = client.post("/api/v1/pricing/compare", json=compare_payload, headers=headers)
    assert res.status_code == 200
    comp = res.json()

    assert comp["has_reference_data"] is False
    assert comp["reference_modal_price"] is None
    assert comp["difference"] is None
    assert comp["position_relative_to_mandi"] == "no_reference_data"
    assert "No official APMC Mandi price benchmark currently exists" in comp["disclaimer"]
    assert "never fabricate" in comp["disclaimer"].lower()


# ====================================================================
# D. Kannada Voice-Based Listing Tests
# ====================================================================

def test_kannada_voice_listing_service_status(client: TestClient):
    """Verify voice service reporting and provider capabilities."""
    res = client.get("/api/v1/voice/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "operational"
    assert data["browser_speech_recognition_supported"] is True
    assert data["manual_fallback_available"] is True
    assert data["requires_farmer_review"] is True


def test_kannada_voice_listing_parsing_and_safeguards(client: TestClient):
    """
    Test Kannada speech parsing:
    1. Send Kannada transcript: 'ನನ್ನ ಬಳಿ 150 ಕೆಜಿ ಟೊಮೆಟೊ ಇದೆ, ದರ 32 ರೂಪಾಯಿ ಬಂಟ್ವಾಳ'
    2. Verify extraction of: crop (Tomato), quantity (150 kg), price (32 Rs), taluk (Bantwal).
    3. Verify requires_farmer_review is TRUE (mandatory safety safeguard).
    """
    token, _ = register_farmer(client, "kannada.farmer@test.com")
    headers = {"Authorization": f"Bearer {token}"}

    parse_payload = {
        "transcript_kannada": "ನನ್ನ ಬಳಿ 150 ಕೆಜಿ ಟೊಮೆಟೊ ಇದೆ, ದರ 32 ರೂಪಾಯಿ ಬಂಟ್ವಾಳ",
        "farmer_taluk": "Bantwal",
        "farmer_district": "Dakshina Kannada"
    }
    res = client.post("/api/v1/voice/parse-kannada", json=parse_payload, headers=headers)
    assert res.status_code == 200
    draft = res.json()

    assert draft["crop_name"] == "Tomato"
    assert draft["quantity"] == 150.0
    assert draft["price_per_unit"] == 32.0
    assert draft["unit"] == "kg"
    assert draft["taluk"] == "Bantwal"
    assert draft["requires_farmer_review"] is True
    assert draft["raw_transcript"] == parse_payload["transcript_kannada"]


def test_kannada_voice_listing_empty_transcript_error(client: TestClient):
    """Test validation rejection when voice transcript is empty."""
    token, _ = register_farmer(client, "emptyvoice.farmer@test.com")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/v1/voice/parse-kannada", json={"transcript_kannada": "   "}, headers=headers)
    assert res.status_code == 400
    assert "cannot be empty" in res.json()["detail"].lower()


def test_kannada_voice_transcribe_audio_endpoint(client: TestClient):
    """Test /api/v1/voice/transcribe-audio endpoint fallback and drafting."""
    token, _ = register_farmer(client, "audio.farmer@test.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Simulate multipart audio upload with minimal bytes
    files = {"audio_file": ("voice_note.webm", b"RIFF....WAVEfmt ....data....", "audio/webm")}
    data = {"farmer_taluk": "Bantwal", "farmer_district": "Dakshina Kannada"}
    res = client.post("/api/v1/voice/transcribe-audio", files=files, data=data, headers=headers)
    assert res.status_code == 200
    draft = res.json()

    assert draft["quantity"] > 0
    assert draft["price_per_unit"] > 0
    assert draft["requires_farmer_review"] is True
