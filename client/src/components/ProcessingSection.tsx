import { useState, useEffect } from "react";
import { useWorkflow } from "@/hooks/use-workflow";
import { useToast } from "@/hooks/use-toast";

interface ProcessingStage {
  id: string;
  label: string;
  percentage: number;
}

const stages: ProcessingStage[] = [
  { id: "prompt", label: "Processing prompt", percentage: 25 },
  { id: "frames", label: "Generating frames", percentage: 50 },
  { id: "rendering", label: "Rendering video", percentage: 75 },
  { id: "uploading", label: "Uploading to IPFS", percentage: 100 },
];

export default function ProcessingSection() {
  const { toast } = useToast();
  const { 
    processingStatus,
    currentStageIndex,
    setStep,
    pollGenerationStatus
  } = useWorkflow();
  
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(stages[0]);
  
  // Start polling for generation status when component mounts
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const isComplete = await pollGenerationStatus();
        if (isComplete) {
          clearInterval(intervalId);
        }
      } catch (error: any) {
        console.error("Error polling generation status:", error);
        toast({
          title: "Error Checking Status",
          description: error.message || "Failed to check video generation status",
          variant: "destructive",
        });
        clearInterval(intervalId);
      }
    }, 5000); // Poll every 5 seconds
    
    return () => clearInterval(intervalId);
  }, [pollGenerationStatus, toast]);
  
  // Update progress based on current stage
  useEffect(() => {
    if (currentStageIndex >= 0 && currentStageIndex < stages.length) {
      setCurrentStage(stages[currentStageIndex]);
      
      // Calculate progress
      const baseProgress = currentStageIndex > 0 
        ? stages[currentStageIndex - 1].percentage 
        : 0;
      
      const targetProgress = stages[currentStageIndex].percentage;
      const progressRange = targetProgress - baseProgress;
      
      // Animate progress
      let currentProgress = baseProgress;
      const progressInterval = setInterval(() => {
        if (currentProgress < targetProgress) {
          currentProgress += 1;
          setProgress(currentProgress);
        } else {
          clearInterval(progressInterval);
        }
      }, 100);
      
      return () => clearInterval(progressInterval);
    }
  }, [currentStageIndex]);

  return (
    <div className="bg-surface p-6 rounded-lg shadow-lg gradient-border">
      <h2 className="font-display text-2xl font-semibold mb-4 flex items-center">
        <span className="material-icons text-primary mr-2 animate-spin-slow">autorenew</span>
        Generating Your Video
      </h2>
      <p className="text-text-secondary mb-6">
        {processingStatus || "Creating your amazing video. This typically takes 1 minute."}
      </p>
      
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span>{currentStage.label}</span>
          <span>{progress}%</span>
        </div>
        <div 
          className="h-2 bg-background-lighter rounded-full relative overflow-hidden progress-indicator" 
          style={{ "--progress": `${progress}%` } as React.CSSProperties}
        ></div>
      </div>
      
      {/* Animation */}
      <div className="py-8 flex justify-center">
        <div className="relative w-64 h-64">
          {/* Animated Elements */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border-4 border-t-primary border-r-secondary border-b-accent border-l-transparent animate-spin-slow"></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-t-transparent border-r-primary border-b-transparent border-l-secondary animate-spin"></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-icons text-4xl text-primary animate-pulse-slow">movie_filter</span>
          </div>
        </div>
      </div>
      
      <div className="bg-background-lighter p-4 rounded-lg">
        <div className="flex items-start">
          <span className="material-icons text-secondary mr-2 mt-0.5">lightbulb</span>
          <div>
            <h4 className="font-medium mb-1">While you wait...</h4>
            <p className="text-text-secondary text-sm">
              Your video is being generated. 
              We're rendering each frame with care to create a stunning result based on your prompt.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
