import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWorkflow } from "@/hooks/use-workflow";
import { 
  PAYMENT_ADDRESS, 
  DEFAULT_PAYMENT_AMOUNT, 
  TARGET_USD_AMOUNT,
  makePayment, 
  verifyPayment 
} from "@/lib/lukso";

export default function PaymentSection() {
  const { toast } = useToast();
  const { setStep, completePayment } = useWorkflow();
  const [isProcessing, setIsProcessing] = useState(false);
  const [lyxPrice, setLyxPrice] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>(DEFAULT_PAYMENT_AMOUNT);
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);
  const [transactionHash, setTransactionHash] = useState<string>("");
  const [storedPaymentAmount, setStoredPaymentAmount] = useState<string>("");
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [verificationAttempt, setVerificationAttempt] = useState(0);

  // Fetch current LYX price when component mounts
  useEffect(() => {
    const fetchLyxPrice = async () => {
      setIsLoadingPrice(true);
      try {
        const response = await fetch('/api/price/lyx');
        if (!response.ok) {
          throw new Error(`Failed to fetch LYX price: ${response.statusText}`);
        }
        
        const data = await response.json();
        setLyxPrice(data.price);
        
        // Calculate payment amount in LYX based on target USD amount
        if (data.price > 0) {
          const amount = TARGET_USD_AMOUNT / data.price;
          // Round to 2 decimal places
          const roundedAmount = Math.round(amount * 100) / 100;
          setPaymentAmount(roundedAmount.toString());
        }
      } catch (error) {
        console.error('Error fetching LYX price:', error);
        toast({
          title: "Price Info Unavailable",
          description: "Could not fetch current LYX price. Using default payment amount.",
          variant: "destructive",
        });
        // Use default amount if price fetch fails
        setPaymentAmount(DEFAULT_PAYMENT_AMOUNT);
      } finally {
        setIsLoadingPrice(false);
      }
    };
    
    fetchLyxPrice();
  }, [toast]);

  // Helper function to wait/sleep
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Function to retry verification with exponential backoff
  const verifyWithRetry = async (hash: string, amount: string, maxAttempts = 5): Promise<boolean> => {
    let attempts = 0;
    let lastError;
    
    while (attempts < maxAttempts) {
      try {
        // Wait longer between each attempt (exponential backoff)
        // 1st attempt: wait 2s, 2nd: 4s, 3rd: 8s, etc.
        const waitTime = Math.pow(2, attempts) * 1000;
        await sleep(waitTime);
        
        console.log(`Verification attempt ${attempts + 1}/${maxAttempts} for tx ${hash}`);
        const verified = await verifyPayment(hash, amount);
        
        if (verified) {
          return true;
        }
      } catch (error) {
        console.log(`Verification attempt ${attempts + 1} failed:`, error);
        lastError = error;
      }
      
      attempts++;
    }
    
    // If we got here, all attempts failed
    throw lastError || new Error("Transaction verification failed after multiple attempts");
  };

  // Function to manually verify a payment
  const handleVerifyPayment = async () => {
    if (!transactionHash || !storedPaymentAmount) {
      toast({
        title: "Verification Error",
        description: "Missing transaction information. Please try making the payment again.",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    setVerificationAttempt(prev => prev + 1);
    
    try {
      toast({
        title: "Verifying Payment",
        description: "Checking transaction confirmation...",
      });
      
      // Try to verify the transaction
      const verified = await verifyPayment(transactionHash, storedPaymentAmount);
      
      if (verified) {
        toast({
          title: "Payment Successful",
          description: `Your payment of ${storedPaymentAmount} LYX has been confirmed!`,
        });
        
        // Update workflow state
        completePayment();
        setStep('generation');
        
        // Reset verification state
        setAwaitingVerification(false);
        setTransactionHash("");
        setStoredPaymentAmount("");
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      
      if (verificationAttempt >= 4) {
        toast({
          title: "Verification Failed",
          description: "We couldn't verify your payment after multiple attempts. The transaction may have failed or is taking too long to process.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Verification Pending",
          description: "Your transaction is still being processed by the blockchain. Please wait a few more moments and try verifying again.",
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    
    try {
      // Initiate payment transaction
      toast({
        title: "Processing Payment",
        description: "Please confirm the transaction in your wallet...",
      });
      
      const result = await makePayment();
      
      // Store the payment amount and transaction hash for later verification if needed
      setStoredPaymentAmount(result.lyxAmount);
      setTransactionHash(result.hash);
      
      toast({
        title: "Transaction Sent",
        description: "Waiting for transaction confirmation (this may take 30+ seconds)...",
      });
      
      // Verify payment with retries
      const verified = await verifyWithRetry(result.hash, result.lyxAmount);
      
      if (verified) {
        toast({
          title: "Payment Successful",
          description: `Your payment of ${result.lyxAmount} LYX has been confirmed!`,
        });
        
        // Update workflow state
        completePayment();
        setStep('generation');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      
      // Handle different types of errors appropriately
      if (error.message && error.message.includes("Transaction not found")) {
        toast({
          title: "Payment Verification Pending",
          description: "Your transaction has been submitted but hasn't been confirmed by the network yet. Please wait a moment and click 'Verify Payment' when ready.",
        });
        
        // Show verification option instead of proceeding
        setAwaitingVerification(true);
      } else {
        toast({
          title: "Payment Failed",
          description: error.message || "Failed to process payment. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-surface p-6 rounded-lg shadow-lg gradient-border">
      <h2 className="font-display text-2xl font-semibold mb-4 flex items-center">
        <span className="material-icons text-primary mr-2">payments</span>
        Payment Required
      </h2>
      <p className="text-text-secondary mb-6">
        A payment of {isLoadingPrice ? "..." : paymentAmount} LYX is required to generate your video.
      </p>
      
      <div className="bg-background rounded-lg p-5 mb-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-text-secondary">Service Fee</span>
          <span className="font-medium">
            {isLoadingPrice ? (
              <span className="inline-block animate-pulse w-12 h-4 bg-gray-200 rounded"></span>
            ) : (
              <>{paymentAmount} LYX</>
            )}
          </span>
        </div>
        
        {lyxPrice && (
          <div className="flex justify-between items-center mb-3 text-sm">
            <span className="text-text-secondary">Equivalent to</span>
            <span className="text-secondary">${TARGET_USD_AMOUNT.toFixed(2)} USD</span>
          </div>
        )}
        
        {lyxPrice && (
          <div className="flex justify-between items-center mb-3 text-xs text-text-secondary">
            <span>Current LYX price</span>
            <span>${lyxPrice.toFixed(2)} USD</span>
          </div>
        )}
        
        <div className="flex justify-between items-center text-sm text-text-secondary">
          <span>Recipient Address</span>
          <code className="bg-background-lighter px-2 py-1 rounded text-xs">{PAYMENT_ADDRESS}</code>
        </div>
      </div>
      
      <div className="bg-background-lighter p-4 rounded-lg mb-6">
        <div className="flex items-start">
          <span className="material-icons text-secondary mr-2 mt-0.5">info</span>
          <div>
            <h4 className="font-medium mb-1">What's included</h4>
            <ul className="text-text-secondary text-sm space-y-1">
              <li className="flex items-center">
                <span className="material-icons text-accent text-xs mr-1">check_circle</span> 
                AI video generation
              </li>
              <li className="flex items-center">
                <span className="material-icons text-accent text-xs mr-1">check_circle</span> 
                IPFS storage
              </li>
              <li className="flex items-center">
                <span className="material-icons text-accent text-xs mr-1">check_circle</span> 
                Universal Profile metadata (optional)
              </li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="text-center">
        <Button
          onClick={handlePayment}
          disabled={isProcessing || isLoadingPrice}
          className="bg-primary hover:bg-opacity-90 text-white px-6 py-3 rounded font-semibold flex items-center mx-auto transition-all glow"
        >
          {isProcessing ? (
            <>
              <span className="material-icons mr-2 animate-spin">autorenew</span>
              Processing...
            </>
          ) : isLoadingPrice ? (
            <>
              <span className="material-icons mr-2 animate-spin">autorenew</span>
              Loading price...
            </>
          ) : (
            <>
              <span className="material-icons mr-2">credit_score</span>
              Pay {paymentAmount} LYX
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
