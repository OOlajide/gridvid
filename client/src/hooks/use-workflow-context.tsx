import { createContext, useState, useCallback, useContext, ReactNode } from "react";
import { Video, GenerateVideoRequest } from "@shared/schema";
import { useToast } from "./use-toast";
import { apiRequest } from "@/lib/queryClient";

// Workflow step types
type WorkflowStep = 'connect' | 'prompt' | 'payment' | 'processing' | 'result';

// Processing stages for video generation
interface ProcessingStage {
  id: string;
  label: string;
}

interface WorkflowContextProps {
  currentStep: WorkflowStep;
  walletConnected: boolean;
  paymentComplete: boolean;
  isProcessing: boolean;
  hasResult: boolean;
  allowedAccounts: string[];
  contextAccounts: string[];
  videoResult: Video | null;
  processingStatus: string;
  currentStageIndex: number;
  generationId: string | null;
  generationParams: GenerateVideoRequest | null;
  setStep: (step: WorkflowStep) => void;
  setWalletConnected: (connected: boolean) => void;
  setAllowedAccounts: (accounts: string[]) => void;
  setContextAccounts: (accounts: string[]) => void;
  completePayment: () => void;
  setGenerationParams: (params: GenerateVideoRequest) => void;
  startVideoGeneration: (params: GenerateVideoRequest) => Promise<void>;
  pollGenerationStatus: () => Promise<boolean>;
}

const WorkflowContext = createContext<WorkflowContextProps | null>(null);

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Workflow state
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('connect');
  const [walletConnected, setWalletConnected] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [allowedAccounts, setAllowedAccounts] = useState<string[]>([]);
  const [contextAccounts, setContextAccounts] = useState<string[]>([]);
  
  // Video generation state
  const [videoResult, setVideoResult] = useState<Video | null>(null);
  const [processingStatus, setProcessingStatus] = useState("Creating your amazing video. This typically takes 1 minute.");
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [generationParams, setGenerationParams] = useState<GenerateVideoRequest | null>(null);
  
  const handleSetStep = useCallback((step: WorkflowStep) => {
    setCurrentStep(step);
  }, []);
  
  const completePayment = useCallback(() => {
    setPaymentComplete(true);
  }, []);
  
  const startVideoGeneration = useCallback(async (params: GenerateVideoRequest) => {
    try {
      setIsProcessing(true);
      
      // Start video generation process
      const response = await apiRequest("POST", "/api/videos/generate", params);
      const data = await response.json();
      
      setGenerationId(data.generationId);
      setCurrentStageIndex(0);
    } catch (error: any) {
      console.error("Video generation error:", error);
      setIsProcessing(false);
      throw error;
    }
  }, []);
  
  const pollGenerationStatus = useCallback(async () => {
    if (!generationId) return false;
    
    try {
      const response = await fetch(`/api/videos/status?id=${generationId}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to get generation status");
      }
      
      const data = await response.json();
      
      // Update processing status
      setProcessingStatus(data.status);
      setCurrentStageIndex(data.stageIndex);
      
      // Check if generation is complete
      if (data.complete && data.video) {
        setVideoResult(data.video);
        setHasResult(true);
        setIsProcessing(false);
        handleSetStep('result');
        
        toast({
          title: "Video Generated!",
          description: "Your AI-powered video has been successfully created.",
        });
        
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error("Error polling generation status:", error);
      throw error;
    }
  }, [generationId, handleSetStep, toast]);
  
  return (
    <WorkflowContext.Provider 
      value={{
        currentStep,
        walletConnected,
        paymentComplete,
        isProcessing,
        hasResult,
        allowedAccounts,
        contextAccounts,
        videoResult,
        processingStatus,
        currentStageIndex,
        generationId,
        generationParams,
        setStep: handleSetStep,
        setWalletConnected,
        setAllowedAccounts,
        setContextAccounts,
        completePayment,
        setGenerationParams,
        startVideoGeneration,
        pollGenerationStatus,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useWorkflow must be used within a WorkflowProvider");
  }
  return context;
}