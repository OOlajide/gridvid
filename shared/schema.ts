import { z } from "zod";

// Define user types
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  password: z.string()
});

export const insertUserSchema = userSchema.omit({ id: true });

// Define video types
export const videoSchema = z.object({
  id: z.number(),
  prompt: z.string(),
  aspectRatio: z.string(),
  ipfsCid: z.string(),
  gatewayUrl: z.string(),
  duration: z.string().nullable(),
  createdAt: z.date(),
  walletAddress: z.string(),
  generationType: z.string(), // 'text' or 'image'
  metadata: z.record(z.any()).optional()
});

export const insertVideoSchema = videoSchema.omit({ 
  id: true,
  createdAt: true
});

export const generateVideoSchema = z.object({
  prompt: z.string().min(2).max(500),
  aspectRatio: z.enum(["16:9", "9:16"]),
  generationType: z.enum(["text"]),
  durationSeconds: z.number().int().min(5).max(8).default(5),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof userSchema>;

export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = z.infer<typeof videoSchema>;
export type GenerateVideoRequest = z.infer<typeof generateVideoSchema>;
