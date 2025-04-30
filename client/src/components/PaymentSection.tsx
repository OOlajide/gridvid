import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWorkflow } from "@/hooks/use-workflow";
import { PAYMENT_ADDRESS, PAYMENT_AMOUNT, makePayment, verifyPayment } from "@/lib/lukso";

export default function PaymentSection() {
  const { toast } = useToast();
  const { setStep, completePayment } = useWorkflow();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    setIsProcessing(true);
    
    try {
      // Initiate payment transaction
      toast({
        title: "Processing Payment",
        description: "Please confirm the transaction in your wallet...",
      });
      
      const txHash = await makePayment();
      
      toast({
        title: "Transaction Sent",
        description: "Waiting for transaction confirmation...",
      });
      
      // Verify payment was successful
      const verified = await verifyPayment(txHash);
      
      if (verified) {
        toast({
          title: "Payment Successful",
          description: `Your payment of ${PAYMENT_AMOUNT} LYX has been confirmed!`,
        });
        
        // Update workflow state
        completePayment();
        setStep('generation');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive",
      });
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
      <p className="text-text-secondary mb-6">A payment of {PAYMENT_AMOUNT} LYX is required to generate your video.</p>
      
      <div className="bg-background rounded-lg p-5 mb-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-text-secondary">Service Fee</span>
          <span className="font-medium">{PAYMENT_AMOUNT} LYX</span>
        </div>
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
          disabled={isProcessing}
          className="bg-primary hover:bg-opacity-90 text-white px-6 py-3 rounded font-semibold flex items-center mx-auto transition-all glow"
        >
          {isProcessing ? (
            <>
              <span className="material-icons mr-2 animate-spin">autorenew</span>
              Processing...
            </>
          ) : (
            <>
              <span className="material-icons mr-2">credit_score</span>
              Pay {PAYMENT_AMOUNT} LYX
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
