import { useState, useCallback } from "react";
import { useToast } from "./use-toast";

export interface LSPMetadata {
  type: string;
  name: string;
  description: string;
  links: Array<{ title: string; url: string }>;
  assets: Array<{ hash: string; url: string; fileType: string }>;
  attachments: Array<{ hash: string; url: string; fileType: string; name: string }>;
}

export function useLSP() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Store metadata in LSP1 format for Universal Profile
  const storeMetadata = useCallback(async (
    address: string,
    metadata: LSPMetadata
  ): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const response = await fetch("/api/lsp/metadata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address,
          metadata,
        }),
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LSP storage failed: ${error}`);
      }
      
      return true;
    } catch (error: any) {
      console.error("Error storing LSP metadata:", error);
      toast({
        title: "LSP Storage Failed",
        description: error.message || "Failed to store metadata in Universal Profile",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  // Mint video as LSP7 NFT
  const mintAsLSP7 = useCallback(async (
    address: string,
    videoMetadata: {
      name: string;
      description: string;
      ipfsCid: string;
      gatewayUrl: string;
    }
  ): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const response = await fetch("/api/lsp/mint-lsp7", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address,
          videoMetadata,
        }),
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LSP7 minting failed: ${error}`);
      }
      
      return true;
    } catch (error: any) {
      console.error("Error minting LSP7:", error);
      toast({
        title: "NFT Minting Failed",
        description: error.message || "Failed to mint video as LSP7 NFT",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  return {
    isLoading,
    storeMetadata,
    mintAsLSP7,
  };
}
