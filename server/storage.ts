import { type User, type InsertUser, type Video, type InsertVideo } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import * as schema from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Video related methods
  getVideo(id: number): Promise<Video | undefined>;
  listVideos(walletAddress?: string, limit?: number): Promise<Video[]>;
  createVideo(video: InsertVideo): Promise<Video>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const userResults = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return userResults.length > 0 ? userResults[0] : undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const newUsers = await db.insert(schema.users).values(insertUser).returning();
    return newUsers[0];
  }
  
  // Video methods
  async getVideo(id: number): Promise<Video | undefined> {
    const videoResults = await db.select().from(schema.videos).where(eq(schema.videos.id, id));
    return videoResults.length > 0 ? videoResults[0] : undefined;
  }
  
  async listVideos(walletAddress?: string, limit: number = 10): Promise<Video[]> {
    if (walletAddress) {
      return await db.select()
        .from(schema.videos)
        .where(eq(schema.videos.walletAddress, walletAddress))
        .orderBy(desc(schema.videos.createdAt))
        .limit(limit);
    } else {
      return await db.select()
        .from(schema.videos)
        .orderBy(desc(schema.videos.createdAt))
        .limit(limit);
    }
  }
  
  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    // Ensure metadata is set even if undefined in insertVideo
    const metadata = insertVideo.metadata || {};
    // Ensure duration is set to null if undefined
    const duration = insertVideo.duration || null;
    
    const newVideos = await db.insert(schema.videos).values({
      ...insertVideo,
      metadata,
      duration
    }).returning();
    
    return newVideos[0];
  }
}

// Export an instance of the DatabaseStorage class
export const storage = new DatabaseStorage();
