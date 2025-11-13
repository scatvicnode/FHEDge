# 🧪 FHEDge Testing Guide

Comprehensive testing guide for FHEDge privacy-preserving crowdfunding platform.

## 📋 Table of Contents

1. [Platform Owner Verification](#platform-owner-verification)
2. [Manual Testing](#manual-testing)
3. [Smart Contract Verification](#smart-contract-verification)
4. [Frontend Testing](#frontend-testing)
5. [Platform Fee Testing](#platform-fee-testing)
6. [Security Testing](#security-testing)

---

## 👤 Platform Owner Verification

### How to Verify Platform Owner

The platform owner is **publicly visible to ALL users** for full transparency.

#### Method 1: Check Frontend (Easiest)

**Steps:**
1. Open FHEDge at `http://localhost:3500`
2. Connect any wallet (don't need to be owner)
3. Look at top of page for "ℹ️ Platform Information" card

**You should see:**
```
ℹ️ Platform Information

Platform Fee: 1% per pledge
Platform Owner: 0x8B0898D0...56577986
Total Fees Collected: 0.016 ETH

💡 Why fees? The 1% platform fee supports ongoing development...
```

**If you ARE the owner:**
```
ℹ️ Platform Information          [You are the owner!]

Platform Fee: 1% per pledge
Platform Owner: 0x8B0898D0...56577986 (You)
Total Fees Collected: 0.016 ETH
```

#### Method 2: Check Smart Contract

**Using Etherscan:**
1. Go to: `https://sepolia.etherscan.io/address/0xEBcf8A0945d6c041e3F49CC81A28653cFBA46399`
2. Click "Contract" tab
3. Click "Read Contract"
4. Find `platformOwner` function
5. Click "Query"

**Expected Result:**
```
platformOwner (address)
→ 0x8B0898D065232050408406e21Df7F00756577986
```

#### Method 3: Using Web3 Console

**In browser console:**
```javascript
// Connect to contract
const contract = new ethers.Contract(
  "0xEBcf8A0945d6c041e3F49CC81A28653cFBA46399",
  ["function platformOwner() view returns (address)"],
  provider
);

// Get platform owner
const owner = await contract.platformOwner();
console.log("Platform Owner:", owner);
// Output: Platform Owner: 0x8B0898D065232050408406e21Df7F00756577986
```

### Why Is Platform Owner Public?

**Transparency Features:**

| Feature | Visibility | Why Public? |
|---------|-----------|-------------|
| Platform Owner Address | ✅ Everyone | Trust & accountability |
| Platform Fee Rate | ✅ Everyone | No hidden charges |
| Total Fees Collected | ✅ Everyone | Revenue transparency |
| Fee Withdrawal History | ✅ On-chain | Fully auditable |

**Benefits:**
1. ✅ Users know exactly where 1% fees go
2. ✅ No hidden beneficiaries
3. ✅ Blockchain-verifiable
4. ✅ Community can monitor
5. ✅ Builds trust in platform

### Test Scenario: Verify Owner Transparency

**Test Steps:**
1. Deploy contract from Wallet A
2. Connect with Wallet B (different user)
3. Check "Platform Information" section
4. Verify you can see owner address
5. Verify you can see fee rate (1%)
6. Verify you can see collected fees

**Expected Results:**
- ✅ Wallet B can see Wallet A is platform owner
- ✅ All fee information visible
- ✅ No permission required to view
- ✅ Same info visible on Etherscan

**Success Criteria:**
```
User A (Owner):   Sees "You are the owner!" badge
User B (Regular): Sees "Platform Owner: 0xWalletA..."
User C (Regular): Sees same information as User B
Everyone:         Sees 1% fee rate and total collected
```

---

## 🔍 Manual Testing

### Prerequisites
- MetaMask installed
- Sepolia ETH for testing
- Contract deployed to Sepolia

### Test Scenarios

#### 1️⃣ **Campaign Creation Test**

**Steps:**
1. Connect wallet to Sepolia network
2. Open FHEDge at `http://localhost:3500`
3. Click "✨ Create Campaign"
4. Fill in details:
   - Goal: `1.0` ETH
   - Duration: `5` minutes (for quick testing)
   - Title: "Test Campaign 1"
   - Description: "Testing FHE encryption"
5. Click "🚀 Create Campaign"

**Expected Results:**
- ✅ Transaction confirmation in MetaMask
- ✅ Campaign appears in campaign list
- ✅ Campaign shows as "Active"
- ✅ Goal is encrypted (not visible to others)
- ✅ ETH Balance shows `0 ETH`

**Success Criteria:**
```
Campaign ID: 0
Owner: Your address
Status: Active ✅
ETH Balance: 0.0000 ETH
```

---

#### 2️⃣ **Pledge with Platform Fee Test**

**Steps:**
1. Use **different wallet** (switch account in MetaMask)
2. Find the test campaign
3. Click "💰 Pledge"
4. Enter amount: `0.1` ETH
5. Note the fee notice: "ℹ️ 1% platform fee will be deducted"
6. Click "💸 Pledge Now"

**Expected Results:**
- ✅ Transaction shows `0.1 ETH` being sent
- ✅ Campaign ETH Balance updates to `0.099 ETH` (99% of pledge)
- ✅ Platform fees collected: `0.001 ETH` (1% of pledge)
- ✅ User marked as "Already Pledged"
- ✅ Pledge button disabled for this user

**Fee Calculation:**
```
Pledge Amount:    0.1000 ETH (100%)
Platform Fee:    -0.0010 ETH (1%)
Campaign Gets:    0.0990 ETH (99%)
```

**Multiple Pledges Test:**
```
User A pledges: 0.1 ETH  → Campaign: 0.099 ETH,  Fees: 0.001 ETH
User B pledges: 0.5 ETH  → Campaign: 0.594 ETH,  Fees: 0.006 ETH
User C pledges: 1.0 ETH  → Campaign: 1.584 ETH,  Fees: 0.016 ETH
                Total:      Campaign: 1.683 ETH,  Fees: 0.017 ETH
```

---

#### 3️⃣ **Platform Owner Dashboard Test**

**Steps (must be contract deployer):**
1. Connect with wallet that deployed the contract
2. Notice "💎 Platform Owner" badge in header
3. See "💎 Platform Revenue" section above dashboard
4. Check accumulated fees display

**Expected UI:**
```
💎 Platform Revenue                    Owner Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fee Rate          Collected Fees        Your Address
1%                0.017 ETH             0x8B08...7986

[💰 Withdraw Fees (0.017 ETH)]

ℹ️ Platform fees are collected automatically (1% from each pledge).
   You can withdraw them anytime!
```

**Success Criteria:**
- ✅ Only visible to platform owner
- ✅ Shows correct fee percentage (1%)
- ✅ Shows accumulated fees
- ✅ Shows platform owner address

---

#### 4️⃣ **Platform Owner Receives Fee (Automatic!)**

**Steps:**
1. Check platform owner wallet balance BEFORE any pledges
2. User makes pledge (e.g., 1.0 ETH)
3. Check platform owner wallet balance AFTER pledge
4. Verify 1% fee received instantly!

**Expected Results:**
- ✅ Platform owner wallet balance increases by 1% immediately
- ✅ No manual action needed
- ✅ Fee appears in wallet right after pledge transaction
- ✅ Event `PlatformFeeTransferred` emitted on-chain

**Example:**
```
Platform Owner Wallet BEFORE:
  Balance: 5.0000 ETH

User pledges 1.0 ETH to Campaign #1:
  Transaction confirmed! ✅

Platform Owner Wallet AFTER (instant!):
  Balance: 5.0100 ETH (+0.01 ETH fee) ⚡

Campaign #1 Balance:
  Balance: 0.9900 ETH (99% of pledge)
```

**Success Criteria:**
```
Fee transfer: Instant (same transaction as pledge)
Amount: Exactly 1% of pledge
Recipient: Platform owner address
No manual claim needed: 100% automatic
```

---

#### 5️⃣ **Claim Campaign Test**

**Steps:**
1. Wait for campaign deadline to pass (5 minutes)
2. Switch back to campaign creator wallet
3. Refresh page - campaign shows "Expired"
4. Click "💰 Claim Funds"
5. Confirm popup: "This will transfer ALL ETH from this campaign directly to your wallet!"
6. Approve transaction

**Expected Results:**
- ✅ All campaign ETH transferred to creator's wallet
- ✅ Campaign marked as "Claimed"
- ✅ Campaign `ethBalance` becomes `0`
- ✅ Wallet balance increases by campaign amount

**Example:**
```
Before Claim:
  Campaign Balance: 1.584 ETH
  Owner Wallet: 5.234 ETH

After Claim:
  Campaign Balance: 0 ETH
  Owner Wallet: 6.818 ETH (5.234 + 1.584)
  
Transaction Gas: ~0.002 ETH
```

---

#### 6️⃣ **Refund Test**

**Steps:**
1. Create new campaign (5 min deadline)
2. Get pledge from User A (0.1 ETH)
3. Wait for deadline
4. **Don't claim** (let it expire)
5. User A clicks "↩️ Refund"

**Expected Results:**
- ✅ User A gets `0.099 ETH` back (99% of original pledge)
- ✅ Platform keeps the `0.001 ETH` fee (NOT refunded)
- ✅ Campaign balance decreases by `0.099 ETH`
- ✅ User A marked as "not pledged"

**Important:** Platform fees are NOT refundable (already sent to platform owner)!

---

#### 7️⃣ **Privacy Testing**

**Steps:**
1. Create campaign as User A (goal: 1.0 ETH encrypted)
2. Switch to User B - check campaign details
3. Try to view encrypted goal

**Expected Results:**
- ✅ User B **cannot** see the goal amount
- ✅ User B **cannot** see individual pledge amounts
- ✅ User B **can** see total ETH raised (`ethBalance`)
- ✅ Only encrypted data visible to non-owners

**Privacy Table:**

| Data | User B Sees | Campaign Owner Sees |
|------|-------------|---------------------|
| Goal Amount | ❌ Encrypted | ✅ Can decrypt |
| Their Pledge | ✅ Encrypted | ✅ Can decrypt |
| Others' Pledges | ❌ Hidden | ✅ Encrypted sum |
| Total ETH | ✅ Public | ✅ Public |

---

## ✅ Smart Contract Verification

### Compile Contract
```bash
npx hardhat compile
```

**Expected Output:**
```
Compiled 1 Solidity file successfully (evm target: cancun).
```

### Check Contract on Etherscan

**Steps:**
1. Go to: `https://sepolia.etherscan.io/address/0xEBcf8A0945d6c041e3F49CC81A28653cFBA46399`
2. Check "Contract" tab
3. Verify functions exist:
   - ✅ `createCampaign`
   - ✅ `pledge` (payable)
   - ✅ `claimCampaign`
   - ✅ `refund`
   - ✅ `withdrawPlatformFees`
   - ✅ `getPlatformFeeInfo`

### Read Contract State

**Using Etherscan:**
1. Go to "Read Contract" tab
2. Test these functions:
   - `nextCampaignId()` - Should return number of campaigns
   - `platformOwner()` - Should return deployer address
   - `PLATFORM_FEE_PERCENT()` - Should return `1`
   - `platformFeesCollected()` - Should return accumulated fees

**Example:**
```
platformOwner: 0x8B0898D065232050408406e21Df7F00756577986
PLATFORM_FEE_PERCENT: 1
platformFeesCollected: 17000000000000000 (0.017 ETH in wei)
nextCampaignId: 3
```

---

## 🎨 Frontend Testing

### UI Elements Test

**Check these elements exist:**
- ✅ Dark/Light mode toggle (☀️/🌙)
- ✅ Platform Owner badge (💎) - if you're owner
- ✅ Dashboard with stats
- ✅ Campaign search bar
- ✅ Campaign filter buttons (All/Active/Ended/Claimed)
- ✅ Create Campaign button
- ✅ Platform Revenue section (owners only)

### Responsive Testing

**Test on different screen sizes:**

**Desktop (1920x1080):**
- ✅ Campaign grid shows 3 columns
- ✅ All buttons clearly visible
- ✅ No text overflow

**Tablet (768x1024):**
- ✅ Campaign grid shows 2 columns
- ✅ Modals centered
- ✅ Touch targets minimum 44px

**Mobile (375x667):**
- ✅ Campaign grid shows 1 column
- ✅ Text readable without zoom
- ✅ Buttons accessible with thumb

### Theme Testing

**Dark Mode:**
- ✅ Background: Black gradient
- ✅ Text: Yellow (#fbbf24)
- ✅ Cards: Dark gray with yellow border
- ✅ Good contrast ratio

**Light Mode:**
- ✅ Background: Yellow/cream gradient
- ✅ Text: Dark gray
- ✅ Cards: White with orange border
- ✅ All text readable

---

## 💎 Platform Fee Testing

### Fee Calculation Test

**Manual calculation:**
```javascript
// Test 1: Small pledge
Pledge: 0.01 ETH
Fee: 0.01 * 0.01 = 0.0001 ETH
Campaign gets: 0.01 - 0.0001 = 0.0099 ETH ✅

// Test 2: Medium pledge  
Pledge: 1.0 ETH
Fee: 1.0 * 0.01 = 0.01 ETH
Campaign gets: 1.0 - 0.01 = 0.99 ETH ✅

// Test 3: Large pledge
Pledge: 10.0 ETH
Fee: 10.0 * 0.01 = 0.1 ETH
Campaign gets: 10.0 - 0.1 = 9.9 ETH ✅
```

### Fee Accumulation Test

**Multiple campaigns:**
1. Create Campaign A
2. Create Campaign B
3. Pledge to Campaign A: 1.0 ETH → Fee: 0.01 ETH
4. Pledge to Campaign B: 2.0 ETH → Fee: 0.02 ETH
5. Check `platformFeesCollected`: Should be `0.03 ETH` ✅

### Withdrawal Test

**Before Withdrawal:**
```
platformFeesCollected: 0.05 ETH
Owner Balance: 10.0 ETH
```

**After Withdrawal:**
```
platformFeesCollected: 0.0 ETH
Owner Balance: 10.05 ETH (minus gas)
```

---

## 🔐 Security Testing

### Access Control Tests

**1. Platform Owner Functions:**
- ✅ `withdrawPlatformFees()` - Only owner can call
- ✅ `transferPlatformOwnership()` - Only owner can call
- ❌ Non-owner calling should revert: "Only platform owner"

**2. Campaign Owner Functions:**
- ✅ `claimCampaign()` - Only campaign creator can call
- ❌ Non-owner calling should revert: "Only owner can claim"

### Double-Action Prevention

**1. Double Pledge Test:**
```
User A pledges to Campaign 0: ✅ Success
User A pledges to Campaign 0 again: ❌ "Already pledged to this campaign"
```

**2. Double Claim Test:**
```
Owner claims Campaign 0: ✅ Success
Owner claims Campaign 0 again: ❌ "Campaign is not active"
```

**3. Double Refund Test:**
```
User A refunds from Campaign 0: ✅ Success
User A refunds again: ❌ "No pledge found"
```

### Timing Tests

**1. Early Claim Test:**
```
Campaign deadline: 1 hour from now
Owner tries to claim: ❌ "Campaign has not ended"
```

**2. Early Refund Test:**
```
Campaign deadline: 1 hour from now
Backer tries refund: ❌ "Campaign has not ended"
```

**3. Expired Campaign Pledge Test:**
```
Campaign deadline: 1 hour ago
User tries to pledge: ❌ "Campaign has ended"
```

### Reentrancy Test

**Contract uses "checks-effects-interactions" pattern:**
```solidity
// ✅ State updated BEFORE external call
campaign.claimed = true;
campaign.ethBalance = 0;

// Then transfer
(bool success, ) = payable(msg.sender).call{value: amountToTransfer}("");
```

---

## 📊 Test Results Summary

### ✅ Passing Tests

| Category | Test | Status |
|----------|------|--------|
| **Deployment** | Contract deploys | ✅ |
| **Deployment** | Platform owner set | ✅ |
| **Deployment** | Fee rate is 1% | ✅ |
| **Campaign** | Create campaign | ✅ |
| **Campaign** | Store campaign info | ✅ |
| **Pledge** | Accept pledge | ✅ |
| **Pledge** | Deduct 1% fee | ✅ |
| **Pledge** | Prevent double pledge | ✅ |
| **Claim** | Transfer ETH to owner | ✅ |
| **Claim** | Mark as claimed | ✅ |
| **Refund** | Return ETH to backer | ✅ |
| **Refund** | Keep platform fee | ✅ |
| **Fee** | Withdraw fees | ✅ |
| **Fee** | Reset after withdrawal | ✅ |
| **Security** | Access control | ✅ |
| **Security** | Reentrancy protection | ✅ |

---

## 🚀 Quick Test Checklist

Copy this checklist for testing:

```
□ Install dependencies (npm install)
□ Deploy contract to Sepolia
□ Update .env files with contract address
□ Start frontend (npm run dev)
□ Connect MetaMask to Sepolia
□ Create test campaign
□ Make pledge from different wallet
□ Verify 1% fee deduction
□ Check platform owner dashboard
□ Wait for deadline
□ Claim campaign funds
□ Withdraw platform fees
□ Test refund flow
□ Verify privacy (encrypted data)
□ Test UI on mobile
□ Test dark/light mode
□ Check all buttons work
□ Verify transaction confirmations
```

---

## 📝 Testing Notes

### Important Considerations

1. **FHE Encryption**: Actual encryption happens on-chain using ZAMA's FHE library
2. **Platform Fees**: Always 1%, deducted automatically from each pledge
3. **Gas Costs**: Factor in ~0.002 ETH gas for transactions
4. **Sepolia Testnet**: Use testnet ETH only, get from faucets
5. **Browser**: Chrome/Brave recommended for MetaMask
6. **Network**: Must be on Sepolia (Chain ID: 11155111)

### Common Issues

**Problem:** "FHE SDK not loaded"
**Solution:** Refresh page, SDK loads from CDN

**Problem:** "Wrong network"
**Solution:** Switch MetaMask to Sepolia

**Problem:** "Insufficient funds"
**Solution:** Get Sepolia ETH from faucet

**Problem:** "Transaction failed"
**Solution:** Check gas limit, increase if needed

---

## 🔗 Useful Links

- **Sepolia Faucet**: https://sepoliafaucet.com/
- **Etherscan Sepolia**: https://sepolia.etherscan.io/
- **ZAMA Docs**: https://docs.zama.ai/
- **MetaMask**: https://metamask.io/

---

**Testing completed? Deploy to mainnet! 🚀**

*Remember: Always test thoroughly on testnet before mainnet deployment!*



kok sepertinya gak bisa ya sama gensyn, aneh jadinya, coba tolong infokan apa ya project yang bagus combine fhe ini ?

walrus dari sui gimana? pakai walrus testnet aja 

atau ini saja integrate dengan ethos https://developers.ethos.network/
https://developers.ethos.network/api-documentation/api-v2
https://whitepaper.ethos.network/

yak di sosmed nya ada reputasi gitu bener tuh, cek lagi branch ini https://github.com/hidayahhtaufik/Rockpaperscisscors/tree/FINAL-WORKING-BRANCH

harusnya sudah working disepolia, tinggal ditambah FHE zama + rreputation ethos (base mainnet)

bisa diubah juga ngga nama branch nya biar ngga ambigu, tolongya, dan minta tolong di cek semua file, all file jangan ada fhedge nya kan kita buat branch baru harusnya kamu copy aja ini https://github.com/hidayahhtaufik/Rockpaperscisscors/tree/FINAL-WORKING-BRANCH lalu tambah fhe seperti di branch ini feature/study-zama-resources-for-dapp-development-0415 lalu di tambah ethos nya, letsgoo

kita harus enhance juga sosmed nya, kayak bisa swap tapi private gitu, ada ticker nya di sepolia, dll
