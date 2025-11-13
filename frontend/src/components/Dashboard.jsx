
function Dashboard({ campaigns, myCampaigns, account, onRefresh, lastRefresh }) {
  // Count campaigns based on actual status (considering expiration)
  const activeCampaigns = campaigns.filter(c => {
    const isExpired = c.deadline * 1000 < Date.now();
    return c.active && !isExpired;
  }).length;
  
  const endedCampaigns = campaigns.filter(c => {
    const isExpired = c.deadline * 1000 < Date.now();
    return (isExpired || !c.active) && !c.claimed;
  }).length;
  
  const claimedCampaigns = campaigns.filter(c => c.claimed).length;
  
  // My campaigns with accurate status
  const myActive = myCampaigns.filter(c => {
    const isExpired = c.deadline * 1000 < Date.now();
    return c.active && !isExpired;
  }).length;
  
  const myEnded = myCampaigns.filter(c => {
    const isExpired = c.deadline * 1000 < Date.now();
    return (isExpired || !c.active) && !c.claimed;
  }).length;
  
  const myClaimed = myCampaigns.filter(c => c.claimed).length;

  const getTimeSinceRefresh = () => {
    if (!lastRefresh) return '';
    const seconds = Math.floor((Date.now() - lastRefresh) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">📊 Dashboard</h2>
        <div className="dashboard-actions">
          {lastRefresh && (
            <span className="last-refresh">
              Last updated: {getTimeSinceRefresh()}
            </span>
          )}
          <button onClick={onRefresh} className="btn-refresh-dashboard" title="Refresh campaign data">
            🔄 Refresh Now
          </button>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🌍</div>
          <div className="stat-content">
            <h3>{campaigns.length}</h3>
            <p>Total Campaigns</p>
          </div>
        </div>

        <div className="stat-card stat-active">
          <div className="stat-icon">✨</div>
          <div className="stat-content">
            <h3>{activeCampaigns}</h3>
            <p>Active Now</p>
          </div>
        </div>

        <div className="stat-card stat-success">
          <div className="stat-icon">🎉</div>
          <div className="stat-content">
            <h3>{claimedCampaigns}</h3>
            <p>Successfully Claimed</p>
          </div>
        </div>

        <div className="stat-card stat-mine">
          <div className="stat-icon">👤</div>
          <div className="stat-content">
            <h3>{myCampaigns.length}</h3>
            <p>My Campaigns</p>
            <small>{myActive} active • {myClaimed} claimed</small>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
