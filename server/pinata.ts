import fetch from "node-fetch";
import fs from "fs";
import path from "path";
// Use the standard FormData from the form-data package since it's more compatible with node-fetch
import FormData from "form-data";

// Initialize Pinata credentials from environment variables
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;
const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY

// Verify that credentials are available
if (!PINATA_API_KEY || !PINATA_API_SECRET) {
  console.warn("Pinata API credentials not found in environment variables. IPFS functionality may not work correctly.");
}

/**
 * Uploads a file to IPFS using Pinata's API
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
    // Create FormData instance
    const form = new FormData();
    
    // Get file details
    const fileName = name || path.basename(filePath);
    const fileSize = (await fs.promises.stat(filePath)).size;
    const contentType = fileName.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream';
    
    console.log(`Preparing to upload ${fileName} (${fileSize} bytes) to IPFS via Pinata`);
    
    // Add file to form as a stream
    const fileStream = fs.createReadStream(filePath);
    form.append('file', fileStream, {
      filename: fileName,
      contentType
    });
    
    // Add metadata to the form
    form.append('pinataMetadata', JSON.stringify({
      name: fileName,
      keyvalues: {
        source: 'LUKSO AI Video Generator',
        timestamp: Date.now().toString()
      }
    }));
    
    // Add pinning options
    form.append('pinataOptions', JSON.stringify({
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
    
    // Make API request to Pinata
    console.log("Making request to Pinata API...");
    
    // Set headers based on available credentials
    let headers = {
      ...form.getHeaders()
    };
    
    // Use JWT if available, otherwise use API key and secret
    if (PINATA_JWT) {
      headers = {
        ...headers,
        'Authorization': `Bearer ${PINATA_JWT}`
      };
    } else if (PINATA_API_KEY && PINATA_API_SECRET) {
      headers = {
        ...headers,
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_API_SECRET
      };
    } else {
      throw new Error('No Pinata credentials available. Please set PINATA_JWT or PINATA_API_KEY and PINATA_API_SECRET environment variables.');
    }
    
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers,
      body: form
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata API error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json() as any;
    const cid = result.IpfsHash;
    
    // Create gateway URL
    const gatewayUrl = `https://${PINATA_GATEWAY}/ipfs/${cid}`;
    
    console.log("Successfully uploaded to IPFS via Pinata");
    console.log("CID:", cid);
    console.log("Gateway URL:", gatewayUrl);
    
    return {
      cid,
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
  // Check if this is a real IPFS CID
  if (cid.startsWith('baf')) {
    return `https://${PINATA_GATEWAY}/ipfs/${cid}`;
  }
  
  // Legacy format or local CID
  return cid.includes('ipfs/')
    ? cid
    : `https://${PINATA_GATEWAY}/ipfs/${cid}`;
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