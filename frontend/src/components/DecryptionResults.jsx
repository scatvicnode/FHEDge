import { useState } from 'react';
import { publicDecryptMultiple } from '../fhevmInstance';

/**
 * Decryption Results Component
 * Displays campaign decryption status and handles the 3-step workflow
 */
function DecryptionResults({ campaign, contract, onUpdate }) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const isOwner = campaign.isOwner;
    const isExpired = (campaign.deadline * 1000 - Date.now()) < 0;
    const canRequestDecryption = isOwner && isExpired && campaign.decryptionStatus === 'NotRequested' && campaign.active;

    const handleRequestDecryption = async () => {
        try {
            setLoading(true);
            setStatus('📡 Requesting decryption from contract...');

            // Step 1: On-chain request
            const tx = await contract.requestDecryptCampaignResult(campaign.id);
            setStatus('⏳ Waiting for transaction confirmation...');
            const receipt = await tx.wait();

            setStatus('🔍 Parsing decryption event...');

            // Find DecryptionRequested event
            const event = receipt.logs.find(log => {
                try {
                    const parsed = contract.interface.parseLog(log);
                    return parsed && parsed.name === 'DecryptionRequested';
                } catch {
                    return false;
                }
            });

            if (!event) {
                throw new Error('DecryptionRequested event not found');
            }

            // Extract handles from event
            const parsedEvent = contract.interface.parseLog(event);
            const totalPledgedHandle = parsedEvent.args.totalPledgedHandle;
            const goalReachedHandle = parsedEvent.args.goalReachedHandle;

            console.log('📦 Handles to decrypt:', {
                totalPledgedHandle,
                goalReachedHandle
            });

            // Step 2: Off-chain decryption
            setStatus('🔓 Decrypting values off-chain (calling Zama relayer)...');
            const results = await publicDecryptMultiple([
                totalPledgedHandle,
                goalReachedHandle
            ]);

            console.log('✅ Decryption results:', results);

            // Step 3: On-chain verification
            setStatus('✍️ Submitting decryption proof...');
            const callbackTx = await contract.callbackDecryptCampaignResult(
                campaign.id,
                results.abiEncodedClearValues,
                results.decryptionProof
            );

            setStatus('⏳ Verifying proof on-chain...');
            await callbackTx.wait();

            setStatus('✅ Decryption complete!');
            setTimeout(() => {
                setStatus('');
                if (onUpdate) onUpdate();
            }, 2000);

        } catch (error) {
            console.error('Decryption failed:', error);
            setStatus(`❌ Failed: ${error.message?.substring(0, 60) || 'Unknown error'}`);
            setTimeout(() => setStatus(''), 5000);
        } finally {
            setLoading(false);
        }
    };

    // Don't show section if not owner or before deadline
    if (!isOwner || !isExpired) {
        return null;
    }

    return (
        <div className="detail-section" style={{ marginTop: '20px' }}>
            <h3>🔓 Campaign Results</h3>

            {/* Status Messages */}
            {status && (
                <div className="alert alert-info" style={{ marginBottom: '15px' }}>
                    {status}
                </div>
            )}

            {/* Not Requested State */}
            {campaign.decryptionStatus === 'NotRequested' && canRequestDecryption && (
                <div>
                    <p style={{ marginBottom: '15px', color: '#666' }}>
                        🔒 Campaign results are encrypted. Reveal them publicly to show transparency.
                    </p>
                    <button
                        onClick={handleRequestDecryption}
                        className="btn-primary btn-large"
                        disabled={loading}
                    >
                        {loading ? '🔄 Processing...' : '🔍 Reveal Campaign Results'}
                    </button>
                    <p style={{ marginTop: '10px', fontSize: '0.9em', color: '#888' }}>
                        This will make total pledged and goal status public
                    </p>
                </div>
            )}

            {/* In Progress State */}
            {campaign.decryptionStatus === 'InProgress' && (
                <div className="privacy-notice">
                    <span className="privacy-icon">⏳</span>
                    <div>
                        <h4>Decryption In Progress</h4>
                        <p>Waiting for off-chain decryption to complete...</p>
                    </div>
                </div>
            )}

            {/* Completed State */}
            {campaign.decryptionStatus === 'Completed' && (
                <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    padding: '20px',
                    borderRadius: '12px',
                    color: 'white'
                }}>
                    <div style={{ marginBottom: '15px' }}>
                        <div style={{ fontSize: '0.9em', opacity: 0.9 }}>Total Pledged</div>
                        <div style={{ fontSize: '1.8em', fontWeight: 'bold' }}>
                            {(Number(campaign.decryptedTotalPledged) / 1e18).toFixed(4)} ETH
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9em', opacity: 0.9 }}>Goal Reached</div>
                        <div style={{ fontSize: '1.5em', fontWeight: 'bold' }}>
                            {campaign.goalReached ? '✅ Yes' : '❌ No'}
                        </div>
                    </div>
                    <p style={{ marginTop: '15px', fontSize: '0.85em', opacity: 0.8 }}>
                        📊 These values are now publicly visible to everyone
                    </p>
                </div>
            )}
        </div>
    );
}

export default DecryptionResults;
