// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FarmEscrow
 * @author FarmConnect AI Engineering Team
 * @notice Foundation contract for conditional test-token escrow settlement.
 * @dev Holds test tokens (e.g. FARM test token) until produce delivery terms are confirmed.
 *
 * Security Architecture & Invariants:
 * 1. Checks-Effects-Interactions: Internal accounting states are updated BEFORE any external
 *    token transfer occurs.
 * 2. Reentrancy Protection: All state-changing payment methods inherit from OpenZeppelin ReentrancyGuard.
 * 3. SafeERC20: Employs OpenZeppelin's SafeERC20 to safely handle non-standard ERC20 implementations.
 * 4. Zero PII: Only order identifiers, wallet addresses, and amounts are handled on-chain.
 *
 * UNRESOLVED RISKS & PRODUCTION NOTICE:
 * This contract is a demonstration foundation. Prior to handling real value or mainnet operations,
 * an independent third-party security audit must verify multi-sig dispute resolution, timelock mechanics,
 * oracle failure recovery, and front-running resistance.
 */
contract FarmEscrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    enum EscrowState {
        Uninitialized,
        Funded,
        Released,
        Refunded
    }

    struct EscrowDeposit {
        string orderId;          // Canonical application order code
        address buyer;           // Payer depositing the funds
        address farmer;          // Payee entitled to receive funds upon delivery
        uint256 amount;          // Escrowed token amount
        EscrowState state;       // Current status of deposit
        uint256 createdAt;       // Timestamp of funding
        uint256 settledAt;       // Timestamp of release or refund
    }

    // Supported settlement test token (e.g., FarmToken)
    IERC20 public immutable settlementToken;

    // Mapping: orderId => EscrowDeposit record
    mapping(string => EscrowDeposit) private _deposits;

    // Events
    event EscrowFunded(
        string indexed orderId,
        address indexed buyer,
        address indexed farmer,
        uint256 amount,
        uint256 timestamp
    );

    event EscrowReleased(
        string indexed orderId,
        address indexed farmer,
        uint256 amount,
        address releasedBy,
        uint256 timestamp
    );

    event EscrowRefunded(
        string indexed orderId,
        address indexed buyer,
        uint256 amount,
        address refundedBy,
        uint256 timestamp
    );

    // Custom errors
    error InvalidEscrowInput(string reason);
    error EscrowAlreadyExists(string orderId);
    error EscrowNotFound(string orderId);
    error InvalidEscrowState(EscrowState current, EscrowState expected);
    error UnauthorizedEscrowParty(address caller);

    constructor(address tokenAddress) Ownable(msg.sender) {
        if (tokenAddress == address(0)) revert InvalidEscrowInput("Zero token address");
        settlementToken = IERC20(tokenAddress);
    }

    /**
     * @notice Locks test tokens in escrow for an order.
     * @param orderId Unique business order identifier.
     * @param farmer Beneficiary farmer address.
     * @param amount Token amount to deposit.
     */
    function deposit(
        string calldata orderId,
        address farmer,
        uint256 amount
    ) external nonReentrant {
        if (bytes(orderId).length == 0) revert InvalidEscrowInput("Empty orderId");
        if (farmer == address(0)) revert InvalidEscrowInput("Zero farmer address");
        if (farmer == msg.sender) revert InvalidEscrowInput("Buyer and farmer cannot be identical");
        if (amount == 0) revert InvalidEscrowInput("Zero deposit amount");
        if (_deposits[orderId].state != EscrowState.Uninitialized) {
            revert EscrowAlreadyExists(orderId);
        }

        // Effects
        _deposits[orderId] = EscrowDeposit({
            orderId: orderId,
            buyer: msg.sender,
            farmer: farmer,
            amount: amount,
            state: EscrowState.Funded,
            createdAt: block.timestamp,
            settledAt: 0
        });

        // Interactions (Safe transfer from buyer to this contract)
        settlementToken.safeTransferFrom(msg.sender, address(this), amount);

        emit EscrowFunded(orderId, msg.sender, farmer, amount, block.timestamp);
    }

    /**
     * @notice Releases escrowed tokens to the farmer upon verified delivery.
     * @dev Can be called by the buyer (confirming delivery) or the contract owner/platform relayer.
     * @param orderId Canonical order identifier.
     */
    function release(string calldata orderId) external nonReentrant {
        EscrowDeposit storage dep = _deposits[orderId];
        if (dep.state == EscrowState.Uninitialized) revert EscrowNotFound(orderId);
        if (dep.state != EscrowState.Funded) {
            revert InvalidEscrowState(dep.state, EscrowState.Funded);
        }

        // Only the buyer who deposited or the contract owner can release funds
        if (msg.sender != dep.buyer && msg.sender != owner()) {
            revert UnauthorizedEscrowParty(msg.sender);
        }

        // Effects
        dep.state = EscrowState.Released;
        dep.settledAt = block.timestamp;
        uint256 payout = dep.amount;

        // Interactions
        settlementToken.safeTransfer(dep.farmer, payout);

        emit EscrowReleased(orderId, dep.farmer, payout, msg.sender, block.timestamp);
    }

    /**
     * @notice Refunds escrowed tokens back to the buyer if an order is cancelled.
     * @dev Can be called by the farmer (agreeing to release hold) or the contract owner.
     * @param orderId Canonical order identifier.
     */
    function refund(string calldata orderId) external nonReentrant {
        EscrowDeposit storage dep = _deposits[orderId];
        if (dep.state == EscrowState.Uninitialized) revert EscrowNotFound(orderId);
        if (dep.state != EscrowState.Funded) {
            revert InvalidEscrowState(dep.state, EscrowState.Funded);
        }

        // Only the beneficiary farmer (declining/cancelling) or contract owner can initiate refund
        if (msg.sender != dep.farmer && msg.sender != owner()) {
            revert UnauthorizedEscrowParty(msg.sender);
        }

        // Effects
        dep.state = EscrowState.Refunded;
        dep.settledAt = block.timestamp;
        uint256 refundAmount = dep.amount;

        // Interactions
        settlementToken.safeTransfer(dep.buyer, refundAmount);

        emit EscrowRefunded(orderId, dep.buyer, refundAmount, msg.sender, block.timestamp);
    }

    /**
     * @notice Retrieves deposit details for an order.
     */
    function getDeposit(string calldata orderId) external view returns (EscrowDeposit memory) {
        EscrowDeposit memory dep = _deposits[orderId];
        if (dep.state == EscrowState.Uninitialized) revert EscrowNotFound(orderId);
        return dep;
    }

    /**
     * @notice Returns the escrow status for an order.
     */
    function getEscrowState(string calldata orderId) external view returns (EscrowState) {
        return _deposits[orderId].state;
    }
}
