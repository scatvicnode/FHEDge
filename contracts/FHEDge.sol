// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, externalEuint64, euint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHEDge
 * @notice A privacy-preserving crowdfunding contract using Fully Homomorphic Encryption (FHE)
 * @dev Campaign goals and pledge amounts remain encrypted throughout the process
 * 
 * Key Features:
 * - Encrypted campaign goals (competitors can't see your target)
 * - Private pledge amounts (donor privacy maintained)
 * - Confidential total tracking using FHE operations
 * - Goal verification without revealing exact amounts
 * - Owner-controlled decryption for campaign management
 */
contract FHEDge is SepoliaConfig {
    // Platform fee: 1% of each pledge goes to contract owner
    uint256 public constant PLATFORM_FEE_PERCENT = 1;
    uint256 public constant FEE_DENOMINATOR = 100;
    
    // Contract owner (receives platform fees automatically)
    address public immutable platformOwner;
    
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
    
    /**
     * @notice Constructor sets the platform owner (immutable)
     */
    constructor() {
        platformOwner = msg.sender;
    }

    /**
     * @notice Create a new crowdfunding campaign with encrypted goal
     * @param inGoal Encrypted goal amount as externalEuint64
     * @param inputProof Proof for the encrypted input
     * @param deadline Campaign end timestamp
     * @param title Campaign title
     * @param description Campaign description
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
        
        // Convert external encrypted input to euint64
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
            ethBalance: 0  // Initialize ETH balance
        });
        
        // Allow contract and owner to access the encrypted goal
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
     * @param campaignId The campaign to pledge to
     * @param inAmount Encrypted pledge amount as externalEuint64
     * @param inputProof Proof for the encrypted input
     * @dev msg.value must match the encrypted amount (verified off-chain)
     */
    function pledge(
        uint256 campaignId,
        externalEuint64 inAmount,
        bytes calldata inputProof
    ) external payable {
        Campaign storage campaign = campaigns[campaignId];
        
        require(campaign.active, "Campaign is not active");
        require(block.timestamp < campaign.deadline, "Campaign has ended");
        require(!hasPledged[campaignId][msg.sender], "Already pledged to this campaign");
        require(msg.value > 0, "Must send ETH with pledge");
        
        // Convert external encrypted input to euint64
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
        
        // Add to total using FHE addition
        campaign.totalPledged = FHE.add(campaign.totalPledged, amount);
        
        // Grant access permissions
        FHE.allowThis(amount);
        FHE.allow(amount, msg.sender);
        FHE.allowThis(campaign.totalPledged);
        FHE.allow(campaign.totalPledged, campaign.owner);
        
        emit PledgeMade(campaignId, msg.sender);
    }

    /**
     * @notice Check if campaign goal has been reached (returns encrypted boolean)
     * @param campaignId The campaign to check
     * @return Encrypted boolean indicating if goal is reached
     */
    function isGoalReached(uint256 campaignId) public returns (ebool) {
        Campaign storage campaign = campaigns[campaignId];
        require(campaign.active || campaign.claimed, "Campaign does not exist");
        
        // Compare: totalPledged >= goal
        return FHE.ge(campaign.totalPledged, campaign.goal);
    }

    /**
     * @notice Campaign owner claims funds - DIRECTLY transfers ALL campaign ETH to owner!
     * @param campaignId The campaign to claim from
     * @dev Transfers campaign.ethBalance (all pledged ETH) directly to owner's wallet
     */
    function claimCampaign(uint256 campaignId) external {
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
     * @dev Returns the EXACT ETH amount you pledged - direct transfer back to you!
     */
    function refund(uint256 campaignId) external {
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
}
