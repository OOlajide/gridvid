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

  const [transactionStatus, setTransactionStatus] = useState<string>("");
  const [pendingTransaction, setPendingTransaction] = useState<{hash: string, amount: string} | null>(null);
  
  // Function to poll blockchain for transaction confirmation
  const pollTransactionStatus = async (hash: string, amount: string) => {
    setTransactionStatus("Waiting for blockchain confirmation...");
    
    // Poll every 5 seconds to check transaction status
    const maxAttempts = 24; // Wait for up to 2 minutes (24 * 5 seconds)
    let attempts = 0;
    
    const poll = async () => {
      try {
        attempts++;
        setTransactionStatus(`Checking transaction status (attempt ${attempts}/${maxAttempts})...`);
        
        const verified = await verifyPayment(hash, amount);
        
        if (verified) {
          // Transaction confirmed!
          toast({
            title: "Payment Successful",
            description: `Your payment of ${amount} LYX has been confirmed!`,
          });
          
          // Clear pending transaction
          setPendingTransaction(null);
          setTransactionStatus("");
          setIsProcessing(false);
          
          // Update workflow state
          completePayment();
          setStep('generation');
          return true;
        }
      } catch (error: any) {
        console.log("Transaction not yet confirmed:", error.message);
        
        // If we've reached max attempts, give up
        if (attempts >= maxAttempts) {
          toast({
            title: "Verification Timeout",
            description: "Transaction sent but confirmation is taking too long. Please check the block explorer and try again later.",
            variant: "destructive"
          });
          
          // Reset the UI but don't allow proceeding
          setPendingTransaction(null);
          setTransactionStatus("");
          setIsProcessing(false);
          return true;
        }
        
        // Wait 5 seconds before trying again
        await new Promise(resolve => setTimeout(resolve, 5000));
        return poll();
      }
    };
    
    await poll();
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
      
      toast({
        title: "Transaction Sent",
        description: "Transaction submitted to blockchain. Waiting for confirmation...",
      });
      
      // Store the pending transaction
      setPendingTransaction({
        hash: result.hash,
        amount: result.lyxAmount
      });
      
      // Start polling for confirmation
      pollTransactionStatus(result.hash, result.lyxAmount);
      
      // Keep processing state true while waiting for confirmation
      // The UI will show the transaction status and blockchain explorer link
      // The user will not be able to proceed until confirmation is complete
      
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive",
      });
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
      
      {pendingTransaction ? (
        <div className="space-y-4">
          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center text-primary mb-2">
              <span className="material-icons mr-2 animate-spin">autorenew</span>
              <span className="font-medium">Transaction In Progress</span>
            </div>
            <p className="text-sm text-text-secondary mb-2">{transactionStatus}</p>
            <div className="text-xs">
              <a 
                href={`https://explorer.testnet.lukso.network/tx/${pendingTransaction.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                View transaction on block explorer
              </a>
            </div>
          </div>
          
          <div className="text-center space-y-3">
            <div className="bg-background-lighter p-3 rounded-lg text-sm text-text-secondary">
              <div className="flex items-center justify-center">
                <span className="material-icons mr-2 text-secondary text-xl">info</span>
                <span>Please wait for blockchain confirmation</span>
              </div>
              <p className="text-xs mt-1">
                The transaction must be confirmed on the blockchain before proceeding to video generation
              </p>
            </div>
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
