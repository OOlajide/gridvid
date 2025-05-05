import { type User, type InsertUser, type Video, type InsertVideo } from "@shared/schema";

// Interface defining storage operations
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Video related methods
  getVideo(id: number): Promise<Video | undefined>;
  listVideos(walletAddress?: string, limit?: number): Promise<Video[]>;
  createVideo(video: InsertVideo): Promise<Video>;
}

// In-memory implementation of the IStorage interface
export class MemoryStorage implements IStorage {
  private users: User[] = [];
  private videos: Video[] = [];
  private userId = 1;
  private videoId = 1;
  
  async getUser(id: number): Promise<User | undefined> {
    return this.users.find(user => user.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      id: this.userId++,
      ...insertUser,
    };
    this.users.push(user);
    return user;
  }
  
  async getVideo(id: number): Promise<Video | undefined> {
    return this.videos.find(video => video.id === id);
  }
  
  async listVideos(walletAddress?: string, limit: number = 10): Promise<Video[]> {
    let filteredVideos = this.videos;
    
    if (walletAddress) {
      filteredVideos = filteredVideos.filter(video => video.walletAddress === walletAddress);
    }
    
    // Sort by createdAt in descending order (newest first)
    filteredVideos.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
    
    return filteredVideos.slice(0, limit);
  }
  
  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const video: Video = {
      id: this.videoId++,
      createdAt: new Date(),
      ...insertVideo,
      metadata: insertVideo.metadata || {},
      duration: insertVideo.duration || null
    };
    
    this.videos.push(video);
    return video;
  }
}

// Export an instance of the MemoryStorage class
export const storage = new MemoryStorage();