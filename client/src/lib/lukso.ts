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
      upProvider = createClientUPProvider();
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
    throw new Error("Failed to initialize UP provider");
  }
}

export async function makePayment(): Promise<string> {
  try {
    if (!upProvider || !browserProvider) {
      throw new Error("Provider not initialized");
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
