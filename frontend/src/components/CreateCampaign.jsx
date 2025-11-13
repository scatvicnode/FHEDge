import React, { useState } from 'react';
import { ethers } from 'ethers';

function CreateCampaign({ contract, fhevmInstance, account, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goal: '',
    durationType: 'days',
    durationValue: '30'
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.goal) {
      setStatus({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }

    try {
      setLoading(true);
      setStatus({ type: 'info', message: '🔐 Encrypting goal amount...' });

      // Convert ETH to wei for encryption
      const goalInWei = ethers.parseEther(formData.goal);
      
      const contractAddress = await contract.getAddress();
      const input = fhevmInstance.createEncryptedInput(contractAddress, account);
      input.add64(Number(goalInWei));
      const encryptedGoal = await input.encrypt();

      setStatus({ type: 'info', message: '📝 Creating campaign...' });

      // Calculate deadline based on duration type
      let durationInSeconds;
      const value = parseInt(formData.durationValue);
      
      switch(formData.durationType) {
        case 'minutes':
          durationInSeconds = value * 60;
          break;
        case 'hours':
          durationInSeconds = value * 60 * 60;
          break;
        case 'days':
          durationInSeconds = value * 24 * 60 * 60;
          break;
        default:
          durationInSeconds = value * 24 * 60 * 60;
      }

      const deadline = Math.floor(Date.now() / 1000) + durationInSeconds;

      // Create campaign
      const tx = await contract.createCampaign(
        encryptedGoal.handles[0],
        encryptedGoal.inputProof,
        deadline,
        formData.title,
        formData.description || "No description provided"
      );

      setStatus({ type: 'info', message: '⏳ Waiting for confirmation...' });
      await tx.wait();

      setStatus({ type: 'success', message: '✅ Campaign created successfully!' });
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error) {
      console.error('Error creating campaign:', error);
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
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✨ Create New Campaign</h2>
          <button className="close-btn" onClick={onClose} disabled={loading}>×</button>
        </div>

        {status.message && (
          <div className={`alert alert-${status.type}`} style={{marginBottom: '20px'}}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Campaign Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="My Awesome Project"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Tell people about your campaign..."
              disabled={loading}
              rows="4"
            />
          </div>

          <div className="form-group">
            <label>Goal Amount (ETH) * 🔒 Encrypted</label>
            <input
              type="number"
              step="0.001"
              value={formData.goal}
              onChange={(e) => setFormData({...formData, goal: e.target.value})}
              placeholder="1.0"
              disabled={loading}
              required
              min="0.001"
            />
            <small>💡 Examples: 0.1 ETH, 1 ETH, 0.001 ETH</small>
          </div>

          <div className="form-group">
            <label>Campaign Duration</label>
            <div style={{display: 'flex', gap: '10px'}}>
              <input
                type="number"
                value={formData.durationValue}
                onChange={(e) => setFormData({...formData, durationValue: e.target.value})}
                placeholder="30"
                disabled={loading}
                required
                min="1"
                max="90"
                style={{flex: 1}}
              />
              <select
                value={formData.durationType}
                onChange={(e) => setFormData({...formData, durationType: e.target.value})}
                disabled={loading}
                style={{flex: 1}}
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
            <small>⏰ Range: 5 minutes to 90 days</small>
          </div>

          <div className="modal-actions">
            <button 
              type="submit" 
              className="btn-primary btn-large"
              disabled={loading}
            >
              {loading ? '🔄 Creating...' : '🚀 Create Campaign'}
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
            <p>Your goal amount is encrypted using FHE and remains private. Only you can see the actual target!</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateCampaign;
