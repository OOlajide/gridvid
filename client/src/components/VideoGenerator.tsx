import { useState, useRef, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useWorkflow } from "@/hooks/use-workflow";
import { apiRequest } from "@/lib/queryClient";

export default function VideoGenerator() {
  const { toast } = useToast();
  const { setStep, setGenerationParams } = useWorkflow();
  
  const [generationMethod, setGenerationMethod] = useState<'text' | 'image'>('text');
  const [promptText, setPromptText] = useState("");
  const [imagePromptText, setImagePromptText] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [imageAspectRatio, setImageAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTabChange = (method: 'text' | 'image') => {
    setGenerationMethod(method);
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please upload an image smaller than 5MB",
          variant: "destructive"
        });
        return;
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File Type",
          description: "Please upload a valid image file (PNG, JPG, WEBP)",
          variant: "destructive"
        });
        return;
      }
      
      setUploadedImage(file);
      
      // Create image preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Using the setGenerationParams from the workflow context to store params
  
  const handleGeneration = async () => {
    try {
      if (generationMethod === 'text') {
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
          generationType: 'text'
        });
        
        // Move to payment step
        setStep('payment');
      } else {
        if (!uploadedImage) {
          toast({
            title: "No Image",
            description: "Please upload an image to generate a video",
            variant: "destructive"
          });
          return;
        }
        
        // Convert image to base64
        const reader = new FileReader();
        reader.readAsDataURL(uploadedImage);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // Remove the data:image/xxx;base64, prefix
          const imageBase64 = base64data.split(',')[1];
          
          // Save the parameters for after payment
          setGenerationParams({
            prompt: imagePromptText || "Generate a video based on this image",
            aspectRatio: imageAspectRatio,
            generationType: 'image',
            imageBase64
          });
          
          // Move to payment step
          setStep('payment');
        };
      }
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to start video generation",
        variant: "destructive"
      });
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="bg-surface p-6 rounded-lg shadow-lg gradient-border">
      <h2 className="font-display text-2xl font-semibold mb-4 flex items-center">
        <span className="material-icons text-primary mr-2">create</span>
        Create Your Video
      </h2>
      <p className="text-text-secondary mb-6">Choose your generation method and describe what you want to create.</p>
      
      {/* Generation Method Tabs */}
      <div className="flex border-b border-background-lighter mb-6">
        <button 
          className={`tab-btn py-2 px-4 font-medium ${
            generationMethod === 'text' 
              ? 'text-primary border-b-2 border-primary' 
              : 'text-text-secondary'
          }`}
          onClick={() => handleTabChange('text')}
        >
          <span className="material-icons mr-1 text-sm">text_fields</span>
          Text Prompt
        </button>
        <button 
          className={`tab-btn py-2 px-4 font-medium ${
            generationMethod === 'image' 
              ? 'text-primary border-b-2 border-primary' 
              : 'text-text-secondary'
          }`}
          onClick={() => handleTabChange('image')}
        >
          <span className="material-icons mr-1 text-sm">image</span>
          Image Upload
        </button>
      </div>
      
      {/* Text Input Tab */}
      {generationMethod === 'text' && (
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
        </div>
      )}
      
      {/* Image Upload Tab */}
      {generationMethod === 'image' && (
        <div>
          <div className="mb-6">
            <Label htmlFor="imageUpload" className="block text-sm font-medium mb-2">
              Upload Base Image
            </Label>
            
            {!imagePreview ? (
              <div 
                className="border-2 border-dashed border-background-lighter rounded-lg p-6 text-center bg-background cursor-pointer"
                onClick={triggerFileInput}
              >
                <div className="mx-auto flex flex-col items-center">
                  <span className="material-icons text-4xl text-text-secondary mb-2">cloud_upload</span>
                  <p className="text-text-secondary mb-2">Drag and drop your image or</p>
                  <Button variant="secondary" className="px-4 py-2 bg-background-lighter rounded text-text-primary hover:bg-opacity-80">
                    Browse Files
                  </Button>
                  <input 
                    type="file" 
                    id="imageUpload" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  <p className="text-text-disabled text-xs mt-2">PNG, JPG or WEBP (max. 5MB)</p>
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <Label className="block text-sm font-medium mb-2">Image Preview</Label>
                <div className="relative">
                  <img 
                    className="w-full h-48 object-contain rounded-lg bg-background" 
                    src={imagePreview} 
                    alt="Uploaded image preview" 
                  />
                  <button 
                    className="absolute top-2 right-2 bg-background rounded-full p-1 text-text-secondary hover:text-text-primary"
                    onClick={handleRemoveImage}
                  >
                    <span className="material-icons">close</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="mb-4">
            <Label htmlFor="imagePromptInput" className="block text-sm font-medium mb-2">
              Add a Description (Optional)
            </Label>
            <Textarea
              id="imagePromptInput"
              rows={2}
              value={imagePromptText}
              onChange={(e) => setImagePromptText(e.target.value)}
              className="w-full bg-background rounded-lg border border-background-lighter p-3 text-text-primary placeholder-text-disabled focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Describe how you want to transform this image into a video"
            />
          </div>
          
          <div className="mb-6">
            <Label className="block text-sm font-medium mb-2">Aspect Ratio</Label>
            <RadioGroup 
              value={imageAspectRatio}
              onValueChange={(value) => setImageAspectRatio(value as "16:9" | "9:16")}
              className="flex space-x-3"
            >
              <div className="flex items-center">
                <RadioGroupItem value="16:9" id="ir1" className="accent-primary mr-2" />
                <Label htmlFor="ir1">16:9</Label>
              </div>
              <div className="flex items-center">
                <RadioGroupItem value="9:16" id="ir2" className="accent-primary mr-2" />
                <Label htmlFor="ir2">9:16</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      )}
      
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
