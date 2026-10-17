// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ProduceTraceability
 * @author FarmConnect AI Engineering Team
 * @notice Provides verifiable farm-to-fork milestone tracking for coastal Karnataka produce.
 * @dev Records immutable event hashes for key physical milestones (Harvest, Pack, Dispatch, Receive).
 *
 * Privacy & Security Decisions:
 * 1. Minimal On-Chain Footprint: High-resolution photos, detailed sensor logs, and GPS
 *    coordinates are stored off-chain in IPFS/PostgreSQL. Their cryptographic content hash
 *    is registered here.
 * 2. Access Control: Only the registered producer, buyer, or authorized station agent can log
 *    events for a given tracking ID.
 */
contract ProduceTraceability is Ownable {

    enum TraceStage {
        HarvestRecorded,     // 0: Fresh crop harvested at farm
        QualityInspected,    // 1: Primary sorting / GI verification
        Packed,              // 2: Crated and labeled with QR code
        HandedOver,          // 3: Dispatched to APMC hub or logistics partner
        Received             // 4: Accepted by institutional buyer or retail outlet
    }

    struct TraceEvent {
        TraceStage stage;        // Milestone enum
        bytes32 metadataHash;    // Cryptographic hash of off-chain payload (photos, weight slip)
        string location;         // Taluk/Hub name (e.g., "Bantwal APMC Hub", "Shankarpura")
        address recordedBy;      // Wallet of the party recording the event
        uint256 timestamp;       // Block timestamp
    }

    // Mapping: trackingId (orderCode or batchId) => Array of chronological trace events
    mapping(string => TraceEvent[]) private _eventHistory;

    // Mapping: trackingId => Authorized party => Allowed boolean
    mapping(string => mapping(address => bool)) private _authorizedLoggers;

    // Mapping: trackingId => Initial creator/producer address
    mapping(string => address) private _trackingOwner;

    // Events
    event TraceabilityEventRecorded(
        string indexed trackingId,
        TraceStage indexed stage,
        bytes32 indexed metadataHash,
        address recordedBy,
        string location,
        uint256 timestamp
    );

    event LoggerAuthorized(string indexed trackingId, address indexed logger, bool authorized);

    // Custom errors
    error UnauthorizedLogger(string trackingId, address caller);
    error InvalidTraceInput(string reason);
    error TrackingIdNotFound(string trackingId);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Authorizes a party (e.g. cooperative, aggregator, buyer) to log events for a batch/order.
     * @param trackingId Business tracking ID (orderCode or batchId).
     * @param logger Wallet address to authorize.
     */
    function authorizeLogger(string calldata trackingId, address logger) external {
        if (bytes(trackingId).length == 0) revert InvalidTraceInput("Empty trackingId");
        if (logger == address(0)) revert InvalidTraceInput("Zero logger address");

        address currentOwner = _trackingOwner[trackingId];
        if (currentOwner == address(0)) {
            // First caller becomes the tracking batch owner
            _trackingOwner[trackingId] = msg.sender;
            _authorizedLoggers[trackingId][msg.sender] = true;
        } else if (msg.sender != currentOwner && msg.sender != owner()) {
            revert UnauthorizedLogger(trackingId, msg.sender);
        }

        _authorizedLoggers[trackingId][logger] = true;
        emit LoggerAuthorized(trackingId, logger, true);
    }

    /**
     * @notice Records an immutable traceability milestone event on-chain.
     * @param trackingId Canonical orderCode or produce batch code.
     * @param stage Milestone stage (HarvestRecorded, Packed, HandedOver, Received).
     * @param metadataHash SHA-256 or keccak256 hash of off-chain details (weight, quality certificate).
     * @param location Coarse geographical name (taluk or hub name, not private home address).
     */
    function recordEvent(
        string calldata trackingId,
        TraceStage stage,
        bytes32 metadataHash,
        string calldata location
    ) external {
        if (bytes(trackingId).length == 0) revert InvalidTraceInput("Empty trackingId");
        if (metadataHash == bytes32(0)) revert InvalidTraceInput("Empty metadataHash");
        if (bytes(location).length == 0) revert InvalidTraceInput("Empty location");

        // Auto-register owner if first event
        if (_trackingOwner[trackingId] == address(0)) {
            _trackingOwner[trackingId] = msg.sender;
            _authorizedLoggers[trackingId][msg.sender] = true;
        }

        bool isAllowed = _authorizedLoggers[trackingId][msg.sender] || msg.sender == owner();
        if (!isAllowed) revert UnauthorizedLogger(trackingId, msg.sender);

        TraceEvent memory newEvent = TraceEvent({
            stage: stage,
            metadataHash: metadataHash,
            location: location,
            recordedBy: msg.sender,
            timestamp: block.timestamp
        });

        _eventHistory[trackingId].push(newEvent);

        emit TraceabilityEventRecorded(
            trackingId,
            stage,
            metadataHash,
            msg.sender,
            location,
            block.timestamp
        );
    }

    /**
     * @notice Retrieves all chronological traceability milestones for an order/batch.
     * @param trackingId Canonical order or produce batch identifier.
     */
    function getEventHistory(string calldata trackingId) external view returns (TraceEvent[] memory) {
        return _eventHistory[trackingId];
    }

    /**
     * @notice Returns the total count of recorded milestones for a tracking ID.
     */
    function getEventCount(string calldata trackingId) external view returns (uint256) {
        return _eventHistory[trackingId].length;
    }

    /**
     * @notice Returns the tracking batch creator.
     */
    function getTrackingOwner(string calldata trackingId) external view returns (address) {
        return _trackingOwner[trackingId];
    }
}
