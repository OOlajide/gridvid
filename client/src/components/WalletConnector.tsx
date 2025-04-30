import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { initializeUPProvider } from "@/lib/lukso";
import { useWorkflow } from "@/hooks/use-workflow";
import { useToast } from "@/hooks/use-toast";

interface WalletConnectorProps {
  buttonStyle?: "default" | "large";
}

export default function WalletConnector({ buttonStyle = "default" }: WalletConnectorProps) {
  const { toast } = useToast();
  const { 
    walletConnected,
    allowedAccounts,
    contextAccounts,
    setWalletConnected,
    setAllowedAccounts,
    setContextAccounts,
    setStep
  } = useWorkflow();
  
  const [userAddressShort, setUserAddressShort] = useState<string>("");
  const [isLuksoInstalled, setIsLuksoInstalled] = useState<boolean>(true);
  
  const connectWallet = useCallback(async () => {
    try {
      const up = await initializeUPProvider();
      
      // Check if we already have accounts available
      if (up.accounts.length > 0) {
        setAllowedAccounts(up.accounts);
        setContextAccounts(up.contextAccounts);
        setWalletConnected(true);
        setStep('payment');
        
        // Set short address for display
        if (up.accounts[0]) {
          const address = up.accounts[0];
          setUserAddressShort(`${address.slice(0, 6)}...${address.slice(-4)}`);
        }
        
        toast({
          title: "Wallet Connected",
          description: "Your Universal Profile has been connected successfully!",
        });
      } else {
        // If in development mode without LUKSO extension, allow bypassing the wallet connection
        if (import.meta.env.DEV) {
          // Check if we're using the mock provider (accounts will always be empty)
          let isMockProvider = false;
          try {
            // The real provider will throw an error for an invalid method
            await up.provider.request({ method: "_isMockProvider" });
            isMockProvider = true;
          } catch (e) {
            // If error, it might be a real provider
            isMockProvider = false;
          }
          
          if (isMockProvider) {
            setIsLuksoInstalled(false);
            toast({
              title: "Development Mode",
              description: "LUKSO extension not detected. You can continue without wallet connection in development mode.",
            });
            
            // In development, allow skipping the wallet connection
            setWalletConnected(true);
            setStep('payment');
            setUserAddressShort("0xDEV...MODE");
            return;
          }
        }
        
        // Setup event listeners if no accounts yet
        const accountsChanged = (accounts: string[]) => {
          setAllowedAccounts(accounts);
          setWalletConnected(accounts.length > 0);
          
          if (accounts.length > 0) {
            const address = accounts[0];
            setUserAddressShort(`${address.slice(0, 6)}...${address.slice(-4)}`);
            
            // If we also have context accounts, proceed to payment
            if (contextAccounts.length > 0) {
              setStep('payment');
            }
          }
        };

        const contextAccountsChanged = (accounts: string[]) => {
          setContextAccounts(accounts);
          
          // If we also have allowed accounts, proceed to payment
          if (allowedAccounts.length > 0 && accounts.length > 0) {
            setStep('payment');
          }
        };

        // Add event listeners
        up.provider.on('accountsChanged', accountsChanged);
        up.provider.on('contextAccountsChanged', contextAccountsChanged);
        
        toast({
          title: "Connecting Wallet",
          description: "Please approve the connection in your LUKSO Universal Profile extension.",
        });
      }
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      setIsLuksoInstalled(false);
      
      if (import.meta.env.DEV) {
        // In development, show helpful message and allow skipping wallet connection
        toast({
          title: "Development Mode",
          description: "LUKSO extension not detected. Development mode enabled - you can continue without wallet.",
        });
        setWalletConnected(true);
        setStep('payment');
        setUserAddressShort("0xDEV...MODE");
      } else {
        toast({
          title: "Connection Failed",
          description: "LUKSO Universal Profile extension not found. Please install it from the LUKSO website.",
          variant: "destructive",
        });
      }
    }
  }, [allowedAccounts, contextAccounts, setAllowedAccounts, setContextAccounts, setStep, setWalletConnected, toast]);

  // Monitor for wallet changes when component mounts
  useEffect(() => {
    // Try to initialize and check for existing connection
    const checkConnection = async () => {
      try {
        const up = await initializeUPProvider();
        
        if (up.accounts.length > 0) {
          setAllowedAccounts(up.accounts);
          setContextAccounts(up.contextAccounts);
          setWalletConnected(true);
          
          if (up.accounts[0]) {
            const address = up.accounts[0];
            setUserAddressShort(`${address.slice(0, 6)}...${address.slice(-4)}`);
          }
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    };
    
    checkConnection();
  }, [setAllowedAccounts, setContextAccounts, setWalletConnected]);

  return (
    <div>
      {!walletConnected ? (
        <Button 
          onClick={connectWallet}
          className={`bg-primary hover:bg-opacity-90 text-white flex items-center transition-all glow ${
            buttonStyle === "large" ? "px-6 py-3 text-base" : "px-4 py-2"
          }`}
        >
          <span className="material-icons mr-1">account_balance_wallet</span>
          Connect Universal Profile
        </Button>
      ) : (
        <div className="flex items-center">
          <span className="mr-2 text-text-secondary text-sm">{userAddressShort}</span>
          <div className="w-8 h-8 rounded-full bg-background-lighter border-2 border-primary flex items-center justify-center">
            <span className="material-icons text-sm">person</span>
          </div>
        </div>
      )}
    </div>
  );
}
