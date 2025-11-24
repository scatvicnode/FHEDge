import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import CampaignList from './components/CampaignList';
import CreateCampaign from './components/CreateCampaign';
import Dashboard from './components/Dashboard';
import PledgeToCampaign from './components/PledgeToCampaign';
import ViewCampaign from './components/ViewCampaign';
import { initializeFheInstance } from './fhevmInstance';

// Contract ABI - UPDATED FOR FHE v0.9+ with Public Decryption Support
const CONTRACT_ABI = [
  "function nextCampaignId() view returns (uint256)",
  "function createCampaign(bytes32 inGoal, bytes calldata inputProof, uint256 deadline, string calldata title, string calldata description) returns (uint256)",
  "function pledge(uint256 campaignId, bytes32 inAmount, bytes calldata inputProof) payable",
  "function getCampaignInfo(uint256 campaignId) view returns (address owner, uint256 deadline, bool active, bool claimed, string title, string description, uint256 ethBalance)",
  "function claimCampaign(uint256 campaignId)",
  "function refund(uint256 campaignId)",
  "function hasPledged(uint256 campaignId, address pledger) view returns (bool)",
  "function platformOwner() view returns (address)",
  // Public Decryption Functions (NEW)
  "function requestDecryptCampaignResult(uint256 campaignId)",
  "function callbackDecryptCampaignResult(uint256 campaignId, bytes memory cleartexts, bytes memory decryptionProof)",
  "function getDecryptedResults(uint256 campaignId) view returns (uint8 status, uint64 totalPledged, bool goalReached)",
  // Events
  "event CampaignCreated(uint256 indexed campaignId, address indexed owner, string title, uint256 deadline)",
  "event PledgeMade(uint256 indexed campaignId, address indexed pledger)",
  "event CampaignClaimed(uint256 indexed campaignId, address indexed owner)",
  "event RefundIssued(uint256 indexed campaignId, address indexed pledger)",
  "event PlatformFeeTransferred(uint256 indexed campaignId, address indexed platformOwner, uint256 feeAmount)",
  // Decryption Events (NEW)
  "event DecryptionRequested(uint256 indexed campaignId, bytes32 totalPledgedHandle, bytes32 goalReachedHandle)",
  "event DecryptionCompleted(uint256 indexed campaignId, uint64 decryptedTotalPledged, bool goalReached)"
];

// Contract address from environment variable
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0x3cEdff9D57EC046BeA6E2787d3BB07d07778B0F9";
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

function App() {
  // State management
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [fhevmInstance, setFhevmInstance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // Tab state
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'mine'

  // Campaigns data
  const [campaigns, setCampaigns] = useState([]);
  const [myCampaigns, setMyCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Initialize FHE SDK on mount
  useEffect(() => {
    initFHEVM();
  }, []);

  // Load campaigns when contract is ready
  useEffect(() => {
    if (contract && account) {
      loadCampaigns();
    }
  }, [contract, account]);

  // Auto-refresh campaigns every 5 minutes when connected
  useEffect(() => {
    if (!contract || !account) return;

    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing campaigns...');
      loadCampaigns(true); // Silent refresh (no loading spinner)
    }, 300000); // 5 minutes

    return () => clearInterval(interval);
  }, [contract, account]);

  const initFHEVM = async () => {
    // FHE SDK will be loaded when wallet connects
    // No pre-loading to avoid issues
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask to use this dApp');
      return;
    }

    try {
      setLoading(true);
      setStatus({ type: 'info', message: '🔗 Connecting to wallet...' });

      // Request accounts
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      // Check/switch network
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });

      if (chainId !== SEPOLIA_CHAIN_ID) {
        setStatus({ type: 'warning', message: '⚠️ Switching to Sepolia...' });
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            alert('Please add Sepolia network to your wallet manually');
          }
          throw switchError;
        }
      }

      // Set account immediately for faster feedback
      setAccount(accounts[0]);
      setStatus({ type: 'success', message: '✅ Wallet connected!' });

      // Setup contract and FHE SDK in parallel for faster loading
      setStatus({ type: 'info', message: '⚙️ Setting up...' });

      const [contractInstance, fheInstance] = await Promise.all([
        (async () => {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        })(),
        initializeFheInstance()
      ]);

      setContract(contractInstance);
      setFhevmInstance(fheInstance);

      setStatus({ type: 'success', message: '✅ Ready!' });
      setTimeout(() => setStatus({ type: '', message: '' }), 2000);
    } catch (error) {
      console.error('Connection error:', error);
      setStatus({
        type: 'error',
        message: `❌ ${error.message || 'Failed to connect wallet'}`
      });
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setContract(null);
    setFhevmInstance(null);
    setCampaigns([]);
    setMyCampaigns([]);
    setStatus({ type: 'info', message: '👋 Wallet disconnected' });
    setTimeout(() => setStatus({ type: '', message: '' }), 3000);
  };

  const loadCampaigns = async (silent = false) => {
    if (!contract || !account) return;

    try {
      if (!silent) setLoadingCampaigns(true);
      const nextId = await contract.nextCampaignId();
      const total = Number(nextId);

      const allCampaigns = [];
      const userCampaigns = [];

      for (let i = 0; i < total; i++) {
        try {
          const info = await contract.getCampaignInfo(i);
          const hasPledged = await contract.hasPledged(i, account);
          const decryptionResults = await contract.getDecryptedResults(i);

          const campaign = {
            id: i,
            owner: info[0],
            deadline: Number(info[1]),
            active: info[2],
            claimed: info[3],
            title: info[4],
            description: info[5],
            ethBalance: info[6],  // ETH balance for this campaign
            isOwner: info[0].toLowerCase() === account.toLowerCase(),
            hasPledged: hasPledged,
            // Decryption status
            decryptionStatus: ['NotRequested', 'InProgress', 'Completed'][Number(decryptionResults[0])],
            decryptedTotalPledged: String(decryptionResults[1]),
            goalReached: decryptionResults[2]
          };

          allCampaigns.push(campaign);

          if (campaign.isOwner) {
            userCampaigns.push(campaign);
          }
        } catch (err) {
          console.log(`Campaign ${i} error:`, err);
        }
      }

      setCampaigns(allCampaigns);
      setMyCampaigns(userCampaigns);
      setLastRefresh(Date.now());
    } catch (error) {
      console.error('Error loading campaigns:', error);
      if (!silent) {
        setStatus({ type: 'error', message: '❌ Failed to load campaigns' });
      }
    } finally {
      if (!silent) setLoadingCampaigns(false);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    setStatus({ type: 'success', message: '🎉 Campaign created successfully!' });
    setTimeout(() => setStatus({ type: '', message: '' }), 5000);
    loadCampaigns();
  };

  const handlePledgeSuccess = () => {
    setShowPledgeModal(false);
    setSelectedCampaign(null);
    setStatus({ type: 'success', message: '💰 Pledge successful!' });
    setTimeout(() => setStatus({ type: '', message: '' }), 5000);
    loadCampaigns();
  };

  const handlePledgeClick = (campaign) => {
    setSelectedCampaign(campaign);
    setShowPledgeModal(true);
  };

  const handleViewClick = (campaign) => {
    setSelectedCampaign(campaign);
    setShowViewModal(true);
  };

  const handleRefreshCampaigns = () => {
    loadCampaigns();
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div>
            <h1>🔐 FHEDge</h1>
            <p>Private Crowdfunding with Fully Homomorphic Encryption</p>
          </div>

          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginLeft: 'auto' }}>
            <button
              onClick={toggleTheme}
              className="btn-theme"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {account && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
              >
                ➕ Create Campaign
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Wallet Section */}
      <section className="wallet-section">
        {!account ? (
          <div className="wallet-connect">
            <div className="connect-info">
              <h3>🚀 Get Started</h3>
              <p>Connect your wallet to create campaigns and make pledges</p>
              <ul className="features-list">
                <li>🔒 Fully encrypted goals and pledges</li>
                <li>💰 Support causes privately</li>
                <li>🎯 Create unlimited campaigns</li>
                <li>⚡ Instant on-chain transactions</li>
              </ul>
            </div>
            <button
              onClick={connectWallet}
              disabled={loading}
              className="btn-connect"
            >
              {loading ? '⏳ Connecting...' : '🔗 Connect Wallet'}
            </button>
          </div>
        ) : (
          <div className="wallet-info">
            <div className="wallet-details">
              <span className="wallet-label">Connected:</span>
              <span className="wallet-address">
                {account.substring(0, 6)}...{account.substring(38)}
              </span>
              <span className="network-badge">Sepolia</span>
            </div>
            <button onClick={disconnectWallet} className="btn-secondary">
              Disconnect
            </button>
          </div>
        )}
      </section>

      {/* Status Messages */}
      {status.message && (
        <div className={`alert alert-${status.type}`}>
          {status.message}
        </div>
      )}

      {/* Main Content */}
      {account && contract && fhevmInstance ? (
        <>
          {/* Dashboard Stats */}
          <Dashboard
            campaigns={campaigns}
            myCampaigns={myCampaigns}
            account={account}
            onRefresh={handleRefreshCampaigns}
            lastRefresh={lastRefresh}
          />

          {/* Divider */}
          <div className="section-divider"></div>

          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              🌍 All Campaigns ({campaigns.length})
            </button>
            <button
              className={`tab ${activeTab === 'mine' ? 'active' : ''}`}
              onClick={() => setActiveTab('mine')}
            >
              👤 My Campaigns ({myCampaigns.length})
            </button>
          </div>

          {/* Campaign List */}
          <CampaignList
            campaigns={activeTab === 'all' ? campaigns : myCampaigns}
            loading={loadingCampaigns}
            account={account}
            contract={contract}
            onPledge={handlePledgeClick}
            onView={handleViewClick}
            onRefresh={loadCampaigns}
          />

          {/* Modals */}
          {showCreateModal && (
            <CreateCampaign
              contract={contract}
              fhevmInstance={fhevmInstance}
              account={account}
              onClose={() => setShowCreateModal(false)}
              onSuccess={handleCreateSuccess}
            />
          )}

          {showPledgeModal && selectedCampaign && (
            <PledgeToCampaign
              contract={contract}
              fhevmInstance={fhevmInstance}
              account={account}
              campaign={selectedCampaign}
              onClose={() => {
                setShowPledgeModal(false);
                setSelectedCampaign(null);
              }}
              onSuccess={handlePledgeSuccess}
            />
          )}

          {showViewModal && selectedCampaign && (
            <ViewCampaign
              campaign={selectedCampaign}
              contract={contract}
              account={account}
              onClose={() => {
                setShowViewModal(false);
                setSelectedCampaign(null);
              }}
              onPledge={handlePledgeClick}
              onRefresh={() => loadCampaigns(true)}
            />
          )}
        </>
      ) : (
        <div className="welcome-section">
          <div className="welcome-card">
            <h2>🎯 How It Works</h2>
            <div className="steps">
              <div className="step">
                <div className="step-number">1</div>
                <h3>Connect Wallet</h3>
                <p>Use MetaMask to connect to Sepolia testnet</p>
              </div>
              <div className="step">
                <div className="step-number">2</div>
                <h3>Create Campaign</h3>
                <p>Set encrypted goals that nobody can see</p>
              </div>
              <div className="step">
                <div className="step-number">3</div>
                <h3>Get Pledges</h3>
                <p>Receive private support from backers</p>
              </div>
              <div className="step">
                <div className="step-number">4</div>
                <h3>Claim Funds</h3>
                <p>Collect pledges after deadline</p>
              </div>
            </div>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🔐</div>
              <h3>Fully Private</h3>
              <p>Goals and pledges encrypted with FHE</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Lightning Fast</h3>
              <p>Instant transactions on Ethereum</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Easy to Use</h3>
              <p>Simple interface, powerful features</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🛡️</div>
              <h3>Secure</h3>
              <p>Audited smart contracts on Sepolia</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
