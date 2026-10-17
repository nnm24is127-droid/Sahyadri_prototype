-- =========================================================================
-- FarmConnect AI — Comprehensive PostgreSQL Schema (Phase 1 Specification)
-- Direct Market-Access Platform for Marginal Farmers (Dakshina Kannada & Udupi)
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- ENUMS
-- =========================================================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('farmer', 'buyer', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE crop_category AS ENUM (
        'plantation',     -- Arecanut, Coconut, Cashew, Rubber
        'spice',          -- Black Pepper, Cardamom, Ginger
        'horticulture',   -- Jasmine (Shankarpura Mallige), Mattu Gulla, Betel leaf
        'vegetable',      -- Okra, Ridge gourd, Yardlong bean
        'fruit',          -- Banana, Pineapple, Mango
        'cereal'          -- Traditional Red Rice / Paddy
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE listing_status AS ENUM ('draft', 'active', 'partially_allocated', 'sold_out', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE group_offer_status AS ENUM ('open', 'matched', 'locked', 'fulfilled', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
        'created', 
        'confirmed', 
        'escrow_funded', 
        'in_transit', 
        'delivered', 
        'completed', 
        'disputed', 
        'cancelled'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE quality_grade AS ENUM ('Grade A (Premium)', 'Grade B (Standard)', 'Grade C (Commercial)');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE urgency_level AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =========================================================================
-- 1. USERS
-- =========================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    role user_role NOT NULL DEFAULT 'farmer',
    preferred_language VARCHAR(10) NOT NULL DEFAULT 'kn', -- 'kn' or 'en'
    district VARCHAR(50) NOT NULL DEFAULT 'Dakshina Kannada',
    taluk VARCHAR(50) NOT NULL, -- Mangalore, Bantwal, Puttur, Belthangady, Sullia, Udupi, Kundapura, Karkala
    village VARCHAR(100),
    wallet_address VARCHAR(42), -- EVM 0x address
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 2. FARMS
-- =========================================================================
CREATE TABLE IF NOT EXISTS farms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    farm_name VARCHAR(150) NOT NULL,
    kannada_farm_alias VARCHAR(150),
    total_area_acres NUMERIC(6, 2) NOT NULL CHECK (total_area_acres > 0),
    soil_type VARCHAR(100) DEFAULT 'Coastal Laterite',
    irrigation_source VARCHAR(100) DEFAULT 'Borewell & Drip Irrigation',
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 3. CROP INVESTIGATIONS (FarmForensics)
-- =========================================================================
CREATE TABLE IF NOT EXISTS crop_investigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crop_name VARCHAR(100) NOT NULL,
    symptoms_description TEXT NOT NULL,
    voice_note_transcript_kannada TEXT,
    affected_percentage NUMERIC(5, 2) CHECK (affected_percentage >= 0 AND affected_percentage <= 100),
    image_url TEXT,
    ai_preliminary_diagnosis TEXT,
    ai_confidence_score NUMERIC(4, 2) CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 1.0),
    urgency urgency_level NOT NULL DEFAULT 'medium',
    ai_disclaimer_notice TEXT NOT NULL DEFAULT 'Notice: AI-assisted agricultural observation for informational and early warning purposes. Consult local Krishi Vigyan Kendra (KVK) or horticulture officers before applying chemical treatments.',
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- open, resolved, monitoring
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 4. INVESTIGATION OBSERVATIONS (Follow-up evidence/actions for FarmForensics)
-- =========================================================================
CREATE TABLE IF NOT EXISTS investigation_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES crop_investigations(id) ON DELETE CASCADE,
    observation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    action_taken TEXT NOT NULL, -- e.g. "Applied 1% Bordeaux mixture on bunches"
    treatment_type VARCHAR(50) NOT NULL, -- biological, chemical, cultural/sanitation
    spread_status VARCHAR(50) NOT NULL, -- contained, spreading, resolved
    notes TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 5. EXPERIMENTS (FarmLab)
-- =========================================================================
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    hypothesis TEXT NOT NULL,
    crop_tested VARCHAR(100) NOT NULL,
    control_method TEXT NOT NULL, -- Standard practice (e.g., standard NPK)
    experimental_method TEXT NOT NULL, -- Trial practice (e.g., Jeevamrutha soil drenching)
    plot_size_description VARCHAR(100),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress', -- in_progress, completed, abandoned
    ai_synthesis_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 6. EXPERIMENT OBSERVATIONS (Metrics for FarmLab)
-- =========================================================================
CREATE TABLE IF NOT EXISTS experiment_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    observation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    metric_name VARCHAR(100) NOT NULL, -- e.g., 'Fruit count per vine', 'Nut drop count', 'Spike length (cm)'
    control_metric_value NUMERIC(10, 2) NOT NULL,
    experimental_metric_value NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 7. MARKET PRICE REFERENCES (AI Pricing & Mandi APMC Benchmarks)
-- =========================================================================
CREATE TABLE IF NOT EXISTS market_price_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_name VARCHAR(100) NOT NULL,
    variety VARCHAR(100),
    district VARCHAR(50) NOT NULL, -- Dakshina Kannada or Udupi
    market_yard VARCHAR(100) NOT NULL, -- e.g., 'APMC Bantwal', 'APMC Mangalore', 'APMC Udupi', 'CAMPCO Central'
    as_of_date DATE NOT NULL,
    min_price NUMERIC(10, 2) NOT NULL CHECK (min_price > 0),
    modal_price NUMERIC(10, 2) NOT NULL CHECK (modal_price >= min_price),
    max_price NUMERIC(10, 2) NOT NULL CHECK (max_price >= modal_price),
    unit VARCHAR(20) NOT NULL DEFAULT 'kg',
    data_source VARCHAR(150) NOT NULL, -- e.g. "Karnataka State APMC Bulletin (Demonstration Dataset)"
    is_demonstration_data BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 8. PRODUCE LISTINGS
-- =========================================================================
CREATE TABLE IF NOT EXISTS produce_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
    crop_name VARCHAR(100) NOT NULL,
    variety VARCHAR(100),
    category crop_category NOT NULL,
    total_quantity NUMERIC(10, 2) NOT NULL CHECK (total_quantity > 0),
    available_quantity NUMERIC(10, 2) NOT NULL CHECK (available_quantity >= 0),
    unit VARCHAR(20) NOT NULL DEFAULT 'kg',
    minimum_order_quantity NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (minimum_order_quantity > 0),
    price_per_unit NUMERIC(10, 2) NOT NULL CHECK (price_per_unit > 0),
    quality_grade quality_grade NOT NULL DEFAULT 'Grade A (Premium)',
    organic_certified BOOLEAN NOT NULL DEFAULT FALSE,
    harvest_date DATE NOT NULL,
    shelf_life_days INT DEFAULT 7,
    status listing_status NOT NULL DEFAULT 'active',
    district VARCHAR(50) NOT NULL,
    taluk VARCHAR(50) NOT NULL,
    allow_group_pooling BOOLEAN NOT NULL DEFAULT TRUE,
    reference_price_id UUID REFERENCES market_price_references(id) ON DELETE SET NULL,
    ai_suggested_price NUMERIC(10, 2),
    created_via_voice BOOLEAN NOT NULL DEFAULT FALSE,
    voice_transcript_kannada TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 9. GROUP OFFERS (Smart Group Selling Pooled Requirements)
-- =========================================================================
CREATE TABLE IF NOT EXISTS group_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Buyer initiating bulk requirement (or system pool)
    crop_name VARCHAR(100) NOT NULL,
    variety VARCHAR(100),
    target_quantity NUMERIC(10, 2) NOT NULL CHECK (target_quantity > 0),
    current_committed_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (current_committed_quantity <= target_quantity),
    unit VARCHAR(20) NOT NULL DEFAULT 'kg',
    offered_unit_price NUMERIC(10, 2) NOT NULL CHECK (offered_unit_price > 0),
    target_taluk VARCHAR(50) NOT NULL,
    aggregation_hub_name VARCHAR(150) NOT NULL, -- e.g., 'Bantwal Krishi Hub', 'Udupi Market Yard'
    status group_offer_status NOT NULL DEFAULT 'open',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 10. OFFER CONTRIBUTIONS (Multiple Farmers Contributing to 1 Requirement)
-- =========================================================================
CREATE TABLE IF NOT EXISTS offer_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_offer_id UUID NOT NULL REFERENCES group_offers(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES produce_listings(id) ON DELETE SET NULL,
    contributed_quantity NUMERIC(10, 2) NOT NULL CHECK (contributed_quantity > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'committed', -- committed, aggregated, cancelled
    contribution_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_offer_id, farmer_id)
);

-- =========================================================================
-- 11. ORDERS
-- =========================================================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code VARCHAR(32) UNIQUE NOT NULL,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Farmer or Lead Group Seller
    is_group_order BOOLEAN NOT NULL DEFAULT FALSE,
    group_offer_id UUID REFERENCES group_offers(id) ON DELETE SET NULL,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
    order_status order_status NOT NULL DEFAULT 'created',
    delivery_terms TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    agreement_hash VARCHAR(66), -- SHA-256 / Keccak-256 hash of agreed terms
    blockchain_tx_hash VARCHAR(66),
    smart_contract_order_id BIGINT,
    escrow_status VARCHAR(50) DEFAULT 'unfunded', -- unfunded, deposited, released, refunded
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 12. ORDER ITEMS (Itemized produce inside an order)
-- =========================================================================
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES produce_listings(id) ON DELETE SET NULL,
    contributing_farmer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    crop_name VARCHAR(100) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price > 0),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 13. ORDER EVENTS (State machine transition audit log)
-- =========================================================================
CREATE TABLE IF NOT EXISTS order_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    previous_status order_status,
    new_status order_status NOT NULL,
    actor_id UUID NOT NULL REFERENCES users(id),
    reason TEXT,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 14. REVIEWS
-- =========================================================================
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(order_id, reviewer_id)
);

-- =========================================================================
-- 15. TRACEABILITY EVENTS (Milestones from farm harvest to delivery)
-- =========================================================================
CREATE TABLE IF NOT EXISTS traceability_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES produce_listings(id) ON DELETE CASCADE,
    stage_name VARCHAR(100) NOT NULL, -- Harvested, Inspected, Hub Aggregated, Dispatched, Delivered
    location VARCHAR(150) NOT NULL,
    recorded_by UUID NOT NULL REFERENCES users(id),
    quality_grade quality_grade,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_hash VARCHAR(66) NOT NULL,
    on_chain_tx_hash VARCHAR(66),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 16. BLOCKCHAIN TRANSACTION REFERENCES
-- =========================================================================
CREATE TABLE IF NOT EXISTS blockchain_transaction_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    contract_name VARCHAR(100) NOT NULL, -- FarmAgreementRegistry, FarmTraceability, FarmEscrow
    contract_address VARCHAR(42) NOT NULL,
    action_type VARCHAR(100) NOT NULL, -- recordAgreement, recordTraceEvent, depositEscrow, releaseEscrow
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    block_number BIGINT,
    network_id VARCHAR(50) NOT NULL DEFAULT 'hardhat_local',
    status VARCHAR(50) NOT NULL DEFAULT 'confirmed',
    payload_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- PERFORMANCE INDEXES
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_district_taluk ON users(district, taluk);

CREATE INDEX IF NOT EXISTS idx_listings_crop_status ON produce_listings(crop_name, status);
CREATE INDEX IF NOT EXISTS idx_listings_taluk ON produce_listings(district, taluk);
CREATE INDEX IF NOT EXISTS idx_listings_farmer ON produce_listings(farmer_id);

CREATE INDEX IF NOT EXISTS idx_group_offers_crop_status ON group_offers(crop_name, status);
CREATE INDEX IF NOT EXISTS idx_offer_contributions_offer ON offer_contributions(group_offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_contributions_farmer ON offer_contributions(farmer_id);

CREATE INDEX IF NOT EXISTS idx_orders_code ON orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_traceability_order ON traceability_events(order_id);
CREATE INDEX IF NOT EXISTS idx_bctx_order ON blockchain_transaction_references(order_id);
