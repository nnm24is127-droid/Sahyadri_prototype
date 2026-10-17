// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FarmConnectOrderRegistry
 * @author FarmConnect AI Engineering Team
 * @notice Anchors agricultural purchase agreements on-chain using cryptographic hashes.
 * @dev Stores immutable agreement hashes (SHA-256/keccak256) and confirmation state
 *      without exposing personally identifiable information (PII), prices, or phone numbers.
 *
 * Security Architecture & Privacy Decisions:
 * 1. Off-chain Privacy: Personal details, KYC, phone numbers, exact delivery addresses,
 *    and negotiable line items remain securely stored in PostgreSQL.
 * 2. Integrity Guarantee: Any tampering with order terms off-chain immediately invalidates
 *    the cryptographic agreement hash anchored in this registry.
 * 3. Access Control: Only the registered farmer and buyer (or contract owner in administrative emergency)
 *    can confirm terms or update statuses.
 */
contract FarmConnectOrderRegistry is Ownable {

    enum OrderStatus {
        Registered,
        Confirmed,
        InEscrow,
        Fulfilled,
        Cancelled
    }

    struct RegisteredOrder {
        string orderId;              // Canonical application order code (e.g., ORD-20261017-001)
        bytes32 agreementHash;       // Cryptographic SHA-256 digest of immutable agreement terms
        address buyer;               // Wallet address of the buyer/institutional purchaser
        address farmer;              // Wallet address of the seller/farmer
        bool buyerConfirmed;         // True once buyer confirms terms on-chain
        bool farmerConfirmed;        // True once farmer confirms terms on-chain
        OrderStatus status;          // Lifecycle status
        uint256 registeredAt;        // Block timestamp of initial registration
        uint256 updatedAt;           // Block timestamp of last state transition
    }

    // Mapping: canonical order ID string => RegisteredOrder record
    mapping(string => RegisteredOrder) private _orders;

    // Mapping: agreementHash => orderId (to prevent duplicate agreement hash reuse)
    mapping(bytes32 => string) private _hashToOrderId;

    // Events
    event OrderRegistered(
        string indexed orderId,
        bytes32 indexed agreementHash,
        address indexed buyer,
        address farmer,
        uint256 timestamp
    );

    event AgreementConfirmed(
        string indexed orderId,
        address indexed party,
        bool buyerConfirmed,
        bool farmerConfirmed,
        uint256 timestamp
    );

    event OrderStatusUpdated(
        string indexed orderId,
        OrderStatus previousStatus,
        OrderStatus newStatus,
        address indexed updatedBy,
        uint256 timestamp
    );

    /// @notice Custom errors for gas efficiency and clear debugging
    error OrderAlreadyExists(string orderId);
    error DuplicateAgreementHash(bytes32 hash, string existingOrderId);
    error OrderNotFound(string orderId);
    error InvalidInput(string reason);
    error UnauthorizedCaller(address caller);
    error InvalidStateTransition(OrderStatus current, OrderStatus target);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Registers a new order agreement with its cryptographic hash.
     * @dev Called by the backend relayer, the buyer, or the farmer.
     * @param orderId Unique business order identifier.
     * @param agreementHash SHA-256 or keccak256 digest of normalized JSON contract terms.
     * @param buyer Address of the purchasing entity.
     * @param farmer Address of the producing farmer.
     */
    function registerOrder(
        string calldata orderId,
        bytes32 agreementHash,
        address buyer,
        address farmer
    ) external {
        if (bytes(orderId).length == 0) revert InvalidInput("Empty orderId");
        if (agreementHash == bytes32(0)) revert InvalidInput("Empty agreementHash");
        if (buyer == address(0)) revert InvalidInput("Zero buyer address");
        if (farmer == address(0)) revert InvalidInput("Zero farmer address");
        if (buyer == farmer) revert InvalidInput("Buyer and farmer cannot be identical");
        if (_orders[orderId].registeredAt != 0) revert OrderAlreadyExists(orderId);
        if (bytes(_hashToOrderId[agreementHash]).length != 0) {
            revert DuplicateAgreementHash(agreementHash, _hashToOrderId[agreementHash]);
        }

        _orders[orderId] = RegisteredOrder({
            orderId: orderId,
            agreementHash: agreementHash,
            buyer: buyer,
            farmer: farmer,
            buyerConfirmed: false,
            farmerConfirmed: false,
            status: OrderStatus.Registered,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp
        });

        _hashToOrderId[agreementHash] = orderId;

        emit OrderRegistered(orderId, agreementHash, buyer, farmer, block.timestamp);
    }

    /**
     * @notice Allows an authorized party (buyer or farmer) to confirm their agreement with terms.
     * @dev Once both parties confirm, status automatically transitions to Confirmed.
     * @param orderId Canonical order identifier.
     */
    function confirmAgreement(string calldata orderId) external {
        RegisteredOrder storage ord = _orders[orderId];
        if (ord.registeredAt == 0) revert OrderNotFound(orderId);
        if (ord.status != OrderStatus.Registered && ord.status != OrderStatus.Confirmed) {
            revert InvalidStateTransition(ord.status, OrderStatus.Confirmed);
        }

        bool isBuyer = (msg.sender == ord.buyer);
        bool isFarmer = (msg.sender == ord.farmer);

        if (!isBuyer && !isFarmer && msg.sender != owner()) {
            revert UnauthorizedCaller(msg.sender);
        }

        if (isBuyer) {
            ord.buyerConfirmed = true;
        }
        if (isFarmer) {
            ord.farmerConfirmed = true;
        }

        // If both acknowledged, mark status as Confirmed
        if (ord.buyerConfirmed && ord.farmerConfirmed && ord.status == OrderStatus.Registered) {
            OrderStatus prev = ord.status;
            ord.status = OrderStatus.Confirmed;
            ord.updatedAt = block.timestamp;
            emit OrderStatusUpdated(orderId, prev, OrderStatus.Confirmed, msg.sender, block.timestamp);
        }

        emit AgreementConfirmed(
            orderId,
            msg.sender,
            ord.buyerConfirmed,
            ord.farmerConfirmed,
            block.timestamp
        );
    }

    /**
     * @notice Updates the order status along verified milestones (InEscrow, Fulfilled, Cancelled).
     * @param orderId Canonical order identifier.
     * @param newStatus Target order status.
     */
    function updateOrderStatus(string calldata orderId, OrderStatus newStatus) external {
        RegisteredOrder storage ord = _orders[orderId];
        if (ord.registeredAt == 0) revert OrderNotFound(orderId);

        bool isAuthorized = (msg.sender == ord.buyer || msg.sender == ord.farmer || msg.sender == owner());
        if (!isAuthorized) revert UnauthorizedCaller(msg.sender);

        // Validation of state transitions
        if (ord.status == OrderStatus.Fulfilled || ord.status == OrderStatus.Cancelled) {
            revert InvalidStateTransition(ord.status, newStatus);
        }

        OrderStatus prev = ord.status;
        ord.status = newStatus;
        ord.updatedAt = block.timestamp;

        emit OrderStatusUpdated(orderId, prev, newStatus, msg.sender, block.timestamp);
    }

    /**
     * @notice Retrieves the full record of a registered order.
     * @param orderId Canonical order identifier.
     */
    function getOrder(string calldata orderId) external view returns (RegisteredOrder memory) {
        RegisteredOrder memory ord = _orders[orderId];
        if (ord.registeredAt == 0) revert OrderNotFound(orderId);
        return ord;
    }

    /**
     * @notice Verifies whether a given agreement hash matches the anchored record.
     * @param orderId Canonical order identifier.
     * @param candidateHash SHA-256 hash to test.
     */
    function verifyAgreementHash(string calldata orderId, bytes32 candidateHash) external view returns (bool) {
        RegisteredOrder memory ord = _orders[orderId];
        if (ord.registeredAt == 0) return false;
        return ord.agreementHash == candidateHash;
    }

    /**
     * @notice Checks if an order ID is already registered.
     */
    function isOrderRegistered(string calldata orderId) external view returns (bool) {
        return _orders[orderId].registeredAt != 0;
    }
}
