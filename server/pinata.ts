import { PinataSDK } from "pinata";
import fs from "fs";
import path from "path";

// Initialize Pinata with your credentials
const PINATA_JWT = process.env.PINATA_JWT || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJiOGE4ZjQxMC1hNGUwLTQyYzMtODJkZC1hMmYyZjExM2MyMGIiLCJlbWFpbCI6Im9sYWRhbmllbDE5QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiJiNjBkYWUyYzcxYzdlYzc1ZWUwNiIsInNjb3BlZEtleVNlY3JldCI6Ijg2ZjhkNjM4YjExYzVhNmM5NWEwNDQ1NGUzMTRiZTA2MTViNzRiNTU2ZGRmODRjMTg5Yjg3MjdjYTk3NzMxMTgiLCJleHAiOjE3Nzc1OTAyMTJ9.t0X17xaa4N0XWuO5PXDQINSI8Z6qzpgsjy3u15G2WcU";
const PINATA_GATEWAY = "orange-imaginative-hawk-931.mypinata.cloud";

const pinata = new PinataSDK({
  pinataJwt: PINATA_JWT,
  pinataGateway: PINATA_GATEWAY,
});

/**
 * Uploads a file to IPFS using Pinata
 * @param filePath Path to the file to upload
 * @param name Optional name for the file
 * @returns Object with CID and gateway URL
 */
export async function uploadToIPFS(filePath: string, name?: string): Promise<{ 
  cid: string; 
  gatewayUrl: string;
  pinataUrl: string;
}> {
  try {
    // Create a File object from the file path
    const fileData = fs.readFileSync(filePath);
    const fileName = name || path.basename(filePath);
    
    // Create a File object (browser API) from the file data
    const file = new File([fileData], fileName, { 
      type: fileName.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream' 
    });
    
    // Upload the file to Pinata
    const result = await pinata.upload.public.file(file);
    
    // Create gateway URL
    const gatewayUrl = `https://${PINATA_GATEWAY}/ipfs/${result.cid}`;
    
    return {
      cid: result.cid,
      gatewayUrl,
      pinataUrl: gatewayUrl
    };
  } catch (error) {
    console.error("Error uploading to IPFS:", error);
    throw new Error(`Failed to upload to IPFS: ${(error as Error).message}`);
  }
}

/**
 * Gets a file from IPFS using Pinata gateway
 * @param cid IPFS CID of the file
 * @returns URL to access the file
 */
export function getIPFSUrl(cid: string): string {
  return `https://${PINATA_GATEWAY}/ipfs/${cid}`;
}

/**
 * Checks if a CID exists on IPFS via Pinata
 * @param cid IPFS CID to check
 * @returns Boolean indicating if the CID exists
 */
export async function checkIPFSStatus(cid: string): Promise<boolean> {
  try {
    // Try to fetch the file to see if it exists
    const response = await fetch(getIPFSUrl(cid), { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error("Error checking IPFS status:", error);
    return false;
  }
}

export default {
  uploadToIPFS,
  getIPFSUrl,
  checkIPFSStatus
};