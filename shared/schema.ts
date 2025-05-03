import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  prompt: text("prompt").notNull(),
  aspectRatio: text("aspect_ratio").notNull(),
  ipfsCid: text("ipfs_cid").notNull(),
  gatewayUrl: text("gateway_url").notNull(),
  duration: text("duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  walletAddress: text("wallet_address").notNull(),
  generationType: text("generation_type").notNull(), // 'text' or 'image'
  metadata: jsonb("metadata"), // For additional data
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertVideoSchema = createInsertSchema(videos)
  .pick({
    prompt: true,
    aspectRatio: true,
    ipfsCid: true,
    gatewayUrl: true,
    duration: true,
    walletAddress: true,
    generationType: true,
    metadata: true,
  });

export const generateVideoSchema = z.object({
  prompt: z.string().min(2).max(500),
  aspectRatio: z.enum(["16:9", "9:16"]),
  generationType: z.enum(["text"]),
  durationSeconds: z.number().int().min(5).max(8).default(5),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videos.$inferSelect;
export type GenerateVideoRequest = z.infer<typeof generateVideoSchema>;
