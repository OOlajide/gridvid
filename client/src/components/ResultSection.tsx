import { Video } from "@shared/schema";
import { Button } from "@/components/ui/button";

interface ResultSectionProps {
  video: Video;
  onNewGeneration: () => void;
}

export default function ResultSection({ video, onNewGeneration }: ResultSectionProps) {
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
      
      <p className="text-text-secondary mb-6">
        Your video has been successfully generated.
      </p>
      
      {/* Video Preview */}
      <div className="mb-6 bg-black rounded-lg overflow-hidden">
        <video controls className="w-full h-auto max-h-[400px]">
          <source src={video.gatewayUrl.startsWith('http') ? video.gatewayUrl : `http://localhost:5000${video.gatewayUrl}`} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
      
      {/* Video Details */}
      <div className="mt-6">
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
            <div className="flex justify-between">
              <span className="text-text-secondary">Generated</span>
              <span className="text-text-primary">
                {formatTimestamp(video.createdAt.toString())}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Generate New Video Button */}
      <div className="flex justify-center mt-6">
        <Button
          onClick={onNewGeneration}
          className="bg-primary hover:bg-opacity-90 text-white px-6 py-3 rounded font-semibold flex items-center mx-auto transition-all glow"
        >
          <span className="material-icons mr-2">add_circle</span>
          Generate New Video
        </Button>
      </div>
    </div>
  );
}
