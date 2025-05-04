import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { provider } from "@/lib/lukso";
import { useWorkflow } from "@/hooks/use-workflow-context";
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
  
  // Helper to update connected status
  const updateConnected = useCallback(
    (_accounts: string[], _contextAccounts: string[]) => {
      setWalletConnected(_accounts.length > 0);
      
      if (_accounts.length > 0) {
        // Set short address for display
        const address = _accounts[0];
        setUserAddressShort(`${address.slice(0, 6)}...${address.slice(-4)}`);
      }

      // Check if we can proceed to prompt
      if (_accounts.length > 0 && _contextAccounts.length > 0) {
        setStep('prompt');
      }
    },
    [setWalletConnected, setStep]
  );
  
  const connectWallet = useCallback(async () => {
    try {
      toast({
        title: "Connecting Wallet",
        description: "Please approve the connection in your LUKSO Universal Profile extension.",
      });

      // This is the key part - actually request accounts from the provider
      // which triggers the extension popup
      const accounts = await provider.request({ 
        method: 'eth_requestAccounts' 
      }) as Array<`0x${string}`>;
      
      console.log("Connected accounts:", accounts);
      
      // Handle account changes
      const accountsChanged = (_accounts: string[]) => {
        setAllowedAccounts(_accounts);
        updateConnected(_accounts, contextAccounts);
      };

      const contextAccountsChanged = (_accounts: string[]) => {
        setContextAccounts(_accounts);
        updateConnected(allowedAccounts, _accounts);
      };

      // Add event listeners
      provider.on('accountsChanged', accountsChanged);
      provider.on('contextAccountsChanged', contextAccountsChanged);
      
      // Get context accounts
      const _contextAccounts = provider.contextAccounts || [];
      
      setAllowedAccounts(accounts);
      setContextAccounts(_contextAccounts);
      updateConnected(accounts, _contextAccounts);
        
      toast({
        title: "Wallet Connected",
        description: "Your Universal Profile is now connected!",
      });
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect Universal Profile",
        variant: "destructive",
      });
    }
  }, [allowedAccounts, contextAccounts, setAllowedAccounts, setContextAccounts, updateConnected, toast]);

  // Monitor for wallet changes when component mounts
  useEffect(() => {
    // Handle account changes
    const accountsChanged = (_accounts: string[]) => {
      setAllowedAccounts(_accounts);
      updateConnected(_accounts, contextAccounts);
    };

    const contextAccountsChanged = (_accounts: string[]) => {
      setContextAccounts(_accounts);
      updateConnected(allowedAccounts, _accounts);
    };

    // Check existing connections
    try {
      const _accounts = provider.accounts as Array<`0x${string}`>;
      const _contextAccounts = provider.contextAccounts;
      
      setAllowedAccounts(_accounts);
      setContextAccounts(_contextAccounts);
      updateConnected(_accounts, _contextAccounts);
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }

    // Set up event listeners
    provider.on('accountsChanged', accountsChanged);
    provider.on('contextAccountsChanged', contextAccountsChanged);

    // Cleanup listeners
    return () => {
      provider.removeListener('accountsChanged', accountsChanged);
      provider.removeListener('contextAccountsChanged', contextAccountsChanged);
    };
  }, [
    allowedAccounts, 
    contextAccounts, 
    setAllowedAccounts, 
    setContextAccounts, 
    updateConnected
  ]);

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
