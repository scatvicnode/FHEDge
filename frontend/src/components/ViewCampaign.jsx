import DecryptionResults from './DecryptionResults';

function ViewCampaign({ campaign, contract, account, onClose, onPledge }) {
  const timeLeft = campaign.deadline * 1000 - Date.now();
  const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

  const isExpired = timeLeft < 0;
  const isOwner = campaign.isOwner;
  const hasPledged = campaign.hasPledged || false;
  const canPledge = campaign.active && !isExpired && !isOwner && !hasPledged;

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getStatusBadge = () => {
    if (campaign.claimed) {
      return <span className="badge badge-claimed">🎉 Claimed</span>;
    }
    if (isExpired) {
      return <span className="badge badge-expired">⏰ Expired</span>;
    }
    if (!campaign.active) {
      return <span className="badge badge-ended">⏰ Ended</span>;
    }
    return <span className="badge badge-active">✨ Active</span>;
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Campaign Details</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="campaign-detail">
          {/* Header Section */}
          <div className="detail-header">
            <div>
              <h1>{campaign.title}</h1>
              <p className="campaign-id">Campaign #{campaign.id}</p>
            </div>
            {getStatusBadge()}
          </div>

          {/* Description */}
          <div className="detail-section">
            <h3>📝 Description</h3>
            <p className="description-text">
              {campaign.description || 'No description provided'}
            </p>
          </div>

          {/* Campaign Info */}
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">👤 Owner</div>
              <div className="detail-value mono" style={{ fontSize: '0.95em' }}>
                {campaign.owner.substring(0, 8)}...{campaign.owner.substring(38)}
                {isOwner && <span className="badge badge-you">You</span>}
              </div>
            </div>

            {campaign.ethBalance !== undefined && (
              <div className="detail-item">
                <div className="detail-label">💰 Raised (ETH)</div>
                <div className="detail-value highlight">
                  {(Number(campaign.ethBalance) / 1e18).toFixed(4)} ETH
                </div>
              </div>
            )}

            <div className="detail-item">
              <div className="detail-label">⏰ Deadline</div>
              <div className="detail-value">
                {formatDate(campaign.deadline)}
              </div>
            </div>

            <div className="detail-item">
              <div className="detail-label">📊 Status</div>
              <div className="detail-value">
                {campaign.claimed ? 'Claimed' : isExpired ? 'Expired' : campaign.active ? 'Active' : 'Ended'}
              </div>
            </div>

            <div className="detail-item">
              <div className="detail-label">⏳ Time Remaining</div>
              <div className="detail-value" style={{ fontSize: '0.95em' }}>
                {isExpired ? (
                  <span className="text-danger">⏰ Expired</span>
                ) : (
                  <span className="highlight">
                    {daysLeft > 0 && `${daysLeft}d `}
                    {hoursLeft}h {minutesLeft}m
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="privacy-notice">
            <div className="privacy-icon">🔐</div>
            <div>
              <h4>Privacy Protected</h4>
              <p>Goal amount and all pledge amounts are encrypted using FHE.
                Only the campaign owner can see their encrypted total.</p>
            </div>
          </div>

          {/* Decryption Results (NEW) */}
          <DecryptionResults
            campaign={campaign}
            contract={contract}
            onUpdate={() => window.location.reload()}
          />

          {/* Actions */}
          <div className="detail-actions">
            {campaign.active && !isExpired && !isOwner && (
              <button
                onClick={() => {
                  if (!hasPledged) {
                    onClose();
                    onPledge(campaign);
                  }
                }}
                className="btn-primary btn-large"
                disabled={hasPledged}
                style={hasPledged ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
              >
                {hasPledged ? '✅ Already Pledged' : '💰 Make a Pledge'}
              </button>
            )}

            {isOwner && campaign.active && isExpired && !campaign.claimed && campaign.ethBalance > 0 && (
              <button
                onClick={async () => {
                  try {
                    const tx = await contract.claimCampaign(campaign.id);
                    await tx.wait();
                    alert('✅ Campaign claimed successfully!');
                    onClose();
                  } catch (error) {
                    alert(`❌ ${error.message}`);
                  }
                }}
                className="btn-success btn-large"
              >
                🎉 Claim Campaign
              </button>
            )}

            {isOwner && campaign.active && isExpired && !campaign.claimed && campaign.ethBalance === 0 && (
              <button
                disabled
                className="btn-claim-disabled btn-large"
                title="No pledges received yet"
              >
                💸 No Funds to Claim
              </button>
            )}

            {!isOwner && !campaign.active && !campaign.claimed && (
              <button
                onClick={async () => {
                  try {
                    const tx = await contract.refund(campaign.id);
                    await tx.wait();
                    alert('✅ Refund successful!');
                    onClose();
                  } catch (error) {
                    alert(`❌ ${error.message}`);
                  }
                }}
                className="btn-secondary btn-large"
              >
                ↩️ Request Refund
              </button>
            )}

            <button onClick={onClose} className="btn-secondary btn-large">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ViewCampaign;
