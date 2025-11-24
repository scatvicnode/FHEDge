// This loads the ES Module version (.js) instead of UMD (.umd.cjs)

// ============ TYPES AND CONSTANTS ============
interface FheConfig {
  network: any;
  keypair: any;
  relayerUrl: string;
}

interface Keypair {
  publicKey: string;
  privateKey: string;
}

// Constants
const SEPOLIA_CHAIN_ID = '0xaa36a7';
const RELAYER_URL = 'https://relayer.testnet.zama.org';
const KEYPAIR_STORAGE_KEY = 'fhevm_keypair';

// ============ MODULE STATE ============
let fheInstance: any = null;

// ============ ERROR MESSAGES ============
const ErrorMessages = {
  NO_ETHEREUM: 'Ethereum provider not found. Please install MetaMask or connect a wallet.',
  NO_SDK: 'RelayerSDK not loaded. Make sure index.html includes the correct script tag.',
  INCOMPLETE_SDK: 'SDK exports incomplete. Check SDK version.',
  WASM_FAILED: 'Failed to load WASM module. This may be a browser compatibility issue or network problem.',
  INSTANCE_FAILED: 'Failed to create FHE instance. Please ensure you are connected to Sepolia testnet.',
  NOT_INITIALIZED: 'FHE instance not initialized. Call initializeFheInstance() first.',
  INVALID_CIPHERTEXT: 'Invalid ciphertext handle format. Expected 0x-prefixed 32-byte hex string.',
  DECRYPTION_UNAVAILABLE: 'Decryption service temporarily unavailable. Please try again later.',
  SEPOLIA_DOWN: 'FHE system contracts on Sepolia are not responding. Check Zama Discord for testnet status.',
} as const;

// ============ NETWORK UTILITIES ============
class NetworkUtils {
  static async getCurrentChainId(): Promise<string> {
    return await window.ethereum.request({ method: 'eth_chainId' });
  }

  static isSepoliaNetwork(chainId: string): boolean {
    return chainId === SEPOLIA_CHAIN_ID;
  }

  static async validateNetwork(): Promise<void> {
    try {
      const chainId = await this.getCurrentChainId();
      console.log('🌐 Blockchain Network:', chainId === '0xaa36a7' ? 'Sepolia Testnet' : `Chain ID ${chainId}`);

      if (!this.isSepoliaNetwork(chainId)) {
        console.warn('⚠️  Not on Sepolia testnet. Current chain:', chainId);
      }
    } catch (error) {
      console.warn('⚠️  Could not verify chain ID:', error);
    }
  }
}

// ============ KEYPAIR MANAGEMENT ============
class KeypairManager {
  static generateKeypair(sdk: any): Keypair {
    return sdk.generateKeypair();
  }

  static loadStoredKeypair(): Keypair | null {
    try {
      const stored = localStorage.getItem(KEYPAIR_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  static storeKeypair(keypair: Keypair): void {
    localStorage.setItem(KEYPAIR_STORAGE_KEY, JSON.stringify(keypair));
  }

  static getOrCreateKeypair(sdk: any): Keypair {
    const stored = this.loadStoredKeypair();

    if (stored) {
      console.log('🔐 FHE Keypair: Loaded from local storage');
      return stored;
    }

    console.log('🔑 FHE Keypair: Generating new cryptographic keys...');
    const keypair = this.generateKeypair(sdk);
    this.storeKeypair(keypair);
    console.log('✅ FHE Keypair: Generated and saved to local storage');

    return keypair;
  }
}

// ============ SDK VALIDATION ============
class SdkValidator {
  static validateGlobalSdk(): any {
    const sdk = window.RelayerSDK || window.relayerSDK;

    if (!sdk) {
      console.error('❌ window.RelayerSDK not found!');
      console.error('Available window properties:',
        Object.keys(window).filter(k => k.toLowerCase().includes('relay'))
      );
      throw new Error(ErrorMessages.NO_SDK);
    }

    return sdk;
  }

  static validateSdkExports(sdk: any): void {
    const { initSDK, createInstance, SepoliaConfig } = sdk;

    if (!initSDK || !createInstance || !SepoliaConfig) {
      console.error('❌ Missing exports!', {
        hasInitSDK: !!initSDK,
        hasCreateInstance: !!createInstance,
        hasSepoliaConfig: !!SepoliaConfig
      });
      throw new Error(ErrorMessages.INCOMPLETE_SDK);
    }
  }
}

// ============ INITIALIZATION CORE ============
class FheInitializer {
  static async initializeWasm(sdk: any): Promise<void> {
    console.log('⚙️  FHEVM SDK: Initializing WebAssembly modules...');

    try {
      await sdk.initSDK();
      console.log('✅ FHEVM SDK: Ready (WASM modules loaded)');
    } catch (error) {
      console.error('❌ WASM initialization failed:', error);
      throw new Error(ErrorMessages.WASM_FAILED);
    }
  }

  static createConfig(sdk: any, keypair: Keypair): FheConfig {
    return {
      ...sdk.SepoliaConfig,
      network: window.ethereum,
      keypair,
      relayerUrl: RELAYER_URL
    };
  }

  static async createFheInstance(sdk: any, config: FheConfig): Promise<any> {

    try {
      const instance = await sdk.createInstance(config);
      console.log('✅ FHEVM Instance: Connected to Zama network relayer');
      return instance;
    } catch (error) {
      console.error('❌ Failed to create FHE instance:', error);
      throw new Error(ErrorMessages.INSTANCE_FAILED);
    }
  }
}

// ============ ERROR HANDLING ============
class ErrorHandler {
  static handleInitializationError(error: any): never {
    console.error('❌ FHEVM initialization failed:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack?.substring(0, 200)
    });

    const enhancedError = this.enhanceErrorMessage(error);
    throw enhancedError;
  }

  private static enhanceErrorMessage(error: any): Error {
    const message = error?.message || '';

    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      return new Error('Failed to load FHE SDK from CDN. Check your internet connection and try again.');
    }

    if (message.includes('missing revert data') || message.includes('KMS')) {
      return new Error(ErrorMessages.SEPOLIA_DOWN);
    }

    if (message.includes('network')) {
      return new Error('Network configuration error. Make sure MetaMask is connected to Sepolia testnet (Chain ID: 11155111).');
    }

    return error;
  }
}

// ============ MAIN EXPORTS ============
export async function initializeFheInstance(): Promise<any> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error(ErrorMessages.NO_ETHEREUM);
  }

  try {
    // Validate and get SDK
    const sdk = SdkValidator.validateGlobalSdk();
    SdkValidator.validateSdkExports(sdk);

    // Initialize core components
    await FheInitializer.initializeWasm(sdk);
    await NetworkUtils.validateNetwork();

    const keypair = KeypairManager.getOrCreateKeypair(sdk);
    const config = FheInitializer.createConfig(sdk, keypair);

    fheInstance = await FheInitializer.createFheInstance(sdk, config);
    return fheInstance;

  } catch (error) {
    return ErrorHandler.handleInitializationError(error);
  }
}

export function getFheInstance(): any {
  if (!fheInstance) {
    throw new Error(ErrorMessages.NOT_INITIALIZED);
  }
  return fheInstance;
}

/**
 * Public decryption for multiple handles (Step 2 of 3-step workflow)
 * Used in campaign result decryption to get cleartext values + proof
 * @param handles Array of ciphertext handles (bytes32) to decrypt
 * @returns Object with clearValues, abiEncodedClearValues, and decryptionProof
 */
export async function publicDecryptMultiple(handles: string[]): Promise<{
  clearValues: Record<string, bigint | boolean | string>;
  abiEncodedClearValues: string;
  decryptionProof: string;
}> {
  const fhe = getFheInstance();

  // Validate all handles
  handles.forEach(handle => {
    validateCiphertext(handle);
  });

  try {
    console.log('🔓 Public Decryption: Sending request to Zama KMS for', handles.length, 'encrypted values');
    const results = await fhe.publicDecrypt(handles);
    console.log('✅ Public Decryption: Values decrypted with cryptographic proof');
    return results;
  } catch (error: any) {
    console.error('❌ Public decryption failed:', error);
    throw handleDecryptionError(error);
  }
}

/**
 * User decryption for viewing own encrypted data
 * @param handle Ciphertext handle to decrypt
 * @param contractAddress Contract address that owns the ciphertext
 * @param userAddress User address requesting decryption
 * @returns Decrypted value as bigint
 */
export async function userDecryptValue(
  handle: string,
  contractAddress: string,
  userAddress: string
): Promise<bigint> {
  const fhe = getFheInstance();
  validateCiphertext(handle);

  try {
    console.log('🔓 User Decryption: Requesting private value from encrypted handle');
    const result = await fhe.userDecrypt(handle, contractAddress, userAddress);
    console.log('✅ User Decryption: Value decrypted successfully');
    return BigInt(result);
  } catch (error: any) {
    console.error('❌ User decryption failed:', error);
    throw handleDecryptionError(error);
  }
}

// ============ DECRYPTION UTILITIES ============
function validateCiphertext(encryptedBytes: string): void {
  if (typeof encryptedBytes !== "string" ||
    !encryptedBytes.startsWith("0x") ||
    encryptedBytes.length !== 66) {
    throw new Error(ErrorMessages.INVALID_CIPHERTEXT);
  }
}

function handleDecryptionError(error: any): Error {
  const message = error?.message || '';

  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return new Error(ErrorMessages.DECRYPTION_UNAVAILABLE);
  }

  return error;
}