import { useState } from 'react';

function CampaignList({ campaigns, loading, account, contract, onPledge, onView, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, ended, claimed

  const filteredCampaigns = campaigns.filter(campaign => {
    // Search filter
    const matchesSearch = 
      campaign.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      campaign.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter - use actual time-based status, not just contract.active
    const isExpired = campaign.deadline * 1000 < Date.now();
    let matchesStatus = true;
    if (filterStatus === 'active') {
      matchesStatus = campaign.active && !isExpired;
    } else if (filterStatus === 'ended') {
      matchesStatus = (isExpired || !campaign.active) && !campaign.claimed;
    } else if (filterStatus === 'claimed') {
      matchesStatus = campaign.claimed;
    }

    return matchesSearch && matchesStatus;
  });

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTimeLeft = (deadline) => {
    const timeLeft = deadline * 1000 - Date.now();
    if (timeLeft < 0) return '⏰ Expired';
    
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const getStatusBadge = (campaign) => {
    // Check claimed first
    if (campaign.claimed) {
      return <span className="badge badge-claimed">Claimed</span>;
    }
    
    // Check if expired (prioritize over contract.active)
    const timeLeft = campaign.deadline * 1000 - Date.now();
    if (timeLeft < 0) {
      return <span className="badge badge-expired">Expired</span>;
    }
    
    // Check if ended but not expired (manually deactivated)
    if (!campaign.active) {
      return <span className="badge badge-ended">Ended</span>;
    }
    
    // Still active and not expired
    return <span className="badge badge-active">Active</span>;
  };

  if (loading) {
    return (
      <div className="campaigns-section">
        <div className="loading-campaigns">
          <div className="spinner"></div>
          <p>Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="campaigns-section">
      {/* Toolbar */}
      <div className="campaigns-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-buttons">
          <button 
            className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${filterStatus === 'active' ? 'active' : ''}`}
            onClick={() => setFilterStatus('active')}
          >
            Active
          </button>
          <button 
            className={`filter-btn ${filterStatus === 'ended' ? 'active' : ''}`}
            onClick={() => setFilterStatus('ended')}
          >
            Ended
          </button>
          <button 
            className={`filter-btn ${filterStatus === 'claimed' ? 'active' : ''}`}
            onClick={() => setFilterStatus('claimed')}
          >
            Claimed
          </button>
        </div>

        <button onClick={onRefresh} className="btn-refresh" title="Refresh">
          🔄
        </button>
      </div>

      {/* Results Count */}
      {searchTerm && (
        <div className="results-count">
          Found {filteredCampaigns.length} campaign(s)
        </div>
      )}

      {/* Campaigns Grid */}
      {filteredCampaigns.length === 0 ? (
        <div className="no-campaigns">
          <div className="no-campaigns-icon">📭</div>
          <h3>No campaigns found</h3>
          <p>
            {searchTerm 
              ? 'Try different search terms' 
              : 'Be the first to create a campaign!'}
          </p>
        </div>
      ) : (
        <div className="campaigns-grid">
          {filteredCampaigns.map((campaign) => {
            const isOwner = campaign.isOwner;
            const isExpired = campaign.deadline * 1000 < Date.now();
            const canPledge = campaign.active && !isExpired && !isOwner && !campaign.hasPledged;
            const canClaim = isOwner && campaign.active && isExpired && !campaign.claimed && campaign.ethBalance > 0;
            const canRefund = !isOwner && !campaign.active && !campaign.claimed;

            return (
              <div key={campaign.id} className="campaign-card">
                <div className="campaign-card-header">
                  <h3>{campaign.title}</h3>
                  {getStatusBadge(campaign)}
                </div>

                <p className="campaign-description">
                  {campaign.description.length > 100 
                    ? campaign.description.substring(0, 100) + '...'
                    : campaign.description || 'No description'}
                </p>

                <div className="campaign-meta">
                  <div className="meta-item">
                    <span className="meta-label">ID:</span>
                    <span className="meta-value">#{campaign.id}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Owner:</span>
                    <span className="meta-value mono">
                      {campaign.owner.substring(0, 6)}...{campaign.owner.substring(38)}
                    </span>
                  </div>
                </div>

                <div className="campaign-footer">
                  <div className="campaign-time">
                    <span className="time-icon">⏰</span>
                    <span>{getTimeLeft(campaign.deadline)}</span>
                  </div>
                  
                  {isOwner && (
                    <span className="owner-badge">👤 Your Campaign</span>
                  )}
                </div>

                <div className="campaign-actions">
                  <button 
                    onClick={() => onView(campaign)}
                    className="btn-view"
                  >
                    👁️ View Details
                  </button>

                  {campaign.active && !isExpired && !isOwner && (
                    <button 
                      onClick={() => onPledge(campaign)}
                      className="btn-pledge"
                      disabled={campaign.hasPledged}
                    >
                      {campaign.hasPledged ? '✅ Already Pledged' : '💰 Pledge'}
                    </button>
                  )}

                  {canClaim && (
                    <button 
                      onClick={async () => {
                        if (!window.confirm('🎉 Claim all funds now?\n\nThis will transfer ALL ETH from this campaign directly to your wallet!')) {
                          return;
                        }
                        try {
                          const tx = await contract.claimCampaign(campaign.id);
                          await tx.wait();
                          alert('✅ Funds claimed and transferred to your wallet!');
                          onRefresh();
                        } catch (error) {
                          alert(`❌ ${error.message}`);
                        }
                      }}
                      className="btn-claim"
                    >
                      💰 Claim Funds
                    </button>
                  )}

                  {isOwner && campaign.active && isExpired && !campaign.claimed && campaign.ethBalance === 0 && (
                    <button 
                      disabled
                      className="btn-claim-disabled"
                      title="No pledges received yet"
                    >
                      💸 No Funds to Claim
                    </button>
                  )}

                  {canRefund && (
                    <button 
                      onClick={async () => {
                        try {
                          const tx = await contract.refund(campaign.id);
                          await tx.wait();
                          alert('✅ Refund processed!');
                          onRefresh();
                        } catch (error) {
                          alert(`❌ ${error.message}`);
                        }
                      }}
                      className="btn-refund"
                    >
                      ↩️ Refund
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CampaignList;
