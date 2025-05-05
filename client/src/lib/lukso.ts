import { createClientUPProvider } from "@lukso/up-provider";
import { 
  createWalletClient, 
  createPublicClient, 
  custom, 
  http,
  formatEther,
  parseEther,
  PublicClient
} from "viem";
// Define the LUKSO testnet chain
const luksoTestnet = {
  id: 4201,
  name: 'LUKSO Testnet',
  network: 'lukso-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'LYX',
    symbol: 'LYX',
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.lukso.network'] },
    public: { http: ['https://rpc.testnet.lukso.network'] },
  },
  blockExplorers: {
    default: { name: 'LUKSO Testnet Explorer', url: 'https://explorer.testnet.lukso.network' },
  },
} as const;

// Import mainnet chain but using testnet by default
import { lukso } from "viem/chains";

// LUKSO payment address (should be configurable via environment in a real app)
export const PAYMENT_ADDRESS = "0x49A3E8389aF513d629A462bFfBc9D93B3536f088";
// Default payment amount in LYX (used as fallback if price fetch fails)
export const DEFAULT_PAYMENT_AMOUNT = "0.5";
// Target payment amount in USD
export const TARGET_USD_AMOUNT = 0.5;

export interface UniversalProfile {
  provider: any;
  walletClient: any;
  publicClient: PublicClient;
  accounts: Array<`0x${string}`>;
  contextAccounts: Array<`0x${string}`>;
  chainId: number;
}

// Create provider instance outside components
export const provider = createClientUPProvider();

// Create wallet client to connect to provider
export const walletClient = createWalletClient({
  chain: luksoTestnet,
  transport: custom(provider),
});

// Create public client for read operations
export const publicClient = createPublicClient({
  chain: luksoTestnet,
  transport: http(),
});

export async function initializeUPProvider(): Promise<UniversalProfile> {
  try {
    // Get accounts and chainId
    const accounts = provider.accounts as Array<`0x${string}`>;
    const contextAccounts = provider.contextAccounts || [];
    const chainId = await provider.request({ method: "eth_chainId" });

    return {
      provider,
      walletClient,
      publicClient,
      accounts,
      contextAccounts,
      chainId: parseInt(chainId as string, 16),
    };
  } catch (error) {
    console.error("Error initializing UP provider:", error);
    throw new Error("Failed to initialize UP provider");
  }
}

// Function to fetch LYX price from our API
async function fetchLYXPrice(): Promise<number> {
  try {
    const response = await fetch('/api/price/lyx');
    if (!response.ok) {
      throw new Error(`Failed to fetch LYX price: ${response.statusText}`);
    }
    const data = await response.json();
    return data.price;
  } catch (error) {
    console.error('Error fetching LYX price:', error);
    throw error;
  }
}

// Function to calculate LYX amount based on USD target
function calculateLYXAmount(lyxPriceUSD: number): string {
  // Calculate how much LYX is needed for TARGET_USD_AMOUNT
  const lyxAmount = TARGET_USD_AMOUNT / lyxPriceUSD;
  
  // Round to 2 decimal places
  const roundedAmount = Math.round(lyxAmount * 100) / 100;
  
  return roundedAmount.toString();
}

export async function makePayment(): Promise<{hash: string, lyxAmount: string, lyxPrice: number}> {
  try {
    const accounts = provider.accounts as Array<`0x${string}`>;
    
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts available");
    }

    // Fetch current LYX price in USD
    let lyxPrice: number;
    let paymentAmount: string;
    
    try {
      lyxPrice = await fetchLYXPrice();
      paymentAmount = calculateLYXAmount(lyxPrice);
      console.log(`Current LYX price: $${lyxPrice}, Payment amount: ${paymentAmount} LYX`);
    } catch (error) {
      console.warn("Failed to fetch LYX price, using default amount:", error);
      lyxPrice = 0; // Unknown price
      paymentAmount = DEFAULT_PAYMENT_AMOUNT;
    }

    // Convert LYX to Wei (LYX has 18 decimals like ETH)
    const paymentAmountWei = parseEther(paymentAmount);

    // Send transaction
    const hash = await walletClient.sendTransaction({
      account: accounts[0],
      to: PAYMENT_ADDRESS as `0x${string}`,
      value: paymentAmountWei,
    });

    // Log the transaction hash
    console.log("Transaction sent:", hash);

    return {
      hash,
      lyxAmount: paymentAmount,
      lyxPrice
    };
  } catch (error) {
    console.error("Payment error:", error);
    throw error;
  }
}

export async function verifyPayment(
  transactionHash: string, 
  expectedAmount?: string
): Promise<boolean> {
  try {
    if (!publicClient) {
      throw new Error("Provider not initialized");
    }

    // Simple hack: directly check the explorer API first to see if the transaction exists
    try {
      const explorerUrl = `https://explorer.execution.testnet.lukso.network/api/v2/transactions/${transactionHash}`;
      const response = await fetch(explorerUrl);
      if (response.ok) {
        // If we can find the transaction in the explorer, it's confirmed!
        console.log("Transaction found via explorer API!");
        return true;
      }
    } catch (explorerError) {
      console.log("Explorer API check failed, falling back to RPC:", explorerError);
      // Continue with normal verification if explorer check fails
    }

    // Get transaction receipt from RPC
    const receipt = await publicClient.getTransactionReceipt({
      hash: transactionHash as `0x${string}`,
    });
    
    if (!receipt) {
      throw new Error("Transaction not found or not yet confirmed");
    }

    // Check if transaction was successful
    if (receipt.status !== 'success') {
      throw new Error("Transaction failed");
    }

    // Verify correct recipient
    const tx = await publicClient.getTransaction({
      hash: transactionHash as `0x${string}`,
    });
    
    if (!tx) {
      throw new Error("Transaction details not found");
    }
    
    if (!tx.to) {
      throw new Error("Transaction recipient is missing");
    }
    
    const recipient = tx.to.toLowerCase();
    const expectedRecipient = PAYMENT_ADDRESS.toLowerCase();

    if (recipient !== expectedRecipient) {
      throw new Error(`Incorrect payment recipient: ${recipient}, expected: ${expectedRecipient}`);
    }

    // If an expected amount was provided, verify the payment amount
    if (expectedAmount) {
      const txValue = formatEther(tx.value);
      
      // Using approximate comparison to handle floating point precision issues
      const txValueFloat = parseFloat(txValue);
      const expectedValueFloat = parseFloat(expectedAmount);
      
      // Allow for a small margin of error (0.01 LYX)
      if (Math.abs(txValueFloat - expectedValueFloat) > 0.01) {
        throw new Error(`Incorrect payment amount: ${txValue} LYX, expected: ${expectedAmount} LYX`);
      }
    }

    // All checks passed
    return true;
    
  } catch (error: any) {
    // If the error is that the transaction is not found or not confirmed yet, 
    // we want to propagate that specific error to allow polling
    if (error.message?.includes("not found") || 
        error.message?.includes("not yet confirmed") ||
        error.message?.includes("could not be found")) {
      throw new Error(`Transaction not yet confirmed: ${error.message}`);
    }
    
    console.error("Payment verification error:", error);
    throw error;
  }
}

// LSP specific functions to store metadata on Universal Profile
export async function storeLSPMetadata(videoData: {
  ipfsCid: string;
  gatewayUrl: string;
  prompt: string;
  aspectRatio?: string;
  generationType?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    console.log("Storing metadata in Universal Profile:", videoData);
    
    // Prepare LSP metadata with IPFS links
    const lspMetadata = {
      ...videoData,
      ipfsGateway: videoData.gatewayUrl.includes('/ipfs/') 
        ? videoData.gatewayUrl.split('/ipfs/')[0]
        : 'https://orange-imaginative-hawk-931.mypinata.cloud',
      timestamp: Date.now(),
      storageType: 'ipfs',
      description: `AI-generated video from prompt: ${videoData.prompt.substring(0, 100)}${videoData.prompt.length > 100 ? '...' : ''}`,
      contentType: 'video/mp4'
    };
    
    // Make an API call to store metadata on LSP
    const response = await fetch("/api/lsp/store", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(lspMetadata),
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json()
        .catch(() => ({ message: "Unknown error when storing LSP metadata" }));
      throw new Error(errorData.message || `LSP storage failed: HTTP ${response.status}`);
    }
    
    // Log success response
    const result = await response.json();
    console.log("LSP storage success:", result);
    
    return result;
  } catch (error) {
    console.error("LSP storage error:", error);
    throw error;
  }
}
