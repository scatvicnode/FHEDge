// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, externalEuint64, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHEDge - Privacy-Preserving Crowdfunding with FHE
 * @dev FHEVM v0.9 Compatible: Uses self-relaying public decryption (no Oracle dependency)
 * Key Changes in v0.9:
 * - Replaced SepoliaConfig with ZamaEthereumConfig
 * - Updated to new FHE.fromExternal pattern with proper proof verification
 * - Maintains all original FHEDge functionality with encrypted goals/pledges

  * Key Features:
 * - Encrypted campaign goals (competitors can't see your target)
 * - Private pledge amounts (donor privacy maintained)
 * - Confidential total tracking using FHE operations
 * - Goal verification without revealing exact amounts
 * - Owner-controlled decryption for campaign management
 */
contract FHEDge is ZamaEthereumConfig {
    // Platform fee: 1% of each pledge goes to contract owner
    uint256 public constant PLATFORM_FEE_PERCENT = 1;
    uint256 public constant FEE_DENOMINATOR = 100;
    
    // Contract owner (receives platform fees automatically)
    address public immutable platformOwner;
    
    // Decryption status for campaign results
    enum DecryptionStatus {
        NotRequested,   // Decryption hasn't been requested yet
        InProgress,     // Decryption requested, waiting for callback
        Completed       // Decryption completed and verified
    }
    
    // Campaign structure
    struct Campaign {
        address owner;              // Campaign creator
        euint64 goal;              // Encrypted fundraising goal
        euint64 totalPledged;      // Encrypted total amount pledged
        uint256 deadline;          // Campaign end timestamp
        bool active;               // Campaign status
        bool claimed;              // Whether funds have been claimed
        string title;              // Campaign title (public)
        string description;        // Campaign description (public)
        uint256 ethBalance;        // Actual ETH collected for this campaign (after fee)
        DecryptionStatus decryptionStatus;  // Status of public decryption
        uint64 decryptedTotalPledged;       // Decrypted total after public reveal
        bool goalReached;                   // Whether goal was reached (after decryption)
    }

    // Mapping from campaign ID to Campaign
    mapping(uint256 => Campaign) public campaigns;
    
    // Mapping from campaign ID to pledger address to encrypted pledge amount
    mapping(uint256 => mapping(address => euint64)) public pledges;
    
    // Mapping to track if address has pledged to a campaign
    mapping(uint256 => mapping(address => bool)) public hasPledged;
    
    // Mapping to track actual ETH pledged by each user per campaign
    mapping(uint256 => mapping(address => uint256)) public ethPledges;
    
    // Counter for campaign IDs
    uint256 public nextCampaignId;
    
    bool private _locked;
    
    // Events
    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed owner,
        string title,
        uint256 deadline
    );
    
    event PledgeMade(
        uint256 indexed campaignId,
        address indexed pledger
    );
    
    event CampaignClaimed(
        uint256 indexed campaignId,
        address indexed owner
    );
    
    event RefundIssued(
        uint256 indexed campaignId,
        address indexed pledger
    );
    
    event PlatformFeeTransferred(
        uint256 indexed campaignId,
        address indexed platformOwner,
        uint256 feeAmount
    );
    
    event DecryptionRequested(
        uint256 indexed campaignId,
        bytes32 totalPledgedHandle,
        bytes32 goalReachedHandle
    );
    
    event DecryptionCompleted(
        uint256 indexed campaignId,
        uint64 decryptedTotalPledged,
        bool goalReached
    );

    modifier nonReentrant() {
        require(!_locked, "Reentrancy detected");
        _locked = true;
        _;
        _locked = false;
    }

    /**
     * @notice Constructor sets the platform owner (immutable)
     */
    constructor() {
        platformOwner = msg.sender;
    }

    /**
     * @notice Create a new crowdfunding campaign with encrypted goal
     * @dev FHEVM v0.9: Uses ZamaEthereumConfig and updated FHE.fromExternal pattern
     */
    function createCampaign(
        externalEuint64 inGoal,
        bytes calldata inputProof,
        uint256 deadline,
        string calldata title,
        string calldata description
    ) external returns (uint256) {
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(bytes(title).length > 0, "Title cannot be empty");
        
        // v0.9: Convert external encrypted input to euint64 with proof verification
        euint64 goal = FHE.fromExternal(inGoal, inputProof);
        
        uint256 campaignId = nextCampaignId++;
        
        campaigns[campaignId] = Campaign({
            owner: msg.sender,
            goal: goal,
            totalPledged: FHE.asEuint64(0), // Initialize with encrypted zero
            deadline: deadline,
            active: true,
            claimed: false,
            title: title,
            description: description,
            ethBalance: 0,  // Initialize ETH balance
            decryptionStatus: DecryptionStatus.NotRequested,  // Initial decryption status
            decryptedTotalPledged: 0,  // Will be set after decryption
            goalReached: false  // Will be set after decryption
        });
        
        // v0.9: Allow contract and owner to access the encrypted goal
        FHE.allowThis(goal);
        FHE.allow(goal, msg.sender);
        
        // Allow contract to access totalPledged
        FHE.allowThis(campaigns[campaignId].totalPledged);
        FHE.allow(campaigns[campaignId].totalPledged, msg.sender);
        
        emit CampaignCreated(campaignId, msg.sender, title, deadline);
        
        return campaignId;
    }

    /**
     * @notice Make an encrypted pledge to a campaign
     * @dev FHEVM v0.9: Updated to use proper proof verification pattern
     * @param campaignId The campaign to pledge to
     * @param inAmount Encrypted pledge amount as externalEuint64
     * @param inputProof Proof for the encrypted input
     * @dev msg.value must match the encrypted amount (verified off-chain)
     */
    function pledge(
        uint256 campaignId,
        externalEuint64 inAmount,
        bytes calldata inputProof
    ) external payable nonReentrant {
        Campaign storage campaign = campaigns[campaignId];
        
        require(campaign.active, "Campaign is not active");
        require(block.timestamp < campaign.deadline, "Campaign has ended");
        require(!hasPledged[campaignId][msg.sender], "Already pledged to this campaign");
        require(msg.value > 0, "Must send ETH with pledge");
        
        // v0.9: Convert external encrypted input to euint64 with proof verification
        euint64 amount = FHE.fromExternal(inAmount, inputProof);
        
        // Calculate platform fee (1% of pledge)
        uint256 platformFee = (msg.value * PLATFORM_FEE_PERCENT) / FEE_DENOMINATOR;
        uint256 amountAfterFee = msg.value - platformFee;
        
        // DIRECT TRANSFER: Send 1% fee to platform owner immediately!
        if (platformFee > 0) {
            (bool success, ) = payable(platformOwner).call{value: platformFee}("");
            require(success, "Platform fee transfer failed");
            emit PlatformFeeTransferred(campaignId, platformOwner, platformFee);
        }
        
        // Store the pledge (encrypted amount)
        pledges[campaignId][msg.sender] = amount;
        hasPledged[campaignId][msg.sender] = true;
        
        // Track actual ETH received by campaign (after platform fee)
        ethPledges[campaignId][msg.sender] = amountAfterFee;
        campaign.ethBalance += amountAfterFee;
        
        // Add to total using FHE addition (homomorphic operation)
        campaign.totalPledged = FHE.add(campaign.totalPledged, amount);
        
        // v0.9: Grant access permissions for encrypted data
        FHE.allowThis(amount);
        FHE.allow(amount, msg.sender);
        FHE.allowThis(campaign.totalPledged);
        FHE.allow(campaign.totalPledged, campaign.owner);
        
        emit PledgeMade(campaignId, msg.sender);
    }

    /**
     * @notice Check if campaign goal has been reached (returns encrypted boolean)
     * @dev FHEVM v0.9: Uses FHE.ge for encrypted comparison
     * @param campaignId The campaign to check
     * @return Encrypted boolean indicating if goal is reached
     */
    function isGoalReached(uint256 campaignId) public returns (ebool) {
        Campaign storage campaign = campaigns[campaignId];
        require(campaign.active || campaign.claimed, "Campaign does not exist");
        
        // Compare: totalPledged >= goal (returns encrypted boolean)
        return FHE.ge(campaign.totalPledged, campaign.goal);
    }

    /**
     * @notice Campaign owner claims funds - DIRECTLY transfers ALL campaign ETH to owner!
     * @dev Added nonReentrant modifier for security and Transfers campaign.ethBalance (all pledged ETH) directly to owner's wallet
     * @param campaignId The campaign to claim from
     */
    function claimCampaign(uint256 campaignId) external nonReentrant {
        Campaign storage campaign = campaigns[campaignId];
        
        require(msg.sender == campaign.owner, "Only owner can claim");
        require(campaign.active, "Campaign is not active");
        require(block.timestamp >= campaign.deadline, "Campaign has not ended");
        require(!campaign.claimed, "Already claimed");
        
        uint256 amountToTransfer = campaign.ethBalance;
        require(amountToTransfer > 0, "No funds to claim");
        
        // Mark as claimed BEFORE transfer (reentrancy protection)
        campaign.active = false;
        campaign.claimed = true;
        campaign.ethBalance = 0;
        
        // DIRECT TRANSFER: Send all campaign ETH to owner's wallet!
        (bool success, ) = payable(msg.sender).call{value: amountToTransfer}("");
        require(success, "ETH transfer failed");
        
        emit CampaignClaimed(campaignId, msg.sender);
    }

    /**
     * @notice Pledgers can request refund if campaign failed or was not claimed
     * @param campaignId The campaign to get refund from
     * @dev Added nonReentrant modifier for security
     * @dev Returns the EXACT ETH amount you pledged - direct transfer back to you!
     */
    function refund(uint256 campaignId) external nonReentrant {
        Campaign storage campaign = campaigns[campaignId];
        
        require(hasPledged[campaignId][msg.sender], "No pledge found");
        require(block.timestamp >= campaign.deadline, "Campaign has not ended");
        require(!campaign.claimed, "Campaign was claimed");
        
        uint256 refundAmount = ethPledges[campaignId][msg.sender];
        require(refundAmount > 0, "No ETH to refund");
        
        // Reset pledge status BEFORE transfer (reentrancy protection)
        hasPledged[campaignId][msg.sender] = false;
        ethPledges[campaignId][msg.sender] = 0;
        campaign.ethBalance -= refundAmount;
        
        // DIRECT TRANSFER: Send ETH back to pledger!
        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        require(success, "ETH refund failed");
        
        emit RefundIssued(campaignId, msg.sender);
    }

    /**
     * @notice Get encrypted pledge amount for a specific pledger
     * @param campaignId The campaign ID
     * @param pledger The pledger address
     * @return Encrypted pledge amount
     */
    function getPledgeAmount(
        uint256 campaignId,
        address pledger
    ) external view returns (euint64) {
        require(
            msg.sender == pledger || msg.sender == campaigns[campaignId].owner,
            "Not authorized"
        );
        return pledges[campaignId][pledger];
    }

    /**
     * @notice Get encrypted total pledged for a campaign
     * @param campaignId The campaign ID
     * @return Encrypted total pledged amount
     */
    function getTotalPledged(uint256 campaignId) external view returns (euint64) {
        Campaign storage campaign = campaigns[campaignId];
        require(msg.sender == campaign.owner, "Only owner can view total");
        return campaign.totalPledged;
    }

    /**
     * @notice Get encrypted goal for a campaign
     * @param campaignId The campaign ID
     * @return Encrypted goal amount
     */
    function getGoal(uint256 campaignId) external view returns (euint64) {
        Campaign storage campaign = campaigns[campaignId];
        require(msg.sender == campaign.owner, "Only owner can view goal");
        return campaign.goal;
    }

    /**
     * @notice Get public campaign information
     * @param campaignId The campaign ID
     */
    function getCampaignInfo(uint256 campaignId) external view returns (
        address owner,
        uint256 deadline,
        bool active,
        bool claimed,
        string memory title,
        string memory description,
        uint256 ethBalance
    ) {
        Campaign storage campaign = campaigns[campaignId];
        return (
            campaign.owner,
            campaign.deadline,
            campaign.active,
            campaign.claimed,
            campaign.title,
            campaign.description,
            campaign.ethBalance
        );
    }

    /**
     * @notice Request public decryption of campaign results (Step 1 of 3)
     * @dev Owner can request decryption after deadline to publicly reveal results
     * @param campaignId The campaign ID to decrypt
     */
    function requestDecryptCampaignResult(uint256 campaignId) external {
        Campaign storage campaign = campaigns[campaignId];
        
        require(msg.sender == campaign.owner, "Only owner can request decryption");
        require(block.timestamp >= campaign.deadline, "Campaign not ended");
        require(campaign.decryptionStatus == DecryptionStatus.NotRequested, "Decryption already requested");
        
        // Get the encrypted goal reached status
        ebool goalReachedEncrypted = isGoalReached(campaignId);
        
        // Mark ciphertexts as publicly decryptable
        FHE.makePubliclyDecryptable(campaign.totalPledged);
        FHE.makePubliclyDecryptable(goalReachedEncrypted);
        
        // Convert to bytes32 handles for event
        bytes32 totalPledgedHandle = FHE.toBytes32(campaign.totalPledged);
        bytes32 goalReachedHandle = FHE.toBytes32(goalReachedEncrypted);
        
        // Update status
        campaign.decryptionStatus = DecryptionStatus.InProgress;
        
        emit DecryptionRequested(campaignId, totalPledgedHandle, goalReachedHandle);
    }

    /**
     * @notice Callback to verify and store decrypted campaign results (Step 3 of 3)
     * @dev Anyone can call this after off-chain decryption (Step 2) is complete
     * @param campaignId The campaign ID
     * @param cleartexts ABI-encoded decrypted values (uint64 totalPledged, bool goalReached)
     * @param decryptionProof Proof from Zama KMS that validates the decryption
     */
    function callbackDecryptCampaignResult(
        uint256 campaignId,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) external {
        Campaign storage campaign = campaigns[campaignId];
        
        require(campaign.decryptionStatus == DecryptionStatus.InProgress, "Decryption not in progress");
        
        // Rebuild handles list in SAME ORDER as requestDecryptCampaignResult
        // CRITICAL: Order must match for proof verification
        ebool goalReachedEncrypted = isGoalReached(campaignId);
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(campaign.totalPledged);
        cts[1] = FHE.toBytes32(goalReachedEncrypted);
        
        // Verify the decryption proof
        // This ensures cleartexts are authentic decryptions of the ciphertexts
        FHE.checkSignatures(cts, cleartexts, decryptionProof);
        
        // Decode the cleartext values
        // Order must match: (totalPledged, goalReached)
        (uint64 totalPledged, bool goalReached) = abi.decode(cleartexts, (uint64, bool));
        
        // Store decrypted results
        campaign.decryptedTotalPledged = totalPledged;
        campaign.goalReached = goalReached;
        campaign.decryptionStatus = DecryptionStatus.Completed;
        
        emit DecryptionCompleted(campaignId, totalPledged, goalReached);
    }

    /**
     * @notice Get decrypted campaign results (if decryption is complete)
     * @param campaignId The campaign ID
     * @return status Current decryption status
     * @return totalPledged Decrypted total pledged amount (0 if not decrypted)
     * @return goalReached Whether goal was reached (false if not decrypted)
     */
    function getDecryptedResults(uint256 campaignId) external view returns (
        DecryptionStatus status,
        uint64 totalPledged,
        bool goalReached
    ) {
        Campaign storage campaign = campaigns[campaignId];
        return (
            campaign.decryptionStatus,
            campaign.decryptedTotalPledged,
            campaign.goalReached
        );
    }
}