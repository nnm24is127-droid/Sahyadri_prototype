# FarmConnect AI — REST API Contracts & Endpoint Specifications

## Base URL
`/api/v1`

All responses follow standard HTTP status codes. Errors return a structured JSON body:
```json
{
  "detail": "Error description message",
  "error_code": "RESOURCE_NOT_FOUND",
  "timestamp": "2026-10-17T15:45:00Z"
}
```

---

## 1. Authentication & User Profile (`/auth`, `/users`)

### `POST /auth/register`
Register a new user (Farmer, Buyer, or Admin).
- **Request Body:**
```json
{
  "email": "farmer.ramesh@farmconnect.in",
  "password": "StrongPassword123!",
  "full_name": "Ramesh Rai",
  "phone_number": "+919845012345",
  "role": "farmer",
  "preferred_language": "kn",
  "district": "Dakshina Kannada",
  "taluk": "Bantwal",
  "village": "Mani",
  "wallet_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
}
```
- **Response `201 Created`:**
```json
{
  "id": "c1f7b093-41bb-4592-b439-0123456789ab",
  "email": "farmer.ramesh@farmconnect.in",
  "full_name": "Ramesh Rai",
  "role": "farmer",
  "token": "eyJhbGciOiJIUzI1NiIsIn..."
}
```

### `POST /auth/login`
- **Request Body:**
```json
{
  "email": "farmer.ramesh@farmconnect.in",
  "password": "StrongPassword123!"
}
```
- **Response `200 OK`:** Access token & user profile details.

### `GET /users/me`
- **Headers:** `Authorization: Bearer <token>`
- **Response `200 OK`:** Current user profile, role, farm count, active orders.

---

## 2. Farm Profiles & Crop Management (`/farms`)

### `POST /farms`
Create a new farm profile for the authenticated farmer.
- **Request Body:**
```json
{
  "farm_name": "Rai Adike Farm",
  "total_area_acres": 3.5,
  "irrigation_type": "Drip Irrigation & Borewell",
  "soil_type": "Coastal Laterite",
  "latitude": 12.8942,
  "longitude": 75.0321,
  "kannada_farm_alias": "ರೈ ಅಡಿಕೆ ತೋಟ"
}
```

### `POST /farms/{farm_id}/crops`
Register cultivated crops on the farm.
- **Request Body:**
```json
{
  "crop_name": "Arecanut (Chali)",
  "crop_category": "plantation",
  "area_planted_acres": 2.5,
  "planting_date": "2018-06-15",
  "estimated_harvest_window": "November - February",
  "annual_yield_estimate_kg": 4500
}
```

---

## 3. FarmForensics: Crop Investigation (`/forensics`)

### `POST /forensics/analyze`
Submit crop symptoms and optional image for AI-assisted diagnostic guidance.
- **Request Body (Multipart or JSON):**
```json
{
  "farm_id": "c1f7b093-41bb-4592-b439-0123456789ab",
  "crop_name": "Arecanut",
  "symptoms_description": "Arecanut bunches showing fruit rot, green nuts dropping with water-soaked lesions during heavy monsoon rains.",
  "kannada_voice_notes": "ಅಡಿಕೆ ಕಾಯಿ ಉದುರುತ್ತಿದೆ, ಕೊಳೆ ರೋಗದ ಲಕ್ಷಣವಿದೆ",
  "affected_percentage": 25.0,
  "image_base64": "data:image/jpeg;base64,..."
}
```
- **Response `200 OK`:**
```json
{
  "case_id": "8d3e2a10-fa92-4f9e-9132-234567890abc",
  "suspected_issue": "Koleroga / Mahali (Phytophthora meadii Fruit Rot)",
  "confidence_score": 0.92,
  "urgency_level": "High",
  "symptom_analysis": "Lesions and premature nut drop during high humidity coastal monsoon indicate Phytophthora infestation.",
  "immediate_organic_remedies": [
    "Remove and safely burn fallen infected nuts to curb spore spread",
    "Ensure adequate canopy aeration and drainage around palms"
  ],
  "standard_horticulture_remedies": [
    "Apply 1% Bordeaux mixture spray to bunches before and during monsoon breaks",
    "Fit protective polythene covers (Alkathene hoods) over areca bunches"
  ],
  "disclaimer": "Notice: AI-assisted agricultural observation for informational and early warning purposes. Consult local Krishi Vigyan Kendra (KVK) Brahmavar / Mangalore or horticulture officers before applying chemical treatments."
}
```

---

## 4. FarmLab: Experiments & Observations (`/lab`)

### `POST /lab/experiments`
Plan a controlled agricultural experiment.
- **Request Body:**
```json
{
  "farm_id": "c1f7b093-41bb-4592-b439-0123456789ab",
  "experiment_title": "Jeevamrutha vs Conventional Urea on Pepper Yield",
  "objective": "Evaluate root vigour and berry weight with natural microbial consortium",
  "crop_tested": "Black Pepper (Panniyur-1)",
  "control_method": "Chemical NPK 100:40:140 application",
  "experimental_method": "Bi-weekly Jeevamrutha soil drenching + mulching",
  "start_date": "2026-06-01"
}
```

### `POST /lab/experiments/{experiment_id}/observations`
Record periodic observation metrics.

### `POST /lab/experiments/{experiment_id}/summarize`
Generate AI analytical summary comparing control vs experimental results.

---

## 5. Produce Listings & Discovery (`/listings`)

### `POST /listings`
Publish produce listing directly to buyers.
- **Request Body:**
```json
{
  "farm_id": "c1f7b093-41bb-4592-b439-0123456789ab",
  "crop_name": "Udupi Mattu Gulla",
  "variety": "GI Tagged Mattu Brinjal",
  "category": "horticulture",
  "available_quantity": 250,
  "unit": "kg",
  "minimum_order_quantity": 25,
  "price_per_unit": 65.0,
  "quality_grade": "Grade A (Premium)",
  "organic_certified": true,
  "harvest_date": "2026-10-18",
  "shelf_life_days": 5,
  "district": "Udupi",
  "taluk": "Udupi",
  "allow_group_pooling": true,
  "created_via_voice": false
}
```

### `GET /listings`
Filter listings with query params: `crop_name`, `district`, `taluk`, `quality_grade`, `organic_only`, `min_price`, `max_price`, `page`, `limit`.

---

## 6. Smart Group Selling (`/group-offers`)

### `POST /group-offers/match`
Execute the quantity-pooling algorithm: aggregates multiple small farmers' surplus lots within a taluk to satisfy a bulk buyer purchase order or target MOQ.
- **Request Body:**
```json
{
  "crop_name": "Arecanut (Chali)",
  "target_quantity": 2000,
  "unit": "kg",
  "max_acceptable_price": 460.0,
  "taluk": "Bantwal"
}
```
- **Response `200 OK`:** Optimal cluster of participating farmers, individual allocations, distance to aggregation hub, and total pooled cost.

### `POST /group-offers/{id}/join`
Farmer commits a specified quantity into an open pooling pool.

---

## 7. AI Price Assistant (`/pricing`)

### `GET /pricing/benchmark`
Retrieve current APMC market rates and AI fair-value analysis for Dakshina Kannada & Udupi crops.
- **Query Parameters:** `crop_name=Arecanut&variety=Chali&district=Dakshina+Kannada`
- **Response `200 OK`:**
```json
{
  "crop_name": "Arecanut",
  "variety": "Chali",
  "district": "Dakshina Kannada",
  "benchmark_market": "APMC Bantwal & Mangalore",
  "as_of_date": "2026-10-17",
  "apmc_modal_price": 445.0,
  "apmc_min_price": 410.0,
  "apmc_max_price": 472.0,
  "unit": "kg",
  "ai_analysis": {
    "recommended_direct_price": 465.0,
    "price_range_fair": {"min": 445.0, "max": 475.0},
    "direct_buyer_benefit": "Bypassing intermediate commission agents saves 10-14% for buyers while yielding +5% above modal APMC rate for farmer.",
    "market_factors": "Festive seasonal demand and low stock arrivals in coastal mandis support firm prices."
  },
  "is_demonstration_data": true,
  "data_source_label": "Karnataka APMC Price Bulletin & CAMPCO Market Trends (Demonstration Dataset)"
}
```

---

## 8. Kannada Voice-Based Listing (`/voice/listing`)

### `POST /voice/parse-transcription`
Parses raw Kannada voice input (or audio transcription) and transforms it into a structured listing draft.
- **Request Body:**
```json
{
  "kannada_text": "ನನ್ನಲ್ಲಿ ನೂರು ಕೆಜಿ ಮಟ್ಟುಗುಳ್ಳ ಬದನೆಕಾಯಿ ಇದೆ, ಕೆಜಿಗೆ ಅರವತ್ತೈದು ರೂಪಾಯಿ, ಉಡುಪಿಯಿಂದ",
  "audio_duration_seconds": 6.4
}
```
- **Response `200 OK`:**
```json
{
  "parsed_fields": {
    "crop_name": "Udupi Mattu Gulla",
    "crop_category": "horticulture",
    "quantity": 100.0,
    "unit": "kg",
    "price_per_unit": 65.0,
    "taluk": "Udupi",
    "district": "Udupi"
  },
  "confidence": 0.95,
  "transcription_original": "ನನ್ನಲ್ಲಿ ನೂರು ಕೆಜಿ ಮಟ್ಟುಗುಳ್ಳ ಬದನೆಕಾಯಿ ಇದೆ, ಕೆಜಿಗೆ ಅರವತ್ತೈದು ರೂಪಾಯಿ, ಉಡುಪಿಯಿಂದ",
  "transcription_english": "I have 100 kg of Mattu Gulla brinjal, 65 rupees per kg, from Udupi",
  "requires_review": true
}
```

---

## 9. Orders & Blockchain Anchoring (`/orders`)

### `POST /orders`
Create an order between buyer and seller (or group offer).
- Calculates the cryptographic `agreement_hash` = `SHA256(order_code + buyer_id + seller_id + crop + quantity + price + delivery_terms)`.

### `POST /orders/{order_id}/anchor-on-chain`
Submits agreement hash to `FarmAgreementRegistry.sol` smart contract.

### `POST /orders/{order_id}/status`
Update order lifecycle state (e.g., `confirmed`, `escrow_funded`, `dispatched`, `delivered`, `completed`).

---

## 10. Produce Traceability (`/traceability`)

### `POST /traceability/events`
Record an immutable milestone along the supply chain.

### `GET /traceability/{order_id}/timeline`
Retrieve all verified chronological events for an order batch with blockchain verification status.

---

## 11. Smart Contract Payments (`/payments/escrow`)

### `GET /payments/contract-info`
Provides address, ABI, and test token faucets for the deployed EVM contracts.

### `POST /payments/simulate-escrow`
Records test token escrow lock or release for demonstration environments when Web3 wallet is not directly connected.
