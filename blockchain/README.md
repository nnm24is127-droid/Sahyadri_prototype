# FarmConnect AI — Blockchain Smart Contract Layer (Phase 7)

This workspace implements the decentralized integrity and cryptographic anchoring layer for **FarmConnect AI** (PS 1.2: Direct Market-Access Platform for Marginal Farmers in Dakshina Kannada & Udupi).

---

## 1. Architecture Overview

The blockchain layer comprises three modular, audited OpenZeppelin-compatible smart contracts designed for low gas consumption and high privacy:

```
+-----------------------------------------------------------------------------------------+
|                                    FarmConnect AI                                      |
+-----------------------------------------------------------------------------------------+
       |                                       |                                    |
       v                                       v                                    v
+-------------------------------+ +-------------------------------+ +---------------------+
|   FarmConnectOrderRegistry    | |      ProduceTraceability      | |     FarmEscrow      |
|-------------------------------| |-------------------------------| |---------------------|
| • orderId <=> agreementHash   | | • trackingId / batchId        | | • deposit(orderId)  |
| • Buyer & Farmer confirmations| | • HarvestRecorded             | | • release(orderId)  |
| • Cryptographic verification  | | • Packed                      | | • refund(orderId)   |
| • Zero PII on-chain           | | • HandedOver                  | | • SafeERC20         |
| • Immutable dispute anchor    | | • Received                    | | • ReentrancyGuard   |
+-------------------------------+ +-------------------------------+ +---------------------+
                                                                                |
                                                                                v
                                                                    +---------------------+
                                                                    |   FarmToken (FARM)  |
                                                                    |  ERC-20 Test Token  |
                                                                    +---------------------+
```

### 1. `FarmConnectOrderRegistry.sol`
- **Purpose:** Anchors agricultural purchase contracts on-chain using cryptographic digests.
- **Key Methods:**
  - `registerOrder(string orderId, bytes32 agreementHash, address buyer, address farmer)`
  - `confirmAgreement(string orderId)`
  - `updateOrderStatus(string orderId, OrderStatus newStatus)`
  - `verifyAgreementHash(string orderId, bytes32 candidateHash) view returns (bool)`
- **Data Privacy Guarantee:** Personal identities, phone numbers, UPI/bank accounts, and line-item negotiations stay strictly in PostgreSQL. Only the normalized SHA-256 digest is stored on-chain. Any tampering off-chain produces an immediate cryptographic mismatch.

### 2. `ProduceTraceability.sol`
- **Purpose:** Verifiable supply-chain milestone logging from coastal farm to institutional kitchen.
- **Key Methods:**
  - `authorizeLogger(string trackingId, address logger)`
  - `recordEvent(string trackingId, TraceStage stage, bytes32 metadataHash, string location)`
  - `getEventHistory(string trackingId) view returns (TraceEvent[])`
- **Milestone Stages:**
  - `HarvestRecorded` (0)
  - `QualityInspected` (1)
  - `Packed` (2)
  - `HandedOver` (3)
  - `Received` (4)

### 3. `FarmEscrow.sol` & `FarmToken.sol`
- **Purpose:** Foundation for safe test-token escrow settlement.
- **Key Methods:**
  - `deposit(string orderId, address farmer, uint256 amount)`
  - `release(string orderId)`
  - `refund(string orderId)`
- **Invariants:**
  - **Checks-Effects-Interactions:** State transitions occur prior to token transfers.
  - **Reentrancy Protection:** All fund transfers inherit OpenZeppelin `ReentrancyGuard`.
  - **SafeERC20:** Protects against non-compliant ERC-20 token revert behaviors.

---

## 2. Security Analysis & Privacy Decisions

### Security Controls Implemented
1. **Zero PII on Ledger:** No names, phone numbers, exact residential coordinates, or private notes are emitted or stored in contract storage.
2. **Access Control:** State transitions (`confirmAgreement`, `recordEvent`, `release`, `refund`) strictly require verified signer authentication (`msg.sender == buyer`, `msg.sender == farmer`, or authorized station logger).
3. **Double-Registration Prevention:** Custom error `OrderAlreadyExists` and `DuplicateAgreementHash` reject replayed hashes.
4. **State Machine Invariants:** Terminal statuses (`Fulfilled`, `Cancelled`, `Released`, `Refunded`) cannot be altered or double-claimed.

### Explicit Unresolved Risks & Audit Notice
> [!WARNING]
> **DO NOT USE WITH REAL FUNDS WITHOUT INDEPENDENT THIRD-PARTY AUDIT.**
> Although the test suite covers unauthorized callers, invalid state transitions, reentrancy vectors, and duplicate registration, tests alone do **NOT** prove a contract is bug-free or secure.
>
> **Known Limitations of this Phase 7 Foundation:**
> 1. **Centralized Administration:** The contract owner has emergency dispute resolution authority. In a mainnet production release, this must be migrated to a multi-signature committee (e.g. Gnosis Safe) or decentralized arbitration DAO (e.g. Kleros).
> 2. **Front-Running & MEV:** Orders registered on a public mempool may be subject to front-running without commit-reveal schemes or private RPC relays (Flashbots Protect).
> 3. **Off-Chain Oracle Liveness:** Escrow release relies on buyer acknowledgment or backend relayers. An unresponsive buyer could stall funds without a time-locked auto-release mechanism.
> 4. **Testnet Token Demonstration Only:** `FarmToken` is strictly a zero-value ERC-20 simulation token. No real fiat, USDT, or native ether transactions should be permitted until formal formal verification and economic audits take place.

---

## 3. Local Development Workflow

### Prerequisites
- Node.js >= v20
- npm >= v10

### Installation
```bash
cd blockchain
npm install
```

### Compile Smart Contracts
```bash
npm run compile
```

### Run Automated Contract Tests
```bash
npm run test
```
The test suite validates:
- Order registration, duplicate rejection, and hash validation
- Dual-party agreement confirmation (buyer & farmer)
- Supply chain milestone tracking and logger authorization
- Escrow funding, release on delivery, and mutual refund
- Rejection of unauthorized callers and invalid state transitions

### Start Local EVM Blockchain Node
```bash
npx hardhat node
```
Starts a local JSON-RPC server at `http://127.0.0.1:8545` with 20 pre-funded test accounts (10,000 ETH each).

### Deploy to Local Network
```bash
npm run deploy:local
```
This script:
1. Deploys `FarmToken`, `FarmEscrow`, `FarmConnectOrderRegistry`, and `ProduceTraceability`.
2. Seeds a sample order (`ORD-20261017-8821`) and traceability event.
3. Automatically exports ABIs and deployed addresses to:
   - `blockchain/deployments/localhost.json`
   - `frontend/src/contracts/`
   - `backend/app/blockchain/`

### Standalone Artifact Export Utility
```bash
npm run export
```
Synchronizes contract ABIs and contract addresses between frontend and backend workspaces.
