import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Float,
    Integer,
    Text,
    DateTime,
    ForeignKey,
    JSON,
    Numeric,
    Enum as SQLEnum,
    Date,
    UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

# 1. Users
class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    phone_number = Column(String(20), nullable=False)
    role = Column(String(20), nullable=False, default="farmer") # farmer, buyer, admin
    preferred_language = Column(String(10), default="kn")
    district = Column(String(50), default="Dakshina Kannada")
    taluk = Column(String(50), nullable=False)
    village = Column(String(100), nullable=True)
    wallet_address = Column(String(42), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    farms = relationship("Farm", back_populates="farmer", cascade="all, delete-orphan")
    listings = relationship("ProduceListing", back_populates="farmer", cascade="all, delete-orphan")
    investigations = relationship("CropInvestigation", back_populates="farmer", cascade="all, delete-orphan")
    experiments = relationship("Experiment", back_populates="farmer", cascade="all, delete-orphan")

# 2. Farms
class Farm(Base):
    __tablename__ = "farms"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    farmer_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    farm_name = Column(String(150), nullable=False)
    kannada_farm_alias = Column(String(150), nullable=True)
    total_area_acres = Column(Float, nullable=False)
    soil_type = Column(String(100), default="Coastal Laterite")
    irrigation_source = Column(String(100), default="Borewell & Drip Irrigation")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    farmer = relationship("User", back_populates="farms")
    investigations = relationship("CropInvestigation", back_populates="farm", cascade="all, delete-orphan")
    experiments = relationship("Experiment", back_populates="farm", cascade="all, delete-orphan")

# 3. Crop Investigations (FarmForensics)
class CropInvestigation(Base):
    __tablename__ = "crop_investigations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    farm_id = Column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    farmer_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    crop_name = Column(String(100), nullable=False)
    symptoms_description = Column(Text, nullable=False)
    voice_note_transcript_kannada = Column(Text, nullable=True)
    affected_percentage = Column(Float, nullable=True)
    irrigation_details = Column(String(150), nullable=True)
    image_url = Column(String(500), nullable=True)
    ai_preliminary_diagnosis = Column(Text, nullable=True)
    ai_confidence_score = Column(Float, nullable=True)
    urgency = Column(String(20), default="medium")
    remedies_json = Column(JSON, default=list)
    possible_causes_json = Column(JSON, default=list)
    recommended_checks_json = Column(JSON, default=list)
    ai_disclaimer_notice = Column(
        Text,
        default="Notice: AI-assisted agricultural observation for informational and early warning purposes. Consult local Krishi Vigyan Kendra (KVK) Brahmavar / Mangalore or horticulture officers before applying chemical treatments."
    )
    status = Column(String(50), default="open") # open, resolved, monitoring
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    farmer = relationship("User", back_populates="investigations")
    farm = relationship("Farm", back_populates="investigations")
    observations = relationship("InvestigationObservation", back_populates="investigation", cascade="all, delete-orphan")
    images = relationship("InvestigationImage", back_populates="investigation")

# 3b. FarmForensics Uploaded Specimen Images
class InvestigationImage(Base):
    __tablename__ = "investigation_images"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    farmer_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    investigation_id = Column(String(36), ForeignKey("crop_investigations.id", ondelete="SET NULL"), nullable=True, index=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    mime_type = Column(String(50), nullable=False)
    sha256_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    farmer = relationship("User")
    investigation = relationship("CropInvestigation", back_populates="images")

# 4. Investigation Observations
class InvestigationObservation(Base):
    __tablename__ = "investigation_observations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    investigation_id = Column(String(36), ForeignKey("crop_investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    observation_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    action_taken = Column(Text, nullable=False)
    treatment_type = Column(String(50), nullable=False)
    spread_status = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    investigation = relationship("CropInvestigation", back_populates="observations")

# 5. Experiments (FarmLab)
class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    farmer_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    farm_id = Column(String(36), ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    hypothesis = Column(Text, nullable=False)
    crop_tested = Column(String(100), nullable=False)
    control_method = Column(Text, nullable=False)
    experimental_method = Column(Text, nullable=False)
    plot_size_description = Column(String(100), nullable=True)
    duration_days = Column(Integer, default=30)
    start_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    end_date = Column(DateTime, nullable=True)
    status = Column(String(50), default="in_progress")
    ai_synthesis_summary = Column(Text, nullable=True)
    limitations_summary = Column(Text, nullable=True)
    next_experiment_suggestions = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    farmer = relationship("User", back_populates="experiments")
    farm = relationship("Farm", back_populates="experiments")
    observations = relationship("ExperimentObservation", back_populates="experiment", cascade="all, delete-orphan")

# 6. Experiment Observations
class ExperimentObservation(Base):
    __tablename__ = "experiment_observations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    experiment_id = Column(String(36), ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False, index=True)
    observation_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    metric_name = Column(String(100), nullable=False)
    control_metric_value = Column(Float, nullable=False)
    experimental_metric_value = Column(Float, nullable=False)
    numerical_difference = Column(Float, default=0.0, nullable=False)
    percentage_change = Column(Float, default=0.0, nullable=False)
    cost_delta = Column(Float, nullable=True)
    input_cost_control = Column(Float, nullable=True)
    input_cost_experimental = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    experiment = relationship("Experiment", back_populates="observations")

# 7. Market Price References
class MarketPriceReference(Base):
    __tablename__ = "market_price_references"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    crop_name = Column(String(100), nullable=False, index=True)
    variety = Column(String(100), nullable=True)
    district = Column(String(50), nullable=False)
    market_yard = Column(String(100), nullable=False)
    as_of_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    min_price = Column(Float, nullable=False)
    modal_price = Column(Float, nullable=False)
    max_price = Column(Float, nullable=False)
    unit = Column(String(20), default="kg", nullable=False)
    data_source = Column(String(150), nullable=False)
    is_demonstration_data = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

# 8. Produce Listings
class ProduceListing(Base):
    __tablename__ = "produce_listings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    farmer_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    farm_id = Column(String(36), ForeignKey("farms.id", ondelete="SET NULL"), nullable=True)
    crop_name = Column(String(100), nullable=False, index=True)
    crop_kannada = Column(String(100), nullable=True)
    variety = Column(String(100), nullable=True)
    category = Column(String(50), nullable=False)
    total_quantity = Column(Float, nullable=False)
    available_quantity = Column(Float, nullable=False)
    unit = Column(String(20), default="kg", nullable=False)
    minimum_order_quantity = Column(Float, default=1.0, nullable=False)
    price_per_unit = Column(Float, nullable=False)
    quality_grade = Column(String(50), default="Grade A (Premium)", nullable=False)
    quality_notes = Column(Text, nullable=True)
    organic_certified = Column(Boolean, default=False, nullable=False)
    harvest_date = Column(String(20), nullable=False)
    sale_deadline = Column(String(50), nullable=True)
    shelf_life_days = Column(Integer, default=7)
    status = Column(String(50), default="active", nullable=False) # draft, active, paused, sold_out, archived
    district = Column(String(50), nullable=False)
    taluk = Column(String(50), nullable=False, index=True)
    allow_group_pooling = Column(Boolean, default=True, nullable=False)
    ai_suggested_price = Column(Float, nullable=True)
    created_via_voice = Column(Boolean, default=False, nullable=False)
    voice_transcript_kannada = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    farmer = relationship("User", back_populates="listings")

# 9. Group Offers (Smart Group Selling)
class GroupOffer(Base):
    __tablename__ = "group_offers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    buyer_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    buyer_name = Column(String(150), nullable=True)
    crop_name = Column(String(100), nullable=False, index=True)
    variety = Column(String(100), nullable=True)
    target_quantity = Column(Float, nullable=False)
    current_committed_quantity = Column(Float, default=0.0, nullable=False)
    unit = Column(String(20), default="kg", nullable=False)
    offered_unit_price = Column(Float, nullable=False)
    total_amount = Column(Float, default=0.0, nullable=False)
    target_taluk = Column(String(50), nullable=False)
    aggregation_hub_name = Column(String(150), nullable=False)
    status = Column(String(50), default="open", nullable=False) # open, proposed, matched, accepted, rejected, expired, cancelled, fulfilled
    matching_explanation = Column(Text, nullable=True)
    delivery_address = Column(Text, nullable=True)
    delivery_terms = Column(Text, nullable=True)
    order_id = Column(String(36), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    contributions = relationship("OfferContribution", back_populates="group_offer", cascade="all, delete-orphan")

# 10. Offer Contributions
class OfferContribution(Base):
    __tablename__ = "offer_contributions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    group_offer_id = Column(String(36), ForeignKey("group_offers.id", ondelete="CASCADE"), nullable=False, index=True)
    farmer_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    farmer_name = Column(String(150), nullable=True)
    farmer_location = Column(String(150), nullable=True)
    listing_id = Column(String(36), ForeignKey("produce_listings.id", ondelete="SET NULL"), nullable=True)
    contributed_quantity = Column(Float, nullable=False)
    unit_price = Column(Float, default=0.0, nullable=False)
    subtotal = Column(Float, default=0.0, nullable=False)
    farmer_confirmed = Column(Boolean, default=False, nullable=False)
    farmer_confirmed_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="committed") # reserved, committed, confirmed, rejected, released, aggregated, cancelled
    contribution_timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    group_offer = relationship("GroupOffer", back_populates="contributions")

# 11. Orders
class Order(Base):
    __tablename__ = "orders"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_code = Column(String(32), unique=True, index=True, nullable=False)
    buyer_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    seller_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    buyer_name = Column(String(150), nullable=False)
    seller_name = Column(String(150), nullable=False)
    is_group_order = Column(Boolean, default=False, nullable=False)
    group_offer_id = Column(String(36), ForeignKey("group_offers.id", ondelete="SET NULL"), nullable=True)
    total_amount = Column(Float, nullable=False)
    order_status = Column(String(50), default="created", nullable=False)
    delivery_terms = Column(Text, nullable=False)
    delivery_address = Column(Text, nullable=False)
    farmer_confirmed = Column(Boolean, default=False, nullable=False)
    buyer_confirmed = Column(Boolean, default=True, nullable=False) # Buyer confirmed by submitting order
    cancellation_reason = Column(Text, nullable=True)
    cancelled_by = Column(String(36), nullable=True)
    agreement_hash = Column(String(66), nullable=False)
    blockchain_tx_hash = Column(String(66), nullable=True)
    smart_contract_order_id = Column(Integer, nullable=True)
    escrow_status = Column(String(50), default="unfunded", nullable=False)
    contract_address = Column(String(42), nullable=True)
    network_identifier = Column(String(50), default="31337", nullable=False)
    block_number = Column(Integer, nullable=True)
    agreement_version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    events = relationship("OrderEvent", back_populates="order", cascade="all, delete-orphan")
    traceability_events = relationship("TraceabilityEvent", back_populates="order", cascade="all, delete-orphan")
    agreement_versions = relationship("OrderAgreementVersion", back_populates="order", cascade="all, delete-orphan")

# 12. Order Items
class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    listing_id = Column(String(36), ForeignKey("produce_listings.id", ondelete="SET NULL"), nullable=True)
    contributing_farmer_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    farmer_name = Column(String(150), nullable=False)
    crop_name = Column(String(100), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), default="kg", nullable=False)
    unit_price = Column(Float, nullable=False)
    subtotal = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    order = relationship("Order", back_populates="items")

# 13. Order Events
class OrderEvent(Base):
    __tablename__ = "order_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    actor_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=True)
    on_chain_tx_hash = Column(String(66), nullable=True)
    blockchain_status = Column(String(50), nullable=True) # pending, confirmed, failed, reverted
    event_timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    order = relationship("Order", back_populates="events")

# 14. Reviews
class Review(Base):
    __tablename__ = "reviews"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewee_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("order_id", "reviewer_id", name="uq_order_reviewer"),
    )

# 15. Traceability Events
class TraceabilityEvent(Base):
    __tablename__ = "traceability_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    listing_id = Column(String(36), ForeignKey("produce_listings.id", ondelete="CASCADE"), nullable=True)
    stage_name = Column(String(100), nullable=False) # harvest, packing, handover, receipt
    location = Column(String(150), nullable=False)
    recorded_by = Column(String(150), nullable=False)
    quality_grade = Column(String(50), nullable=True)
    is_independently_verified = Column(Boolean, default=False, nullable=False)
    verification_source = Column(String(150), nullable=True) # e.g. "Self-reported by Farmer", "APMC Yard Inspector", "Buyer Intake QC"
    event_timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    event_hash = Column(String(66), nullable=False)
    on_chain_tx_hash = Column(String(66), nullable=True)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    order = relationship("Order", back_populates="traceability_events")

# 16. Blockchain Transaction References
class BlockchainTxReference(Base):
    __tablename__ = "blockchain_transaction_references"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    contract_name = Column(String(100), nullable=False)
    contract_address = Column(String(42), nullable=False)
    action_type = Column(String(100), nullable=False)
    tx_hash = Column(String(66), unique=True, nullable=False)
    block_number = Column(Integer, nullable=True)
    network_id = Column(String(50), default="31337", nullable=False)
    status = Column(String(50), default="confirmed", nullable=False) # pending, confirmed, failed, reverted
    payload_snapshot = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

# 17. Order Agreement Versions (Tamper-evident Audit Trail)
class OrderAgreementVersion(Base):
    __tablename__ = "order_agreement_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    agreement_hash = Column(String(66), nullable=False)
    canonical_terms_json = Column(JSON, nullable=False)
    on_chain_tx_hash = Column(String(66), nullable=True)
    contract_address = Column(String(42), nullable=True)
    network_id = Column(String(50), default="31337", nullable=False)
    block_number = Column(Integer, nullable=True)
    is_current = Column(Boolean, default=True, nullable=False)
    terms_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    order = relationship("Order", back_populates="agreement_versions")

# 18. Admin Audit Logs (Governance & Operational Integrity)
class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    admin_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    admin_name = Column(String(150), nullable=False)
    action_type = Column(String(100), nullable=False)  # e.g., moderate_listing, suspend_user, platform_audit
    target_entity = Column(String(50), nullable=False) # listing, user, order, system
    target_id = Column(String(36), nullable=False)
    details = Column(Text, nullable=False)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    admin = relationship("User")
