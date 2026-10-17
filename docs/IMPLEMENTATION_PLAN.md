# FarmConnect AI — Sequential Implementation Plan

This roadmap governs the systematic development of FarmConnect AI across 7 distinct phases, ensuring rigorous testing, clean separation of concerns, and full feature completeness.

---

## Phase 1: Architecture, Requirements, DB Schema, API Contracts & Project Scaffolding
- [x] Regional requirements and Dakshina Kannada / Udupi problem analysis.
- [x] Modular Monolith Architecture specification (`docs/ARCHITECTURE.md`).
- [x] Authoritative PostgreSQL / Supabase schema with full relations, triggers, indexes (`docs/DATABASE_SCHEMA.sql`).
- [x] Comprehensive OpenAPI / REST contracts (`docs/API_CONTRACTS.md`).
- [x] Implementation Plan (`docs/IMPLEMENTATION_PLAN.md`).
- [x] Project Scaffolding: `backend/`, `frontend/`, `blockchain/`, `.env.example`.

---

## Phase 2: Backend Core — FastAPI, Models, Auth & Database Layer
1. **Directory Structure:**
   - `backend/app/core/` (config, security, database session).
   - `backend/app/models/` (SQLAlchemy / SQLModel / asyncpg models mirroring schema).
   - `backend/app/schemas/` (Pydantic models for validation and serialization).
   - `backend/app/routes/` (Auth, Users, Farms, Crops).
2. **Security & Authentication:**
   - JWT tokens with password hashing (bcrypt / passlib / argon2).
   - Role-based dependencies (`require_farmer`, `require_buyer`, `require_admin`).
3. **Database Migration / SQLite / PostgreSQL dual-compatibility:**
   - Seamless local execution with SQLite (in-memory or file for rapid testing) and PostgreSQL compatibility for production Supabase.
4. **Validation & Unit Tests:**
   - Pytest suite testing auth flow, token generation, user registration, role enforcement, and farm/crop persistence.

---

## Phase 3: Domain Services & Algorithms
1. **Produce Listings Management:**
   - Full CRUD for farmer produce listings.
   - Advanced multi-filter search (crop category, taluk, district, organic, price range).
2. **Smart Group Selling Algorithm:**
   - Quantity-matching solver that pools smallholder batches within proximity (Taluk level) to satisfy buyer bulk orders.
   - Pool lifecycle states (`forming`, `matched`, `locked`, `fulfilled`).
3. **Order Lifecycle & State Machine:**
   - Order creation with cryptographic `agreement_hash` generation.
   - Status transition validation (`created` -> `confirmed` -> `escrow_funded` -> `dispatched` -> `delivered` -> `completed`).
4. **Produce Traceability Engine:**
   - Milestone event logging with SHA-256 event chaining.
5. **Unit & Integration Tests:**
   - Test group selling matching algorithm with edge cases (partial matches, exact matches, overflowing quantities).
   - Test order state machine invalid transition protections.

---

## Phase 4: AI Engine & Kannada Voice Assistant
1. **AI Price Assistant Service:**
   - APMC Mandi price dataset for Dakshina Kannada (Mangalore, Bantwal, Puttur, Sullia) and Udupi.
   - Fair-value recommendation algorithm comparing wholesale APMC modal rates vs direct-to-buyer margins.
   - Anthropic Claude API integration with fallback rule engine when API key is not present.
   - Explicit demonstration data flags and informational disclaimers.
2. **FarmForensics Service:**
   - Crop pathology knowledge base focused on coastal Karnataka issues (*Koleroga* in arecanut, *Katté* disease in pepper, yellow leaf disease, bud rot).
   - Image and symptom diagnostics with Claude Vision integration + comprehensive safe fallback.
3. **FarmLab Assistant:**
   - Experiment setup generator and observation data analyzer.
4. **Kannada Voice-to-Listing Processor:**
   - Speech transcript NLP extractor for Kannada language numbers, crops, and units (*ಕೆಜಿ, ಕ್ವಿಂಟಾಲ್, ಚೀಲ, ರೂಪಾಯಿ*).
   - Generates structured editable listing draft with confidence score.
5. **Tests:**
   - Test AI price engine calculation.
   - Test Kannada voice parser with standard voice query patterns.
   - Test forensics diagnostic safety disclaimers.

---

## Phase 5: Blockchain Smart Contracts & Hardhat Integration
1. **Smart Contracts (Solidity 0.8.24):**
   - `FarmAgreementRegistry.sol`: Anchors SHA-256 agreement hashes, parties, timestamps, and order status.
   - `FarmTraceability.sol`: Emits verifiable traceability milestone events.
   - `TestFarmToken.sol`: ERC-20 test token (`FARM`) with faucet mechanism.
   - `FarmEscrow.sol`: Holds test tokens in escrow upon order confirmation, releases upon verified delivery, or refunds on cancellation.
2. **Hardhat Configuration & Tests:**
   - Local Hardhat network deployment scripts.
   - Comprehensive test suite for agreement anchoring, traceability logging, and escrow deposit/release.
3. **Backend Blockchain Adapter:**
   - `ethers.js` / `web3.py` client for querying on-chain hashes and validating transactions.
   - Clear development mock/simulator fallback when running without a local blockchain node.

---

## Phase 6: Frontend Development (React + TypeScript + Tailwind CSS)
1. **Design System & Aesthetics:**
   - Modern agricultural aesthetic (coastal green, warm earth tones, deep slate dark-mode compatible accents, glassmorphic cards).
   - Lucide icons, responsive layout for mobile (farmers in the field) and desktop (buyers/admins).
   - Bilingual support: Quick toggle between English and Kannada (ಕನ್ನಡ) for key workflows.
2. **Core Pages & Dashboards:**
   - Landing page highlighting PS 1.2 mission and market access.
   - Farmer Dashboard: Active crops, listing management, earnings, orders.
   - Kannada Voice Listing Modal: Voice waveform recording, editable transcription preview, one-click listing creation.
   - FarmForensics Interactive Diagnostic: Symptom checker, photo upload preview, AI diagnosis card with disclaimers.
   - FarmLab Experiment Tracker: Controlled tests comparison view.
   - Buyer Discovery Marketplace: Filterable crop cards, group pooling opportunities, direct order placement.
   - Smart Group Selling Hub: Visual progress bars of ongoing pools.
   - Order Details & Traceability Timeline: Visual timeline with blockchain transaction badges.
   - Web3 Escrow Payment Widget: Connect wallet (or 1-click test token demo mode) to deposit and release escrow funds.

---

## Phase 7: End-to-End Integration, Automated Testing, Deployment & Verification
1. **Automated Test Matrix:**
   - Backend pytest suite covering all endpoints and business logic.
   - Frontend build verification (`npm run build`).
   - Smart contract test suite (`npx hardhat test`).
2. **Deployment Ready Setup:**
   - Vercel configuration (`vercel.json`) for frontend.
   - Render / Docker configuration (`Dockerfile`, `render.yaml`) for backend.
   - Complete `.env.example` with clear instructions.
   - Step-by-step Quickstart guide (`README.md`).
