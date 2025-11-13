import React, { useState } from 'react';
import { ethers } from 'ethers';

function PledgeToCampaign({ contract, fhevmInstance, account, campaign, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const handlePledge = async (e) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      setStatus({ type: 'error', message: 'Please enter a valid amount' });
      return;
    }

    try {
      setLoading(true);
      setStatus({ type: 'info', message: '🔐 Encrypting pledge amount...' });

      // Convert ETH to wei for encryption
      const amountInWei = ethers.parseEther(amount);
      
      const contractAddress = await contract.getAddress();
      const input = fhevmInstance.createEncryptedInput(contractAddress, account);
      input.add64(Number(amountInWei));
      const encryptedAmount = await input.encrypt();

      setStatus({ type: 'info', message: '💰 Submitting pledge...' });

      // Make the pledge with ETH value
      const tx = await contract.pledge(
        campaign.id,
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        { value: amountInWei }
      );

      setStatus({ type: 'info', message: '⏳ Waiting for confirmation...' });
      await tx.wait();

      setStatus({ type: 'success', message: '✅ Pledge successful!' });
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error) {
      console.error('Error making pledge:', error);
      setStatus({ 
        type: 'error', 
        message: `Failed: ${error.message?.substring(0, 100) || 'Unknown error'}` 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💰 Make a Pledge</h2>
          <button className="close-btn" onClick={onClose} disabled={loading}>×</button>
        </div>

        <div className="campaign-info" style={{
          padding: '20px',
          background: 'var(--secondary)',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '2px solid var(--primary)'
        }}>
          <h3 style={{color: 'var(--primary)', marginBottom: '10px'}}>{campaign.title}</h3>
          <p style={{color: '#d1d5db', lineHeight: '1.6'}}>{campaign.description}</p>
          <div style={{marginTop: '15px', paddingTop: '15px', borderTop: '1px solid var(--primary)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
              <span style={{color: '#9ca3af'}}>Owner:</span>
              <span style={{color: 'var(--primary)', fontFamily: 'monospace'}}>
                {campaign.owner.substring(0, 6)}...{campaign.owner.substring(38)}
              </span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: '#9ca3af'}}>Status:</span>
              <span style={{color: campaign.active ? 'var(--success)' : 'var(--warning)'}}>
                {campaign.active ? '✅ Active' : '⏰ Ended'}
              </span>
            </div>
          </div>
        </div>

        {status.message && (
          <div className={`alert alert-${status.type}`} style={{marginBottom: '20px'}}>
            {status.message}
          </div>
        )}

        <form onSubmit={handlePledge}>
          <div className="form-group">
            <label>Pledge Amount (ETH) * 🔒 Encrypted</label>
            <input
              type="number"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.1"
              disabled={loading}
              required
              min="0.001"
              autoFocus
            />
            <small>💡 Examples: 0.1 ETH, 1 ETH, 0.01 ETH</small>
            <div 
              style={{
                marginTop: '18px',
                padding: '16px 18px',
                borderRadius: '12px',
                background: 'var(--secondary)',
                border: '2px solid var(--primary)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '22px', marginTop: '2px' }}>ℹ️</span>

              <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                <strong style={{ color: 'var(--primary)' }}>
                  1% platform fee
                </strong>
                {' '}will be automatically sent to platform owner.
                <br />
                Campaign receives{' '}
                <strong style={{ color: 'var(--primary)' }}>
                  99%.
                </strong>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button 
              type="submit" 
              className="btn-primary btn-large"
              disabled={loading}
            >
              {loading ? '🔄 Processing...' : '💸 Pledge Now'}
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              className="btn-secondary btn-large"
              disabled={loading}
            >
              ❌ Cancel
            </button>
          </div>
        </form>

        <div className="privacy-notice" style={{marginTop: '25px'}}>
          <span className="privacy-icon">🔒</span>
          <div>
            <h4>Privacy Protected</h4>
            <p>Your pledge amount is encrypted using FHE. Only you and the campaign owner can see contributions!</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PledgeToCampaign;
