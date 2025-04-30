import { users, videos, type User, type InsertUser, type Video, type InsertVideo } from "@shared/schema";

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private videos: Map<number, Video>;
  userCurrentId: number;
  videoCurrentId: number;

  constructor() {
    this.users = new Map();
    this.videos = new Map();
    this.userCurrentId = 1;
    this.videoCurrentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Video methods
  async getVideo(id: number): Promise<Video | undefined> {
    return this.videos.get(id);
  }
  
  async listVideos(walletAddress?: string, limit: number = 10): Promise<Video[]> {
    let videos = Array.from(this.videos.values());
    
    // Filter by wallet address if provided
    if (walletAddress) {
      videos = videos.filter(video => video.walletAddress === walletAddress);
    }
    
    // Sort by creation date (newest first)
    videos.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Limit results
    return videos.slice(0, limit);
  }
  
  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const id = this.videoCurrentId++;
    const now = new Date();
    
    // Ensure metadata is set even if undefined in insertVideo
    const metadata = insertVideo.metadata || {};
    // Ensure duration is set to null if undefined
    const duration = insertVideo.duration || null;
    
    const video: Video = {
      ...insertVideo,
      id,
      createdAt: now,
      metadata,
      duration
    };
    
    this.videos.set(id, video);
    return video;
  }
}

export const storage = new MemStorage();
