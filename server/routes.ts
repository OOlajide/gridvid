import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  generateVideo, 
  checkVideoGenerationStatus, 
  VideoGenerationRequest, 
  VideoGenerationStatus 
} from "./googleai";
import multer from "multer";
import { z } from "zod";
import { generateVideoSchema, InsertVideo } from "@shared/schema";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import fetch from "node-fetch";
import FormData from "form-data";
import axios from "axios";

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// IPFS configuration - would use environment variables in production
const PINATA_API_KEY = process.env.PINATA_API_KEY || "your_pinata_api_key";
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || "your_pinata_secret_key";
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

// Track ongoing video generations
const videoGenerations = new Map<string, VideoGenerationStatus>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve video files from the public/videos directory 
  const staticDir = path.join(process.cwd(), 'public', 'videos');
  app.use('/videos', express.static(staticDir));
  
  // API routes with /api prefix
  
  // Video generation endpoint
  app.post("/api/videos/generate", async (req: Request, res: Response) => {
    try {
      // Validate request
      const validationResult = generateVideoSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }
      
      const { prompt, aspectRatio, generationType, imageBase64 } = validationResult.data;
      
      // Generate a unique ID for this generation
      const generationId = crypto.randomUUID();
      
      // Initialize generation status
      videoGenerations.set(generationId, {
        status: "Initializing generation process",
        stageIndex: 0,
        complete: false,
        startedAt: new Date(),
        video: null,
      });
      
      // Start video generation without waiting for it to complete
      generateVideo({
        prompt,
        aspectRatio,
        generationType,
        imageBase64,
        statusCallback: (status) => {
          videoGenerations.set(generationId, status);
        }
      }).catch(error => {
        console.error("Async video generation error:", error);
        videoGenerations.set(generationId, {
          status: `Error: ${error.message || "Unknown error"}`,
          stageIndex: -1,
          complete: true,
          startedAt: new Date(),
          video: null
        });
      });
      
      return res.status(202).json({ 
        message: "Video generation started", 
        generationId 
      });
    } catch (error: any) {
      console.error("Video generation error:", error);
      return res.status(500).json({ message: error.message || "Failed to generate video" });
    }
  });
  
  // Test video endpoint (for debugging)
  app.get("/api/videos/test", async (_req: Request, res: Response) => {
    try {
      // Create public directory structure
      const publicDir = path.join(process.cwd(), "public");
      const videosDir = path.join(publicDir, "videos");
      
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      if (!fs.existsSync(videosDir)) {
        fs.mkdirSync(videosDir, { recursive: true });
      }
      
      // Generate a test video ID
      const testVideoId = "test-" + Date.now();
      const testVideoFilename = `${testVideoId}.mp4`;
      const testVideoPath = path.join(videosDir, testVideoFilename);
      
      // Create a simple test video file (just copy a sample video if available)
      // For testing, generate a simple 1px video file
      const testFileContent = Buffer.from([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6D, 0x70, 0x34, 0x32, 
        0x00, 0x00, 0x00, 0x00, 0x6D, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6F, 0x6D
      ]);
      
      fs.writeFileSync(testVideoPath, testFileContent);
      
      // Create video URL
      const videoUrl = `/videos/${testVideoFilename}`;
      
      // Create a test video entry in the database
      const testVideoData: InsertVideo = {
        prompt: "Test video",
        aspectRatio: "16:9",
        ipfsCid: `local-${testVideoId}`,
        gatewayUrl: videoUrl,
        duration: "1.0 seconds",
        walletAddress: "0x123456789abcdef",
        generationType: "text",
        metadata: { 
          source: "Test",
          model: "test-1.0" 
        },
      };
      
      // Store in database
      const video = await storage.createVideo(testVideoData);
      
      return res.status(200).json({
        message: "Test video created successfully",
        video,
        videoUrl
      });
    } catch (error: any) {
      console.error("Test video error:", error);
      return res.status(500).json({ message: error.message || "Failed to create test video" });
    }
  });
  
  // Check generation status endpoint
  app.get("/api/videos/status", async (req: Request, res: Response) => {
    try {
      const { id } = req.query;
      
      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Missing generation ID" });
      }
      
      const status = videoGenerations.get(id);
      
      if (!status) {
        return res.status(404).json({ message: "Generation not found" });
      }
      
      return res.status(200).json(status);
    } catch (error: any) {
      console.error("Error checking generation status:", error);
      return res.status(500).json({ message: error.message || "Failed to check generation status" });
    }
  });
  
  // Get specific video endpoint
  app.get("/api/videos/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get the video from storage
      const video = await storage.getVideo(parseInt(id));
      
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      return res.status(200).json(video);
    } catch (error: any) {
      console.error("Error getting video:", error);
      return res.status(500).json({ message: error.message || "Failed to get video" });
    }
  });
  
  // IPFS upload endpoint
  app.post("/api/ipfs/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      const file = req.file as Express.Multer.File;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Get metadata if provided
      let metadata = {};
      if (req.body.metadata) {
        try {
          metadata = JSON.parse(req.body.metadata);
        } catch (e) {
          console.warn("Invalid metadata JSON:", e);
        }
      }
      
      // Upload to IPFS via Pinata
      const form = new FormData();
      form.append("file", fs.createReadStream(file.path));
      form.append("pinataMetadata", JSON.stringify({
        name: `lukso-video-${Date.now()}`,
      }));
      
      if (Object.keys(metadata).length > 0) {
        form.append("pinataOptions", JSON.stringify({
          cidVersion: 1,
          customPinPolicy: {
            regions: [
              {
                id: "FRA1",
                desiredReplicationCount: 1
              },
              {
                id: "NYC1",
                desiredReplicationCount: 1
              }
            ]
          }
        }));
      }
      
      const pinataResponse = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
          "pinata_api_key": PINATA_API_KEY,
          "pinata_secret_api_key": PINATA_SECRET_KEY,
        },
        body: form,
      });
      
      if (!pinataResponse.ok) {
        const errorText = await pinataResponse.text();
        throw new Error(`Pinata upload failed: ${errorText}`);
      }
      
      const pinataResult = await pinataResponse.json();
      
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      
      // Return IPFS CID and gateway URL
      const ipfsHash = (pinataResult as any).IpfsHash;
      return res.status(200).json({
        cid: ipfsHash,
        gatewayUrl: `${PINATA_GATEWAY}${ipfsHash}`,
      });
    } catch (error: any) {
      console.error("IPFS upload error:", error);
      return res.status(500).json({ message: error.message || "Failed to upload to IPFS" });
    }
  });
  
  // IPFS download endpoint
  app.get("/api/ipfs/download", async (req: Request, res: Response) => {
    try {
      const { cid } = req.query;
      
      if (!cid || typeof cid !== "string") {
        return res.status(400).json({ message: "Missing IPFS CID" });
      }
      
      // Fetch from IPFS gateway
      const gatewayUrl = `${PINATA_GATEWAY}${cid}`;
      const response = await fetch(gatewayUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download from IPFS: ${response.statusText}`);
      }
      
      // Stream the response
      if (response.body) {
        response.body.pipe(res);
      } else {
        throw new Error("Response body is null");
      }
    } catch (error: any) {
      console.error("IPFS download error:", error);
      return res.status(500).json({ message: error.message || "Failed to download from IPFS" });
    }
  });
  
  // LSP metadata storage endpoint (simplified for this example)
  app.post("/api/lsp/store", async (req: Request, res: Response) => {
    try {
      // In a real implementation, this would interact with the LUKSO blockchain
      // For now, we'll just return success
      return res.status(200).json({ 
        message: "Metadata stored successfully in Universal Profile" 
      });
    } catch (error: any) {
      console.error("LSP storage error:", error);
      return res.status(500).json({ message: error.message || "Failed to store LSP metadata" });
    }
  });
  
  // LYX price endpoint - fetch current price from CoinMarketCap
  app.get("/api/price/lyx", async (req: Request, res: Response) => {
    try {
      const API_KEY = process.env.COINMARKETCAP_API_KEY;
      
      if (!API_KEY) {
        throw new Error("CoinMarketCap API key is not configured");
      }
      
      // Make request to CoinMarketCap API
      const response = await axios.get('https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest', {
        params: {
          slug: 'lukso-network',
          convert: 'USD'
        },
        headers: {
          'X-CMC_PRO_API_KEY': API_KEY
        }
      });
      
      if (!response.data || !response.data.data) {
        throw new Error("Invalid response from CoinMarketCap API");
      }
      
      // Extract the LYX price
      const luksoData = response.data.data[Object.keys(response.data.data)[0]];
      if (!luksoData || !luksoData.quote || !luksoData.quote.USD) {
        throw new Error("LYX price data not found in API response");
      }
      
      const price = luksoData.quote.USD.price;
      
      return res.status(200).json({
        price,
        symbol: luksoData.symbol,
        lastUpdated: luksoData.quote.USD.last_updated
      });
    } catch (error: any) {
      console.error("Error fetching LYX price:", error);
      return res.status(500).json({ 
        message: error.message || "Failed to fetch LYX price",
        error: error.toString()
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
