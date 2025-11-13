// NOTE: Using dynamic import like BeliefMarket for better compatibility
// This loads the ES Module version (.js) instead of UMD (.umd.cjs)

let fheInstance: any = null;

/**
 * Initialize FHEVM instance using dynamic import
 * This matches the working BeliefMarket implementation
 */
export async function initializeFheInstance() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('Ethereum provider not found. Please install MetaMask or connect a wallet.');
  }

  try {
    console.log('🔐 Loading FHE SDK from CDN (ES Module)...');
    
    // Dynamic import - loads ES Module version (like BeliefMarket)
    const sdk: any = await import('https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.js');
    
    console.log('✅ SDK loaded, extracting exports...');
    const { initSDK, createInstance, SepoliaConfig } = sdk;

    console.log('⚙️  Initializing SDK (loading WASM)...');
    await initSDK(); // Loads WASM
    console.log('✅ WASM loaded successfully');
    
    // Use SepoliaConfig with EIP1193 provider
    const config = { ...SepoliaConfig, network: window.ethereum };
    console.log('📋 Config created:', {
      chainId: config.chainId,
      hasNetwork: !!config.network,
      contractAddresses: {
        acl: config.aclContractAddress?.substring(0, 10) + '...',
        kms: config.kmsContractAddress?.substring(0, 10) + '...',
      }
    });
    
    console.log('🏗️  Creating FHE instance...');
    fheInstance = await createInstance(config);
    console.log('✅ FHE Instance created successfully!');
    
    return fheInstance;
  } catch (err: any) {
    console.error('❌ FHEVM initialization failed:', err);
    console.error('Error details:', {
      message: err?.message,
      code: err?.code,
      stack: err?.stack?.substring(0, 200)
    });
    
    // Provide helpful error messages
    if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
      throw new Error('Failed to load FHE SDK from CDN. Check your internet connection and try again.');
    }
    
    if (err?.message?.includes('missing revert data') || err?.message?.includes('KMS')) {
      throw new Error('FHE system contracts on Sepolia are not responding. This is a known issue - Zama\'s Sepolia testnet may be down or moved. Try: 1) Check Zama Discord for testnet status, 2) Use local devnet with Docker, 3) Wait and retry later.');
    }
    
    if (err?.message?.includes('network')) {
      throw new Error('Network configuration error. Make sure MetaMask is connected to Sepolia testnet (Chain ID: 11155111).');
    }
    
    throw err;
  }
}

export function getFheInstance() {
  if (!fheInstance) {
    throw new Error('FHE instance not initialized. Call initializeFheInstance() first.');
  }
  return fheInstance;
}

// Decrypt a single encrypted value using the relayer
export async function decryptValue(encryptedBytes: string): Promise<number> {
  const fhe = getFheInstance();
  
  try {
    // Validate input
    if (typeof encryptedBytes !== "string" || !encryptedBytes.startsWith("0x") || encryptedBytes.length !== 66) {
      throw new Error('Invalid ciphertext handle format. Expected 0x-prefixed 32-byte hex string.');
    }
    
    // Decrypt using relayer
    const values = await fhe.publicDecrypt([encryptedBytes]);
    
    // Return decrypted value
    return Number(values[encryptedBytes]);
  } catch (error: any) {
    console.error('Decryption failed:', error);
    
    if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
      throw new Error('Decryption service temporarily unavailable. Please try again later.');
    }
    
    throw error;
  }
}
