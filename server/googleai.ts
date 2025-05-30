import { GoogleGenAI } from "@google/genai";
import { Video, InsertVideo } from "@shared/schema";
import { storage } from "./storage";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import crypto from "crypto";

// Access the Google API key from environment variables
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
  console.error("WARNING: GOOGLE_API_KEY environment variable is not set");
}
const genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY as string });

// Configure IPFS gateway
const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

// Define types for video generation
export interface VideoGenerationRequest {
  prompt: string;
  aspectRatio: string;
  generationType: string;
  durationSeconds: number;
  statusCallback?: (status: VideoGenerationStatus) => void;
}

export interface VideoGenerationStatus {
  status: string;
  stageIndex: number;
  complete: boolean;
  startedAt: Date;
  video: Video | null;
}

// Function to generate video
export async function generateVideo(req: VideoGenerationRequest): Promise<Video> {
  const { prompt, aspectRatio, generationType, durationSeconds, statusCallback } = req;
  
  try {
    // Update status
    if (statusCallback) {
      statusCallback({
        status: "Processing prompt and initializing generation",
        stageIndex: 0,
        complete: false,
        startedAt: new Date(),
        video: null,
      });
    }
    
    // Configure generation options
    const model = "veo-2.0-generate-001";
    const config = {
      personGeneration: "allow_adult",
      aspectRatio: aspectRatio,
      numberOfVideos: 1,
      durationSeconds: durationSeconds
    };
    
    // Start text-to-video generation operation
    let operation = await genAI.models.generateVideos({
      model,
      prompt,
      config,
    });
    
    // Update status
    if (statusCallback) {
      statusCallback({
        status: "Generating frames",
        stageIndex: 1,
        complete: false,
        startedAt: new Date(),
        video: null,
      });
    }
    
    // Wait for operation to complete
    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Poll every 10 seconds
      operation = await genAI.operations.getVideosOperation({
        operation: operation,
      });
    }
    
    // Update status
    if (statusCallback) {
      statusCallback({
        status: "Rendering video",
        stageIndex: 2,
        complete: false,
        startedAt: new Date(),
        video: null,
      });
    }
    
    // Check if we have generated videos
    if (!operation.response?.generatedVideos || operation.response.generatedVideos.length === 0) {
      throw new Error("No videos were generated");
    }
    
    const generatedVideo = operation.response.generatedVideos[0];
    
    if (!generatedVideo.video?.uri) {
      throw new Error("Video URI is missing");
    }
    
    // Download the video
    const videoUri = `${generatedVideo.video.uri}&key=${GOOGLE_API_KEY}`;
    const response = await fetch(videoUri);
    
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Save video to disk temporarily
    const videoFilename = `video-${crypto.randomUUID()}.mp4`;
    const videoPath = path.join(uploadsDir, videoFilename);
    const fileStream = fs.createWriteStream(videoPath);
    
    await new Promise<void>((resolve, reject) => {
      if (!response.body) {
        reject(new Error("Response body is null"));
        return;
      }
      
      // Handle the response body streaming in a more compatible way
      if (response.body.pipe) {
        // If body has pipe method (node-fetch), use it directly
        response.body.pipe(fileStream);
      } else {
        // Last resort - convert buffer/text
        response.buffer().then(buffer => {
          fileStream.write(buffer);
          fileStream.end();
        }).catch(reject);
      }
      
      fileStream.on("finish", resolve);
      fileStream.on("error", reject);
    });
    
    // Update status
    if (statusCallback) {
      statusCallback({
        status: "Uploading to IPFS",
        stageIndex: 3,
        complete: false,
        startedAt: new Date(),
        video: null,
      });
    }
    
    // Now upload the video to IPFS through Pinata
    const { uploadToIPFS } = await import('./pinata');
    
    console.log("Uploading video to IPFS via Pinata...");
    const ipfsResult = await uploadToIPFS(videoPath, `lukso-generated-video-${Date.now()}.mp4`);
    
    // Get the IPFS CID and gateway URL
    const ipfsCid = ipfsResult.cid;
    const gatewayUrl = ipfsResult.gatewayUrl;
    
    console.log(`Video uploaded to IPFS with CID: ${ipfsCid}`);
    console.log(`Video accessible at: ${gatewayUrl}`);
    
    // Create video record in database
    const videoData: InsertVideo = {
      prompt,
      aspectRatio,
      ipfsCid,
      gatewayUrl, // Use the IPFS gateway URL
      duration: `${durationSeconds}.0 seconds`,
      walletAddress: "0x123456789abcdef", // This would come from the user's wallet
      generationType,
      metadata: { 
        source: "Google Veo AI",
        model: "veo-2.0-generate-001",
        ipfs: true, // Indicate this is on IPFS
        duration: durationSeconds,
        timestamp: Date.now()
      },
    };
    
    // Store in database
    const video = await storage.createVideo(videoData);
    
    // Clean up the temporary file from uploads directory (but keep the one in public)
    fs.unlinkSync(videoPath);
    
    // Update status to complete
    if (statusCallback) {
      statusCallback({
        status: "Generation complete",
        stageIndex: 4,
        complete: true,
        startedAt: new Date(),
        video,
      });
    }
    
    return video;
  } catch (error: any) {
    console.error("Video generation error:", error);
    
    // Update status with error
    if (statusCallback) {
      statusCallback({
        status: `Error: ${error.message || "Unknown error"}`,
        stageIndex: -1,
        complete: true,
        startedAt: new Date(),
        video: null,
      });
    }
    
    throw error;
  }
}

// Function to check video generation status
export async function checkVideoGenerationStatus(id: string): Promise<VideoGenerationStatus> {
  // This would interact with Google's API to check the status
  // For demo purposes, we'll return a mock status
  return {
    status: "Processing",
    stageIndex: 1,
    complete: false,
    startedAt: new Date(),
    video: null,
  };
}
