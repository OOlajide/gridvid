import { createClientUPProvider } from "@lukso/up-provider";
import { ethers } from "ethers";

// LUKSO payment address (should be configurable via environment in a real app)
export const PAYMENT_ADDRESS = "0x742EF7A92e633465fC005c8D12F3B8C17A43AB4f";
// Payment amount in LYX
export const PAYMENT_AMOUNT = "5";

export interface UniversalProfile {
  provider: any;
  browserProvider: ethers.BrowserProvider;
  accounts: string[];
  contextAccounts: string[];
  chainId: number;
}

let upProvider: any = null;
let browserProvider: ethers.BrowserProvider | null = null;

export async function initializeUPProvider(): Promise<UniversalProfile> {
  try {
    // Create the UP provider if not already created
    if (!upProvider) {
      try {
        upProvider = createClientUPProvider();
      } catch (error) {
        console.warn("UP Provider not available. Using mock provider for development.", error);
        // Create a mock provider for development environment
        // This allows testing without a LUKSO extension
        upProvider = {
          request: async (args: { method: string }) => {
            if (args.method === "eth_accounts") return [];
            if (args.method === "eth_chainId") return "0x2a"; // LUKSO Mainnet
            if (args.method === "_isMockProvider") return true; // Special method to identify mock provider
            return null;
          },
          on: (event: string, callback: any) => {},
          emit: (event: string, data: any) => {},
          contextAccounts: []
        };
      }
      
      browserProvider = new ethers.BrowserProvider(upProvider as unknown as ethers.Eip1193Provider);
    }

    // Get accounts and chainId
    const accounts = await upProvider.request({ method: "eth_accounts" });
    const contextAccounts = upProvider.contextAccounts || [];
    const chainId = await upProvider.request({ method: "eth_chainId" });

    return {
      provider: upProvider,
      browserProvider: browserProvider as ethers.BrowserProvider,
      accounts,
      contextAccounts,
      chainId: parseInt(chainId, 16),
    };
  } catch (error) {
    console.error("Error initializing UP provider:", error);
    throw new Error("Failed to initialize UP provider. Make sure you have the LUKSO browser extension installed.");
  }
}

export async function makePayment(): Promise<string> {
  try {
    if (!upProvider || !browserProvider) {
      throw new Error("Provider not initialized");
    }

    // Check if we're in development mode with mock provider
    let isMockProvider = false;
    try {
      isMockProvider = await upProvider.request({ method: "_isMockProvider" });
    } catch (e) {
      // If error, it's not the mock provider
    }

    if (isMockProvider && import.meta.env.DEV) {
      // In development with mock provider, return a fake transaction hash
      console.log("Development mode: Simulating payment of 5 LYX");
      return "0x" + Array(64).fill("0").join("") + "dev";
    }

    const signer = await browserProvider.getSigner();
    const accounts = await upProvider.request({ method: "eth_accounts" });
    
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts available");
    }

    // Convert LYX to Wei (LYX has 18 decimals like ETH)
    const paymentAmountWei = ethers.parseEther(PAYMENT_AMOUNT);

    // Send transaction
    const tx = await signer.sendTransaction({
      to: PAYMENT_ADDRESS,
      value: paymentAmountWei,
    });

    // Notify that a transaction was sent (this is mainly for the channel to forward)
    upProvider.emit('sentTransaction', tx);

    // Wait for transaction to be mined
    const receipt = await tx.wait();
    return tx.hash;
  } catch (error) {
    console.error("Payment error:", error);
    throw error;
  }
}

export async function verifyPayment(transactionHash: string): Promise<boolean> {
  try {
    // Check if we're in development mode with a fake transaction hash
    if (import.meta.env.DEV && transactionHash.endsWith("dev")) {
      console.log("Development mode: Simulating payment verification");
      return true;
    }

    if (!browserProvider) {
      throw new Error("Provider not initialized");
    }

    // Get transaction receipt
    const receipt = await browserProvider.getTransactionReceipt(transactionHash);
    
    if (!receipt) {
      throw new Error("Transaction not found");
    }

    // Check if transaction was successful
    if (receipt.status !== 1) {
      throw new Error("Transaction failed");
    }

    // Verify correct payment amount and recipient
    const tx = await browserProvider.getTransaction(transactionHash);
    if (!tx) {
      throw new Error("Transaction details not found");
    }

    const txValue = ethers.formatEther(tx.value);
    const expectedValue = PAYMENT_AMOUNT;
    const recipient = tx.to?.toLowerCase();
    const expectedRecipient = PAYMENT_ADDRESS.toLowerCase();

    if (txValue !== expectedValue) {
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
