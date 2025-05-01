import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Video } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { storeLSPMetadata } from "@/lib/lukso";

interface ResultSectionProps {
  video: Video;
  onNewGeneration: () => void;
}

export default function ResultSection({ video, onNewGeneration }: ResultSectionProps) {
  const { toast } = useToast();
  const [isStoring, setIsStoring] = useState(false);
  
  const handleDownload = async () => {
    try {
      // Get the full video URL
      const videoUrl = video.gatewayUrl.startsWith('http') ? 
        video.gatewayUrl : 
        `http://localhost:5000${video.gatewayUrl}`;
      
      // Create an anchor element and trigger download
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `lukso-video-${video.id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download video",
        variant: "destructive",
      });
    }
  };
  
  const handleStoreLSP = async () => {
    setIsStoring(true);
    
    try {
      // Get the full video URL
      const videoUrl = video.gatewayUrl.startsWith('http') ? 
        video.gatewayUrl : 
        `http://localhost:5000${video.gatewayUrl}`;
      
      await storeLSPMetadata({
        ipfsCid: video.ipfsCid,
        gatewayUrl: videoUrl,
        prompt: video.prompt,
      });
      
      toast({
        title: "Storage Successful",
        description: "Video metadata has been stored in your Universal Profile",
      });
    } catch (error: any) {
      console.error('LSP storage error:', error);
      toast({
        title: "Storage Failed",
        description: error.message || "Failed to store metadata in Universal Profile",
        variant: "destructive",
      });
    } finally {
      setIsStoring(false);
    }
  };

  // Format timestamp
  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="bg-surface p-6 rounded-lg shadow-lg gradient-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-semibold flex items-center">
          <span className="material-icons text-primary mr-2">movie</span>
          Your Generated Video
        </h2>
        <button 
          className="text-text-secondary hover:text-text-primary"
          onClick={onNewGeneration}
        >
          <span className="material-icons">refresh</span>
        </button>
      </div>
      
      <p className="text-text-secondary mb-6">Your video has been successfully generated and stored on IPFS.</p>
      
      {/* Video Preview */}
      <div className="mb-6 bg-black rounded-lg overflow-hidden">
        <video controls className="w-full h-auto max-h-[400px]">
          <source src={video.gatewayUrl.startsWith('http') ? video.gatewayUrl : `http://localhost:5000${video.gatewayUrl}`} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
      
      {/* Video Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-background p-4 rounded-lg">
          <h3 className="font-medium mb-2 text-sm uppercase text-text-secondary">Generation Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Prompt</span>
              <span className="text-text-primary max-w-[200px] truncate">{video.prompt}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Aspect Ratio</span>
              <span className="text-text-primary">{video.aspectRatio}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Duration</span>
              <span className="text-text-primary">{video.duration || "Unknown"}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-background p-4 rounded-lg">
          <h3 className="font-medium mb-2 text-sm uppercase text-text-secondary">Storage Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">IPFS CID</span>
              <code className="bg-background-lighter px-2 py-0.5 rounded text-xs">
                {video.ipfsCid.length > 20 
                  ? `${video.ipfsCid.substring(0, 20)}...` 
                  : video.ipfsCid}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Video URL</span>
              <a 
                href={video.gatewayUrl.startsWith('http') ? video.gatewayUrl : `http://localhost:5000${video.gatewayUrl}`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-secondary hover:underline"
              >
                View Video
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Generated</span>
              <span className="text-text-primary">
                {formatTimestamp(video.createdAt.toString())}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button
          onClick={handleDownload}
          variant="secondary"
          className="bg-background-lighter hover:bg-opacity-80 text-text-primary px-6 py-3 rounded font-semibold flex items-center transition-all"
        >
          <span className="material-icons mr-2">download</span>
          Download Video
        </Button>
        
        <Button
          onClick={handleStoreLSP}
          disabled={isStoring}
          className="bg-accent hover:bg-opacity-90 text-white px-6 py-3 rounded font-semibold flex items-center transition-all glow-purple"
        >
          {isStoring ? (
            <>
              <span className="material-icons mr-2 animate-spin">autorenew</span>
              Storing...
            </>
          ) : (
            <>
              <span className="material-icons mr-2">verified</span>
              Store in Universal Profile
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
