# FarmConnect AI — Phase 8: Smart Contract & Blockchain Integration Specification

This document details the end-to-end integration of the tested FarmConnect AI smart contracts with the FastAPI backend, PostgreSQL database, and React frontend.

---

## 1. Executive Summary & Scope

FarmConnect AI integrates Ethereum-compatible smart contracts running on a local EVM network (Chain ID: `31337`) to provide:
1. **Tamper-Evident Order Agreements**: Deterministic canonicalization and SHA-256 agreement hashing anchored in `FarmConnectOrderRegistry.sol`.
2. **Digital Transaction History**: Chronological off-chain event history paired with on-chain transaction hashes, block numbers, and confirmation statuses.
3. **Produce Traceability**: Milestone logging (harvest, packing, handover, receipt) distinguishing user claims from independently verified audits in `ProduceTraceability.sol`.
4. **Smart-Contract Payment Demonstration**: Non-custodial test token escrow (`FarmEscrow.sol`) and test ERC-20 (`FarmToken.sol`), featuring conditional release upon delivery and refund pathways.
5. **Private Key Isolation**: Signing keys are strictly maintained on the backend relayer and excluded from the frontend and source control.

> [!WARNING]
> **TEST TOKEN DEMONSTRATION ONLY**: All smart contract transactions use test `FARM` ERC-20 tokens on a local development network. The tokens have **zero real monetary value**. No public blockchain deployment or live fiat payments exist.

---

## 2. Smart Contract Deployment Addresses (Chain ID: 31337)

The local contracts deployed on Hardhat EVM at `http://127.0.0.1:8545`:

| Contract Name | Deployed Address | Role & Functionality |
| :--- | :--- | :--- |
| **`FarmConnectOrderRegistry`** | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` | Records immutable order agreement hashes and mutual party confirmations |
| **`ProduceTraceability`** | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` | Anchors cryptographic hashes for produce lifecycle milestones |
| **`FarmEscrow`** | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | Non-custodial lock for buyer test tokens released upon delivery |
| **`FarmToken` (`FARM`)** | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | Test ERC-20 token (18 decimals) used for settlement demonstration |

Artifacts and ABIs are exported to:
- `blockchain/deployments/deployedContracts.json`
- `backend/app/blockchain/deployedContracts.json`
- `frontend/src/contracts/deployedContracts.json`

---

## 3. Tamper-Evident Order Agreements

### A. Canonicalization Algorithm
To prevent hash mismatches caused by non-deterministic JSON serialization or whitespace variance, agreement terms are canonicalized prior to hashing:

```python
canonical_dict = {
    "agreement_version": int(agreement_version),
    "buyer_id": str(buyer_id).strip(),
    "delivery_address": str(delivery_address).strip(),
    "delivery_terms": str(delivery_terms).strip(),
    "items": sorted([
        {
            "contributing_farmer_id": str(item["contributing_farmer_id"]).strip(),
            "crop_name": str(item["crop_name"]).strip().title(),
            "quantity": float(f"{float(item['quantity']):.2f}"),
            "subtotal": float(f"{float(item['subtotal']):.2f}"),
            "unit": str(item["unit"]).strip().lower(),
            "unit_price": float(f"{float(item['unit_price']):.2f}"),
        }
        for item in items
    ], key=lambda x: (x["contributing_farmer_id"], x["crop_name"])),
    "order_code": str(order_code).strip(),
    "order_id": str(order_id).strip(),
    "seller_id": str(seller_id).strip(),
    "total_amount": float(f"{float(total_amount):.2f}"),
}
```

- **Serialization**: `json.dumps(canonical_dict, sort_keys=True, separators=(',', ':'))`
- **Hash Function**: Cryptographic SHA-256 resulting in `0x` + 64 hex characters (32 bytes).
- **On-Chain Representation**: Stored directly as `bytes32` in `FarmConnectOrderRegistry.sol`.

### B. Agreement Versioning (No Silent Overwriting)
If order terms change (e.g. delivery date, address, or terms):
1. A **new version number** is assigned (`agreement_version += 1`).
2. A **new canonical dictionary and SHA-256 hash** are computed.
3. The new version is anchored on-chain with order identifier `f"{order_id}-v{new_version}"`.
4. The previous version is marked `is_current = False` and retained in PostgreSQL (`order_agreement_versions` table).
5. Authorized users can inspect the complete audit trail and diff between versions.

### C. On-Chain Verification
The `/api/v1/orders/{order_id}/verify-on-chain` endpoint executes:
1. Retrieval of the active agreement hash from PostgreSQL.
2. Query to `FarmConnectOrderRegistry.getOrder(orderId)` or `verifyAgreementHash(orderId, hash)`.
3. Strict comparison between off-chain and on-chain hashes.
4. Response payload:
   ```json
   {
     "order_id": "9a3f2b4c...",
     "order_code": "ORD-DK-173456789",
     "is_registered_on_chain": true,
     "agreement_version": 1,
     "off_chain_hash": "0x4f8a...3b21",
     "on_chain_hash": "0x4f8a...3b21",
     "hash_match": true,
     "contract_address": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
     "network_identifier": "31337",
     "on_chain_status": "Verified Authenticated"
   }
   ```

---

## 4. Produce Traceability Ledger

### A. Lifecycle Milestones
Authorized actors log produce lifecycle checkpoints:
1. **Harvest**: Logged by producer farmer (farm plot, harvest timestamp, moisture/quality grade).
2. **Packing**: Logged by aggregation hub or farmer (sorting grade, crate tags).
3. **Handover**: Logged upon handover to transport carrier or APMC aggregation hub.
4. **Receipt**: Logged by purchasing buyer upon physical receipt and intake inspection.

### B. Claim Integrity: Self-Reported vs Independently Verified
To eliminate misleading assertions:
- **Self-Reported Claim**: Marked with amber badge `Self-reported claim by Producer/Buyer`.
- **Independently Verified**: Marked with green certified badge `Independently Verified by {source}` (e.g. "APMC Yard Inspector #DK-09", "Official Mandi Quality Inspector").

Milestone metadata is hashed and registered in `ProduceTraceability.recordEvent(trackingId, stage, metadataHash, location)`.

---

## 5. Smart-Contract Payment & Escrow Demonstration

### A. Non-Custodial Architecture (`FarmEscrow.sol`)
1. **Deposit**:
   - Buyer approves `FarmEscrow` to transfer `amount` test `FARM` tokens.
   - Buyer calls `deposit(orderId, farmer, amount)` on `FarmEscrow.sol`.
   - Contract records deposit with state `Funded` and emits `EscrowFunded`.
2. **Release**:
   - Can only be triggered by the buyer (confirming delivery) or the platform relayer.
   - Transfers tokens directly from the escrow contract to the beneficiary farmer address.
   - Contract state transitions to `Released`.
3. **Refund**:
   - If order is cancelled or disputed, can be triggered by the farmer (waiving claim) or platform admin.
   - Returns tokens to the buyer.
   - Contract state transitions to `Refunded`.

### B. Security Invariants
- `nonReentrant` on all external state-changing functions.
- `SafeERC20` for token transfer safety.
- Strict checks-effects-interactions pattern to guard against reentrancy.
- Zero address, zero amount, and duplicate order ID guards.

---

## 6. Key Management & Relayer Architecture

1. **Frontend Isolation**: No private keys exist in the frontend TypeScript codebase or browser storage.
2. **Backend Relayer**: For local demonstration, the backend utilizes Hardhat test account #0 (`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`) configured in `BACKEND_SIGNER_PRIVATE_KEY`.
3. **Graceful Offline Mode**: If the local Hardhat node is not running, the `BlockchainService` falls back to deterministic simulated records, preventing crashes while clearly documenting simulated status.

---

## 7. Reproducible Local Deployment & Reset Instructions

### Step 1: Start Local Hardhat EVM Node
```bash
cd blockchain
npx hardhat node
```
This starts an EVM JSON-RPC node at `http://127.0.0.1:8545` with Chain ID `31337`.

### Step 2: Deploy Contracts & Export Artifacts
In a second terminal:
```bash
cd blockchain
node scripts/deploy.js
node scripts/exportArtifacts.js
```
This compiles the Solidity contracts, deploys them to the local node, and exports the updated ABIs and deployment addresses to `backend/app/blockchain/` and `frontend/src/contracts/`.

### Step 3: Run Blockchain Contract Unit Tests
```bash
cd blockchain
npm test
```
All 24 smart contract unit tests will execute and pass.

### Step 4: Run Backend Integration Tests
```bash
cd ..
python -m pytest backend/tests/test_blockchain_integration.py -v
```
All 8 integration tests will execute and pass against the canonicalization and escrow services.

### Step 5: Run Frontend Integration Tests
```bash
cd frontend
npm test
npm run build
```
All 16 frontend tests and the production build will compile cleanly.
