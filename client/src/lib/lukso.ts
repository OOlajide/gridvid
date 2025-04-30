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
import { lukso } from "viem/chains";

// LUKSO payment address (should be configurable via environment in a real app)
export const PAYMENT_ADDRESS = "0x742EF7A92e633465fC005c8D12F3B8C17A43AB4f";
// Payment amount in LYX
export const PAYMENT_AMOUNT = "5";

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
  chain: lukso,
  transport: custom(provider),
});

// Create public client for read operations
export const publicClient = createPublicClient({
  chain: lukso,
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

export async function makePayment(): Promise<string> {
  try {
    const accounts = provider.accounts as Array<`0x${string}`>;
    
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts available");
    }

    // Convert LYX to Wei (LYX has 18 decimals like ETH)
    const paymentAmountWei = parseEther(PAYMENT_AMOUNT);

    // Send transaction
    const hash = await walletClient.sendTransaction({
      account: accounts[0],
      to: PAYMENT_ADDRESS as `0x${string}`,
      value: paymentAmountWei,
    });

    // Log the transaction hash
    console.log("Transaction sent:", hash);

    return hash;
  } catch (error) {
    console.error("Payment error:", error);
    throw error;
  }
}

export async function verifyPayment(transactionHash: string): Promise<boolean> {
  try {
    if (!publicClient) {
      throw new Error("Provider not initialized");
    }

    // Get transaction receipt
    const receipt = await publicClient.getTransactionReceipt({
      hash: transactionHash as `0x${string}`,
    });
    
    if (!receipt) {
      throw new Error("Transaction not found");
    }

    // Check if transaction was successful
    if (receipt.status !== 'success') {
      throw new Error("Transaction failed");
    }

    // Verify correct payment amount and recipient
    const tx = await publicClient.getTransaction({
      hash: transactionHash as `0x${string}`,
    });
    
    if (!tx) {
      throw new Error("Transaction details not found");
    }

    const txValue = formatEther(tx.value);
    const expectedValue = PAYMENT_AMOUNT;
    
    if (!tx.to) {
      throw new Error("Transaction recipient is missing");
    }
    
    const recipient = tx.to.toLowerCase();
    const expectedRecipient = PAYMENT_ADDRESS.toLowerCase();

    if (parseFloat(txValue) !== parseFloat(expectedValue)) {
      throw new Error(`Incorrect payment amount: ${txValue} LYX, expected: ${expectedValue} LYX`);
    }

    if (recipient !== expectedRecipient) {
      throw new Error(`Incorrect payment recipient: ${recipient}, expected: ${expectedRecipient}`);
    }

    return true;
  } catch (error) {
    console.error("Payment verification error:", error);
    throw error;
  }
}

// LSP specific functions to store metadata on Universal Profile
export async function storeLSPMetadata(videoData: {
  ipfsCid: string;
  gatewayUrl: string;
  prompt: string;
}): Promise<void> {
  try {
    // Make an API call to store metadata on LSP
    const response = await fetch("/api/lsp/store", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(videoData),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LSP storage failed: ${error}`);
    }
  } catch (error) {
    console.error("LSP storage error:", error);
    throw error;
  }
}
