// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title PhaseCampaignRegistry
/// @notice Public metadata registry for TokenOps confidential airdrop campaigns.
/// @dev This registry deliberately stores no recipient list, plaintext amount, encrypted input,
///      CSV hash, or total distribution. Confidential allocation state belongs in TokenOps clones.
contract PhaseCampaignRegistry {
    struct Campaign {
        address creator;
        address airdrop;
        address token;
        uint64 startTime;
        uint64 endTime;
        uint32 recipientCount;
        uint32 claimCount;
        string metadataURI;
        bool active;
    }

    error CampaignExists(bytes32 campaignId);
    error CampaignNotFound(bytes32 campaignId);
    error InvalidAddress();
    error InvalidWindow();
    error InvalidRecipientCount();
    error NotCampaignOperator();
    error ClaimProofUsed(bytes32 claimProof);

    event CampaignRegistered(
        bytes32 indexed campaignId,
        address indexed creator,
        address indexed airdrop,
        address token,
        uint64 startTime,
        uint64 endTime,
        uint32 recipientCount,
        string metadataURI
    );
    event CampaignStatusChanged(bytes32 indexed campaignId, bool active);
    event ClaimObserved(bytes32 indexed campaignId, bytes32 indexed claimProof, uint32 claimCount);
    event MetadataUpdated(bytes32 indexed campaignId, string metadataURI);

    mapping(bytes32 campaignId => Campaign campaign) private _campaigns;
    mapping(bytes32 campaignId => mapping(bytes32 claimProof => bool used)) private _claimProofs;

    function registerCampaign(
        bytes32 campaignId,
        address airdrop,
        address token,
        uint64 startTime,
        uint64 endTime,
        uint32 recipientCount,
        string calldata metadataURI
    ) external {
        if (_campaigns[campaignId].creator != address(0)) revert CampaignExists(campaignId);
        if (airdrop == address(0) || token == address(0)) revert InvalidAddress();
        if (endTime <= startTime) revert InvalidWindow();
        if (recipientCount == 0) revert InvalidRecipientCount();

        _campaigns[campaignId] = Campaign({
            creator: msg.sender,
            airdrop: airdrop,
            token: token,
            startTime: startTime,
            endTime: endTime,
            recipientCount: recipientCount,
            claimCount: 0,
            metadataURI: metadataURI,
            active: true
        });

        emit CampaignRegistered(
            campaignId,
            msg.sender,
            airdrop,
            token,
            startTime,
            endTime,
            recipientCount,
            metadataURI
        );
    }

    function setActive(bytes32 campaignId, bool active) external onlyCampaignCreator(campaignId) {
        _campaigns[campaignId].active = active;
        emit CampaignStatusChanged(campaignId, active);
    }

    function updateMetadata(bytes32 campaignId, string calldata metadataURI) external onlyCampaignCreator(campaignId) {
        _campaigns[campaignId].metadataURI = metadataURI;
        emit MetadataUpdated(campaignId, metadataURI);
    }

    function recordClaim(bytes32 campaignId, bytes32 claimProof) external onlyCampaignOperator(campaignId) {
        if (_claimProofs[campaignId][claimProof]) revert ClaimProofUsed(claimProof);
        _claimProofs[campaignId][claimProof] = true;
        Campaign storage campaign = _campaigns[campaignId];
        campaign.claimCount += 1;
        emit ClaimObserved(campaignId, claimProof, campaign.claimCount);
    }

    function getCampaign(bytes32 campaignId) external view returns (Campaign memory campaign) {
        campaign = _campaigns[campaignId];
        if (campaign.creator == address(0)) revert CampaignNotFound(campaignId);
    }

    function isClaimProofRecorded(bytes32 campaignId, bytes32 claimProof) external view returns (bool) {
        return _claimProofs[campaignId][claimProof];
    }

    modifier onlyCampaignCreator(bytes32 campaignId) {
        Campaign storage campaign = _campaigns[campaignId];
        if (campaign.creator == address(0)) revert CampaignNotFound(campaignId);
        if (msg.sender != campaign.creator) revert NotCampaignOperator();
        _;
    }

    modifier onlyCampaignOperator(bytes32 campaignId) {
        Campaign storage campaign = _campaigns[campaignId];
        if (campaign.creator == address(0)) revert CampaignNotFound(campaignId);
        if (msg.sender != campaign.creator && msg.sender != campaign.airdrop) revert NotCampaignOperator();
        _;
    }
}
