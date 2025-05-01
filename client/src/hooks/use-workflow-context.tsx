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
  const [generationParams, setGenerationParamsState] = useState<GenerateVideoRequest | null>(null);
  
  // Wrap setGenerationParams to track changes
  const setGenerationParams = useCallback((params: GenerateVideoRequest) => {
    console.log("Setting generation params:", params);
    setGenerationParamsState(params);
  }, []);
  
  const handleSetStep = useCallback((step: WorkflowStep) => {
    setCurrentStep(step);
  }, []);
  
  const completePayment = useCallback(() => {
    setPaymentComplete(true);
  }, []);
  
  const startVideoGeneration = useCallback(async (params: GenerateVideoRequest) => {
    try {
      setIsProcessing(true);
      
      // Log the parameters we're sending to help debug
      console.log("Starting video generation with params:", params);
      
      // Make sure we have a clean object with only the required fields
      const cleanParams = {
        prompt: params.prompt,
        aspectRatio: params.aspectRatio,
        generationType: params.generationType,
        // Only include imageBase64 if it exists and is for image-to-video
        ...(params.imageBase64 && params.generationType === 'image' ? { imageBase64: params.imageBase64 } : {})
      };
      
      console.log("Sending cleaned parameters to API:", cleanParams);
      
      // Start video generation process
      const response = await apiRequest("POST", "/api/videos/generate", cleanParams);
      const data = await response.json();
      
      console.log("Generation response:", data);
      
      if (data.generationId) {
        setGenerationId(data.generationId);
        setCurrentStageIndex(0);
        return data.generationId;
      } else {
        throw new Error("No generation ID returned from server");
      }
    } catch (error: any) {
      console.error("Video generation error:", error);
      toast({
        title: "Video Generation Failed",
        description: error.message || "Failed to start video generation",
        variant: "destructive"
      });
      setIsProcessing(false);
      throw error;
    }
  }, [toast]);
  
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