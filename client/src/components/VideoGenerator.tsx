import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useWorkflow } from "@/hooks/use-workflow-context";

export default function VideoGenerator() {
  const { toast } = useToast();
  const { setStep, setGenerationParams } = useWorkflow();
  
  const [promptText, setPromptText] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [videoDuration, setVideoDuration] = useState<number>(5);

  const handleGeneration = async () => {
    try {
      if (!promptText.trim()) {
        toast({
          title: "Empty Prompt",
          description: "Please enter a text prompt to generate a video",
          variant: "destructive"
        });
        return;
      }
      
      // Save the parameters for after payment
      setGenerationParams({
        prompt: promptText,
        aspectRatio,
        generationType: 'text',
        durationSeconds: videoDuration
      });
      
      // Move to payment step
      setStep('payment');
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to start video generation",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="bg-surface p-6 rounded-lg shadow-lg gradient-border">
      <h2 className="font-display text-2xl font-semibold mb-4 flex items-center">
        <span className="material-icons text-primary mr-2">create</span>
        Create Your Video
      </h2>
      <p className="text-text-secondary mb-6">Enter a detailed text prompt to create your AI-generated video.</p>
      
      <div>
        <div className="mb-4">
          <Label htmlFor="promptInput" className="block text-sm font-medium mb-2">
            Describe your video
          </Label>
          <Textarea
            id="promptInput"
            rows={3}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            className="w-full bg-background rounded-lg border border-background-lighter p-3 text-text-primary placeholder-text-disabled focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="E.g. Panning wide shot of a calico kitten sleeping in the sunshine"
          />
        </div>
        
        <div className="mb-6">
          <Label className="block text-sm font-medium mb-2">Aspect Ratio</Label>
          <RadioGroup 
            value={aspectRatio} 
            onValueChange={(value) => setAspectRatio(value as "16:9" | "9:16")}
            className="flex space-x-3"
          >
            <div className="flex items-center">
              <RadioGroupItem value="16:9" id="r1" className="accent-primary mr-2" />
              <Label htmlFor="r1">16:9</Label>
            </div>
            <div className="flex items-center">
              <RadioGroupItem value="9:16" id="r2" className="accent-primary mr-2" />
              <Label htmlFor="r2">9:16</Label>
            </div>
          </RadioGroup>
        </div>
        
        <div className="mb-6">
          <Label className="block text-sm font-medium mb-2">Video Duration (seconds)</Label>
          <RadioGroup 
            value={videoDuration.toString()} 
            onValueChange={(value) => setVideoDuration(parseInt(value))}
            className="flex space-x-3"
          >
            <div className="flex items-center">
              <RadioGroupItem value="5" id="d1" className="accent-primary mr-2" />
              <Label htmlFor="d1">5s</Label>
            </div>
            <div className="flex items-center">
              <RadioGroupItem value="6" id="d2" className="accent-primary mr-2" />
              <Label htmlFor="d2">6s</Label>
            </div>
            <div className="flex items-center">
              <RadioGroupItem value="7" id="d3" className="accent-primary mr-2" />
              <Label htmlFor="d3">7s</Label>
            </div>
            <div className="flex items-center">
              <RadioGroupItem value="8" id="d4" className="accent-primary mr-2" />
              <Label htmlFor="d4">8s</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
      
      <div className="text-center">
        <Button 
          onClick={handleGeneration}
          className="bg-primary hover:bg-opacity-90 text-white px-6 py-3 rounded font-semibold flex items-center mx-auto transition-all glow"
        >
          <span className="material-icons mr-2">movie_filter</span>
          Generate Video
        </Button>
      </div>
    </div>
  );
}