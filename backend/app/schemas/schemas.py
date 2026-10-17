from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict

# ----------------- Auth & Users -----------------
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str
    phone_number: str
    role: str = "farmer" # farmer, buyer, admin
    preferred_language: str = "kn"
    district: str = "Dakshina Kannada"
    taluk: str
    village: Optional[str] = None
    wallet_address: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    phone_number: str
    role: str
    preferred_language: str
    district: str
    taluk: str
    village: Optional[str] = None
    wallet_address: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Farm Profiles -----------------
class FarmCreate(BaseModel):
    farm_name: str
    kannada_farm_alias: Optional[str] = None
    total_area_acres: float = Field(..., gt=0)
    soil_type: str = "Coastal Laterite"
    irrigation_source: str = "Borewell & Drip Irrigation"
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class FarmUpdate(BaseModel):
    farm_name: Optional[str] = None
    kannada_farm_alias: Optional[str] = None
    total_area_acres: Optional[float] = None
    soil_type: Optional[str] = None
    irrigation_source: Optional[str] = None

class FarmResponse(BaseModel):
    id: str
    farmer_id: str
    farm_name: str
    kannada_farm_alias: Optional[str]
    total_area_acres: float
    soil_type: str
    irrigation_source: str
    latitude: Optional[float]
    longitude: Optional[float]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- AI Pricing Benchmarks -----------------
class PriceBenchmarkResponse(BaseModel):
    id: str
    crop_name: str
    variety: Optional[str] = None
    district: str
    market_yard: str
    as_of_date: datetime
    min_price: float
    modal_price: float
    max_price: float
    unit: str
    data_source: str
    is_demonstration_data: bool

    model_config = ConfigDict(from_attributes=True)

# ----------------- Produce Listings -----------------
class ListingCreate(BaseModel):
    farm_id: Optional[str] = None
    crop_name: str
    crop_kannada: Optional[str] = None
    variety: Optional[str] = None
    category: str
    total_quantity: float = Field(..., gt=0)
    unit: str = "kg"
    minimum_order_quantity: float = Field(1.0, gt=0)
    price_per_unit: float = Field(..., gt=0)
    quality_grade: str = "Grade A (Premium)"
    quality_notes: Optional[str] = None
    organic_certified: bool = False
    harvest_date: str
    sale_deadline: Optional[str] = None
    shelf_life_days: int = 7
    status: str = "active"
    district: str = "Dakshina Kannada"
    taluk: str
    allow_group_pooling: bool = True
    ai_suggested_price: Optional[float] = None
    created_via_voice: bool = False
    voice_transcript_kannada: Optional[str] = None

class ListingUpdate(BaseModel):
    crop_name: Optional[str] = None
    crop_kannada: Optional[str] = None
    variety: Optional[str] = None
    category: Optional[str] = None
    total_quantity: Optional[float] = Field(None, gt=0)
    available_quantity: Optional[float] = Field(None, ge=0)
    unit: Optional[str] = None
    minimum_order_quantity: Optional[float] = Field(None, gt=0)
    price_per_unit: Optional[float] = Field(None, gt=0)
    quality_grade: Optional[str] = None
    quality_notes: Optional[str] = None
    organic_certified: Optional[bool] = None
    harvest_date: Optional[str] = None
    sale_deadline: Optional[str] = None
    shelf_life_days: Optional[int] = None
    status: Optional[str] = None
    district: Optional[str] = None
    taluk: Optional[str] = None
    allow_group_pooling: Optional[bool] = None

class ListingStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(draft|active|paused|archived)$")

class ListingResponse(BaseModel):
    id: str
    farmer_id: str
    farmer_name: Optional[str] = None
    farm_id: Optional[str] = None
    crop_name: str
    crop_kannada: Optional[str] = None
    variety: Optional[str] = None
    category: str
    total_quantity: float
    available_quantity: float
    unit: str
    minimum_order_quantity: float
    price_per_unit: float
    quality_grade: str
    quality_notes: Optional[str] = None
    organic_certified: bool
    harvest_date: str
    sale_deadline: Optional[str] = None
    shelf_life_days: int
    status: str
    district: str
    taluk: str
    allow_group_pooling: bool
    ai_suggested_price: Optional[float] = None
    created_via_voice: bool = False
    voice_transcript_kannada: Optional[str] = None
    market_price_reference: Optional[PriceBenchmarkResponse] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class ImageUploadResponse(BaseModel):
    image_id: str
    image_url: str
    filename: str
    size_bytes: int
    mime_type: str

class InvestigationCreate(BaseModel):
    farm_id: Optional[str] = None
    crop_name: str
    symptoms_description: str
    voice_note_transcript_kannada: Optional[str] = None
    affected_percentage: Optional[float] = 15.0
    image_url: Optional[str] = None
    image_id: Optional[str] = None
    image_base64: Optional[str] = None
    irrigation_details: Optional[str] = None
    observation_date: Optional[datetime] = None

class InvestigationObservationCreate(BaseModel):
    action_taken: str
    treatment_type: str
    spread_status: str
    notes: Optional[str] = None
    image_url: Optional[str] = None
    observation_date: Optional[datetime] = None

class InvestigationObservationResponse(BaseModel):
    id: str
    investigation_id: str
    observation_date: datetime
    action_taken: str
    treatment_type: str
    spread_status: str
    notes: Optional[str] = None
    image_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PossibleCauseItem(BaseModel):
    cause: str
    likelihood: str
    details: Optional[str] = None

class InvestigationResponse(BaseModel):
    id: str
    farm_id: str
    farmer_id: str
    crop_name: str
    symptoms_description: str
    voice_note_transcript_kannada: Optional[str] = None
    affected_percentage: Optional[float] = None
    image_url: Optional[str] = None
    ai_preliminary_diagnosis: Optional[str] = None
    ai_confidence_score: Optional[float] = None
    urgency: str
    remedies: List[str] = []
    possible_causes: List[PossibleCauseItem] = []
    recommended_next_checks: List[str] = []
    observations: List[InvestigationObservationResponse] = []
    ai_disclaimer_notice: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- FarmLab -----------------
class ExperimentObservationCreate(BaseModel):
    metric_name: str
    control_metric_value: float
    experimental_metric_value: float
    input_cost_control: Optional[float] = None
    input_cost_experimental: Optional[float] = None
    notes: Optional[str] = None
    observation_date: Optional[datetime] = None

class ExperimentObservationResponse(BaseModel):
    id: str
    experiment_id: str
    observation_date: datetime
    metric_name: str
    control_metric_value: float
    experimental_metric_value: float
    numerical_difference: float
    percentage_change: float
    cost_delta: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ExperimentCreate(BaseModel):
    farm_id: Optional[str] = None
    title: str
    hypothesis: str
    crop_tested: str
    control_method: str
    experimental_method: str
    plot_size_description: Optional[str] = None
    duration_days: int = 30

class ExperimentResponse(BaseModel):
    id: str
    farmer_id: str
    farm_id: str
    title: str
    hypothesis: str
    crop_tested: str
    control_method: str
    experimental_method: str
    plot_size_description: Optional[str] = None
    duration_days: Optional[int] = 30
    status: str
    ai_synthesis_summary: Optional[str] = None
    limitations_summary: Optional[str] = None
    next_experiment_suggestions: Optional[str] = None
    observations: List[ExperimentObservationResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- AI Price Assistant -----------------
class PriceComparisonRequest(BaseModel):
    crop_name: str
    asking_price: float = Field(..., gt=0)
    unit: str = "kg"
    district: Optional[str] = "Dakshina Kannada"
    taluk: Optional[str] = "Bantwal"

class PriceComparisonResponse(BaseModel):
    crop_name: str
    asking_price: float
    unit: str
    district: str
    taluk: str
    has_reference_data: bool
    reference_modal_price: Optional[float] = None
    reference_min_price: Optional[float] = None
    reference_max_price: Optional[float] = None
    reference_market_yard: Optional[str] = None
    reference_source: Optional[str] = None
    observation_date: Optional[str] = None
    difference: Optional[float] = None
    percentage_difference: Optional[float] = None
    position_relative_to_mandi: str
    ai_explanation: str
    disclaimer: str

# ----------------- Kannada Voice-Based Listing -----------------
class VoiceListingExtractRequest(BaseModel):
    transcript_kannada: str
    audio_base64: Optional[str] = None
    farmer_taluk: Optional[str] = "Bantwal"
    farmer_district: Optional[str] = "Dakshina Kannada"

class VoiceListingDraftResponse(BaseModel):
    crop_name: str
    crop_kannada: Optional[str] = None
    category: str
    quantity: float
    unit: str
    price_per_unit: float
    district: str
    taluk: str
    quality_grade: str
    confidence_score: float
    english_summary: str
    raw_transcript: str
    requires_farmer_review: bool = True


# ----------------- Smart Group Selling -----------------
# ----------------- Smart Group Selling -----------------
class GroupMatchRequest(BaseModel):
    crop_name: str
    target_quantity: float = Field(..., gt=0)
    unit: str = "kg"
    max_unit_price: Optional[float] = None
    district: Optional[str] = None
    taluk: Optional[str] = None
    organic_only: bool = False
    quality_grade: Optional[str] = None

class ProposedContribution(BaseModel):
    farmer_id: str
    farmer_name: str
    farmer_location: str
    listing_id: str
    crop_name: str
    quantity: float
    unit: str
    unit_price: float
    subtotal: float
    quality_grade: Optional[str] = None
    organic_certified: bool = False

class GroupMatchResponse(BaseModel):
    match_status: str  # 'full', 'insufficient_supply', 'no_supply'
    crop_name: str
    target_quantity: float
    total_matched_quantity: float
    shortfall_quantity: float
    unit: str
    weighted_average_price: float
    total_estimated_amount: float
    is_achievable: bool
    matching_explanation: str
    contributions: List[ProposedContribution] = []

class GroupOfferCreate(BaseModel):
    crop_name: str
    variety: Optional[str] = None
    target_quantity: float = Field(..., gt=0)
    unit: str = "kg"
    offered_unit_price: Optional[float] = None
    target_taluk: str = "All Taluks"
    aggregation_hub_name: str = "Bantwal APMC Hub"
    delivery_address: Optional[str] = "Mangaluru Central Distribution Hub"
    delivery_terms: Optional[str] = "Consolidated delivery within 48 hours"
    expires_in_minutes: int = 60
    contributions: Optional[List[ProposedContribution]] = None

class ContributionCreate(BaseModel):
    listing_id: Optional[str] = None
    contributed_quantity: float = Field(..., gt=0)

class ContributionResponse(BaseModel):
    id: str
    group_offer_id: str
    farmer_id: str
    farmer_name: Optional[str] = None
    farmer_location: Optional[str] = None
    listing_id: Optional[str] = None
    contributed_quantity: float
    unit_price: float = 0.0
    subtotal: float = 0.0
    farmer_confirmed: bool = False
    farmer_confirmed_at: Optional[datetime] = None
    status: str
    contribution_timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class GroupOfferResponse(BaseModel):
    id: str
    buyer_id: Optional[str] = None
    buyer_name: Optional[str] = None
    crop_name: str
    variety: Optional[str] = None
    target_quantity: float
    current_committed_quantity: float
    unit: str
    offered_unit_price: float
    total_amount: float = 0.0
    target_taluk: str
    aggregation_hub_name: str
    status: str
    matching_explanation: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_terms: Optional[str] = None
    order_id: Optional[str] = None
    expires_at: datetime
    contributions: List[ContributionResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Orders & Blockchain -----------------
class OrderItemResponse(BaseModel):
    id: str
    order_id: str
    listing_id: Optional[str] = None
    contributing_farmer_id: str
    farmer_name: str
    crop_name: str
    quantity: float
    unit: str
    unit_price: float
    subtotal: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class OrderEventResponse(BaseModel):
    id: str
    order_id: str
    previous_status: Optional[str] = None
    new_status: str
    actor_id: str
    reason: Optional[str] = None
    on_chain_tx_hash: Optional[str] = None
    blockchain_status: Optional[str] = None
    event_timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class OrderAgreementVersionResponse(BaseModel):
    id: str
    order_id: str
    version: int
    agreement_hash: str
    canonical_terms_json: Dict[str, Any]
    on_chain_tx_hash: Optional[str] = None
    contract_address: Optional[str] = None
    network_id: str
    block_number: Optional[int] = None
    is_current: bool
    terms_summary: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class OrderCreate(BaseModel):
    listing_id: Optional[str] = None
    group_offer_id: Optional[str] = None
    quantity: float = Field(..., gt=0)
    delivery_terms: str
    delivery_address: str

class OrderTransition(BaseModel):
    new_status: str
    reason: Optional[str] = None

class OrderCancel(BaseModel):
    reason: str = Field(..., min_length=3)

class OrderResponse(BaseModel):
    id: str
    order_code: str
    buyer_id: str
    seller_id: str
    buyer_name: str
    seller_name: str
    is_group_order: bool
    group_offer_id: Optional[str] = None
    total_amount: float
    order_status: str
    delivery_terms: str
    delivery_address: str
    farmer_confirmed: bool
    buyer_confirmed: bool
    cancellation_reason: Optional[str] = None
    cancelled_by: Optional[str] = None
    agreement_hash: str
    blockchain_tx_hash: Optional[str] = None
    smart_contract_order_id: Optional[int] = None
    escrow_status: str
    contract_address: Optional[str] = None
    network_identifier: Optional[str] = "31337"
    block_number: Optional[int] = None
    agreement_version: int = 1
    items: List[OrderItemResponse] = []
    events: List[OrderEventResponse] = []
    agreement_versions: List[OrderAgreementVersionResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Blockchain & Escrow & Traceability Schemas -----------------
class OnChainVerificationResponse(BaseModel):
    order_id: str
    order_code: str
    is_registered_on_chain: bool
    agreement_version: int
    off_chain_hash: str
    on_chain_hash: Optional[str] = None
    hash_match: bool
    contract_address: str
    network_identifier: str
    buyer_confirmed: bool
    farmer_confirmed: bool
    block_number: Optional[int] = None
    on_chain_status: Optional[str] = None
    verification_message: str
    last_checked_at: datetime

class EscrowDepositRequest(BaseModel):
    amount: Optional[float] = None

class EscrowActionResponse(BaseModel):
    order_id: str
    action: str # deposit, release, refund
    amount: float
    escrow_contract: str
    token_contract: str
    tx_hash: str
    block_number: Optional[int] = None
    status: str
    is_demonstration: bool = True
    disclaimer: str = "TEST TOKEN DEMONSTRATION ONLY - ZERO REAL MONETARY VALUE"

class TraceabilityCreateRequest(BaseModel):
    order_id: str
    listing_id: Optional[str] = None
    stage_name: str # harvest, packing, handover, receipt
    location: str
    quality_grade: Optional[str] = "Grade A"
    notes: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    is_independently_verified: bool = False
    verification_source: Optional[str] = "Self-reported by Producer"

class TraceabilityResponse(BaseModel):
    id: str
    order_id: str
    listing_id: Optional[str] = None
    stage_name: str
    location: str
    recorded_by: str
    quality_grade: Optional[str] = None
    is_independently_verified: bool = False
    verification_source: Optional[str] = None
    event_timestamp: datetime
    event_hash: str
    on_chain_tx_hash: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Reviews -----------------
class ReviewCreate(BaseModel):
    order_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None

class ReviewResponse(BaseModel):
    id: str
    order_id: str
    reviewer_id: str
    reviewer_name: Optional[str] = None
    reviewee_id: str
    reviewee_name: Optional[str] = None
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Health & Common -----------------
class HealthResponse(BaseModel):
    status: str
    project: str
    version: str
    database: str
    timestamp: datetime

# ----------------- Administration & Governance -----------------
class ListingModerationRequest(BaseModel):
    status: str = Field(..., description="active, paused, archived, flagged_fraudulent")
    reason: str = Field(..., min_length=3, description="Audit reason for administrative action")

class UserStatusUpdateRequest(BaseModel):
    is_active: bool
    reason: str = Field(..., min_length=3, description="Audit reason for account status change")

class AdminOverviewResponse(BaseModel):
    users_count: int
    farmers_count: int
    buyers_count: int
    listings_count: int
    active_listings_count: int
    flagged_listings_count: int
    orders_count: int
    completed_orders_count: int
    total_trade_volume: float
    group_offers_count: int
    blockchain_status: Dict[str, Any]
    ai_services_status: Dict[str, Any]

class AdminAuditLogResponse(BaseModel):
    id: str
    admin_id: Optional[str] = None
    admin_name: str
    action_type: str
    target_entity: str
    target_id: str
    details: str
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
