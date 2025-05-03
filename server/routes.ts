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
      // Debug logging
      console.log("Received video generation request:", req.body);
      
      // Validate request
      const validationResult = generateVideoSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        console.log("Validation failed:", validationResult.error.errors);
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }
      
      const { prompt, aspectRatio, generationType, durationSeconds = 5 } = validationResult.data;
      
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
        durationSeconds,
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
      // Create temp directory for upload
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Create temp file path for uploading to IPFS
      const tempVideoPath = path.join(uploadsDir, testVideoFilename);
      
      // For testing, generate a simple file that resembles MP4 header
      const testFileContent = Buffer.from([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6D, 0x70, 0x34, 0x32, 
        0x00, 0x00, 0x00, 0x00, 0x6D, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6F, 0x6D
      ]);
      
      // Write to temp location
      fs.writeFileSync(tempVideoPath, testFileContent);
      
      // Now upload to IPFS via Pinata
      console.log("Uploading test video to IPFS...");
      const { uploadToIPFS } = await import('./pinata');
      
      let finalVideoData: InsertVideo;
      
      try {
        // Upload to IPFS
        const uploadResult = await uploadToIPFS(tempVideoPath, `lukso-test-video-${Date.now()}.mp4`);
        console.log("Test video uploaded to IPFS:", uploadResult);
        
        // Clean up temp file
        fs.unlinkSync(tempVideoPath);
        
        // Create the video data for IPFS storage
        finalVideoData = {
          prompt: "Test video with IPFS storage",
          aspectRatio: "16:9",
          ipfsCid: uploadResult.cid,
          gatewayUrl: uploadResult.gatewayUrl,
          duration: "1.0 seconds",
          walletAddress: "0x123456789abcdef",
          generationType: "text",
          metadata: { 
            source: "Test",
            model: "test-1.0",
            ipfs: true,
            timestamp: Date.now()
          },
        };
      } catch (ipfsError) {
        console.error("Failed to upload test video to IPFS:", ipfsError);
        
        // Fall back to local storage if IPFS upload fails
        console.log("Using local file storage as fallback");
        fs.copyFileSync(tempVideoPath, testVideoPath);
        
        // Create the video data for local storage fallback
        finalVideoData = {
          prompt: "Test video (local storage fallback)",
          aspectRatio: "16:9",
          ipfsCid: `local-${testVideoId}`,
          gatewayUrl: `/videos/${testVideoFilename}`,
          duration: "1.0 seconds",
          walletAddress: "0x123456789abcdef",
          generationType: "text",
          metadata: { 
            source: "Test",
            model: "test-1.0" 
          },
        };
      }
      
      // Store in database
      const video = await storage.createVideo(finalVideoData);
      
      return res.status(200).json({
        message: "Test video created successfully",
        video,
        ipfs: video.ipfsCid.startsWith('baf') ? {
          cid: video.ipfsCid,
          gatewayUrl: video.gatewayUrl
        } : null
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
      
      console.log("File uploaded for IPFS:", file.originalname, file.size, "bytes");
      
      // Get metadata if provided
      let metadata = {};
      if (req.body.metadata) {
        try {
          metadata = JSON.parse(req.body.metadata);
          console.log("Upload metadata:", metadata);
        } catch (e) {
          console.warn("Invalid metadata JSON:", e);
        }
      }
      
      // Use our Pinata service for upload
      const { uploadToIPFS } = await import('./pinata');
      
      // Use original filename or create a unique one
      const filename = (metadata as any).name || file.originalname || `lukso-file-${Date.now()}${path.extname(file.path)}`;
      
      console.log("Uploading to IPFS via Pinata service:", filename);
      const ipfsResult = await uploadToIPFS(file.path, filename);
      
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      
      // Return IPFS information
      console.log("IPFS upload successful:", ipfsResult);
      return res.status(200).json({
        cid: ipfsResult.cid,
        gatewayUrl: ipfsResult.gatewayUrl,
        pinataUrl: ipfsResult.pinataUrl,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
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
      
      console.log("Downloading from IPFS:", cid);
      
      // Import the getIPFSUrl function from pinata.ts
      const { getIPFSUrl } = await import('./pinata');
      
      // Get the gateway URL
      const gatewayUrl = getIPFSUrl(cid);
      console.log("Using gateway URL:", gatewayUrl);
      
      // Fetch from IPFS gateway
      const response = await fetch(gatewayUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download from IPFS: ${response.statusText} (HTTP ${response.status})`);
      }
      
      // Set appropriate headers
      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      
      // Stream the response
      if (response.body) {
        response.body.pipe(res);
        console.log("Successfully streaming IPFS content");
      } else {
        throw new Error("Response body is null");
      }
    } catch (error: any) {
      console.error("IPFS download error:", error);
      return res.status(500).json({ 
        message: error.message || "Failed to download from IPFS",
        cid: req.query.cid
      });
    }
  });
  
  // LSP metadata storage endpoint
  app.post("/api/lsp/store", async (req: Request, res: Response) => {
    try {
      // Validate the request
      const { ipfsCid, gatewayUrl, prompt } = req.body;
      
      if (!ipfsCid || !gatewayUrl || !prompt) {
        return res.status(400).json({ message: "Missing required fields: ipfsCid, gatewayUrl, prompt" });
      }
      
      // Verify that the CID exists on IPFS
      const { checkIPFSStatus } = await import('./pinata');
      const exists = await checkIPFSStatus(ipfsCid);
      
      if (!exists) {
        return res.status(404).json({ message: "Content not found on IPFS. Please ensure it has been properly uploaded." });
      }
      
      // In a real implementation, this would interact with the LUKSO blockchain
      // For example, using the LSP metadata storage functions from LSP-SDK
      console.log("Storing LSP metadata for video with CID:", ipfsCid);
      console.log("This would normally be stored on the LUKSO blockchain via Universal Profile");
      
      // Return success (simulating blockchain transaction)
      return res.status(200).json({ 
        message: "Metadata stored successfully in Universal Profile",
        storedMetadata: {
          ipfsCid,
          gatewayUrl,
          timestamp: new Date().toISOString(),
          contentType: "video/mp4",
          title: `AI-Generated Video: ${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}`,
        }
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
