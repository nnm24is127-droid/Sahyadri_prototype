
# FarmConnect AI — System Architecture & Design Specification

## 1. Executive Summary & Problem Context
**Problem Statement:** PS 1.2 — Direct Market-Access Platform for Marginal Farmers in Dakshina Kannada and Udupi, Karnataka.

### Regional Context & Ground Realities
Marginal farmers in coastal Karnataka (Dakshina Kannada and Udupi districts) cultivate unique cash and horticulture crops on small landholdings (typically < 1–2 hectares):
- **Key Produce:** Arecanut (*Adike*), Coconut (*Tengu*), Black Pepper (*Menasu*), Cashew (*Geru*), Udupi Mattu Gulla (GI-tagged brinjal), Shankarpura Mallige (GI-tagged jasmine), Kokum (*Punarpuli*), Betel leaves, and seasonal vegetables/fruits (Banana, Pineapples).
- **Core Challenges:**
  1. **Intermediary Exploitation:** Middlemen capture 30–50% margins while smallholders lack bargaining power.
  2. **Fragmented Small Lot Sizes:** Single farmers cannot meet bulk minimum
   order quantities (MOQ) demanded by hotels, caterers, supermarkets, and restaurants in Mangalore, Manipal, and Udupi.
  3. **Price Asymmetry:** Difficulty accessing accurate APMC (Bantwal, Mangalore, Puttur, Kundapura, Udupi) trends.
  4. **Crop Health Vulnerabilities:** Fungal diseases (e.g., *Koleroga* in arecanut, bud rot in palms, yellow leaf disease) threaten seasonal livelihood.
  5. **Language & Tech Barriers:** Farmers communicate primarily in Kannada or Tulu; text-heavy English applications fail in the field.

---

## 2. High-Level Modular Architecture

FarmConnect AI is structured as a **Modular Monolith** for high cohesion, rapid local development, clean testability, and deterministic deployment.

```
                              +--------------------------------------------------+
                              |               Client Application                 |
                              |   React 18 + Vite + TypeScript + Tailwind CSS   |
                              |   - Farmer Dashboard (Kannada / English UI)      |
                              |   - Buyer Discovery & Negotiation Hub            |
                              |   - Voice Recording & Web Speech Audio Gateway   |
                              |   - Ethers.js Web3 Provider (EVM Testnet/Local)  |
                              +-------------------------+------------------------+
                                                        |
                                                        | HTTPS REST / JSON
                                                        v
+---------------------------------------------------------------------------------------------------+
|                                   FastAPI Modular Monolith Core                                   |
|                                                                                                   |
|  +--------------------+   +--------------------+   +--------------------+   +------------------+  |
|  |    Auth & RBAC     |   |    Farm & Crops    |   |   Forensics & Lab  |   | AI Price Engine  |  |
|  | JWT, Farmer/Buyer  |   | Profiles & History |   | Claude Vision/Text |   | APMC DK/Udupi    |  |
|  +--------------------+   +--------------------+   +--------------------+   +------------------+  |
|                                                                                                   |
|  +--------------------+   +--------------------+   +--------------------+   +------------------+  |
|  | Listings & Pool    |   | Smart Group Selling|   |  Orders & Escrow   |   | Traceability     |  |
|  | Direct Marketplace |   | Quantity Matching  |   | State & Hash Sync  |   | Merkle/Event Log |  |
|  +--------------------+   +--------------------+   +--------------------+   +------------------+  |
|                                                                                                   |
|  +---------------------------------------------+   +-------------------------------------------+  |
|  |         Kannada Voice Listing Parser        |   |         EVM Blockchain Adapter            |  |
|  |      Speech API + Claude Audio Extract      |   |   Agreement Registry + TestToken Escrow   |  |
|  +---------------------------------------------+   +-------------------------------------------+  |
+------------------------------------+-------------------------------------+------------------------+
                                     |                                     |
                                     v                                     v
                  +--------------------------------------+   +-----------------------------------+
                  |        Authoritative Database        |   |        EVM Smart Contracts        |
                  |     PostgreSQL (Supabase/Local)      |   |     Hardhat / Local Node / Sepolia|
                  |  - Users, Farms, Listings, Orders    |   |  - FarmAgreementRegistry.sol      |
                  |  - Forensics, Experiments, Audit     |   |  - FarmTraceability.sol           |
                  |  - Off-chain confidential records    |   |  - TestToken (FARM) & Escrow.sol  |
                  +--------------------------------------+   +-----------------------------------+
```

---

## 3. Data Classification: On-Chain vs. Off-Chain Separation

To comply with privacy laws, zero PII leakage, low transaction fees, and system efficiency:

| Data Type | Destination | Rationale & Protection |
|---|---|---|
| Farmer Personal Data (Name, Phone, GPS, Bank details) | **PostgreSQL (Off-chain only)** | Sensitive personal information (PII). Protected with hashing, RBAC, and encryption. |
| Crop Diagnostic & Forensics Images | **PostgreSQL & Object Storage** | High storage footprint; private farm records. |
| FarmLab Experiments & Notes | **PostgreSQL (Off-chain only)** | Proprietary farming practices. |
| Order Agreement Hash (SHA-256) | **Solidity Smart Contract** | Cryptographic proof that terms, quantity, price, and specs were mutually signed and immutable. |
| Produce Traceability Milestones | **Solidity & PostgreSQL** | Batch ID, harvest timestamp, quality grade, transit checkpoint hash for tamper-evident buyer trust. |
| Payment Escrow & Settlement | **Solidity Smart Contract** | Demonstration using ERC-20 `TestFarmToken` (FARM); locked in escrow on order confirmation, released upon delivery. |

---

## 4. AI Guardrails & Disclaimers
1. **FarmForensics:**
   - Any diagnosis generated via the Anthropic Claude API must explicitly declare:
     `"Notice: AI-assisted agricultural observation for informational and early warning purposes. Consult local Krishi Vigyan Kendra (KVK) or horticulture officers before applying chemical treatments."`
2. **AI Price Assistant:**
   - Uses real historical APMC benchmarks for Dakshina Kannada (Mangalore, Puttur, Bantwal) and Udupi.
   - Price models compute confidence intervals (Low, Fair Market, Premium Direct) and state:
     `"Notice: AI market guidance based on regional APMC data. Final prices are negotiated directly between farmer and buyer."`
3. **Kannada Voice Assistant:**
   - Audio input parsed into structured listing JSON (crop name, quantity, unit, expected price, taluk).
   - Farmer is presented an editable confirmation card before any listing is published.

---

## 5. Security & RBAC Model
- **Roles:** `farmer`, `buyer`, `admin`.
- **JWT Authentication:** Short-lived access token (60 min) with role claims + refresh tokens.
- **Access Control Policies:**
  - Farmers can only edit/delete their own listings, crops, and lab experiments.
  - Buyers cannot modify seller listings or alter agreed order unit prices.
  - State machine transitions (Pending -> Confirmed -> Escrow Funded -> Dispatched -> Delivered -> Completed) are strictly enforced server-side.
