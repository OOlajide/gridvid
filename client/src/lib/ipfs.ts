import { apiRequest } from "./queryClient";

interface IPFSUploadResponse {
  cid: string;
  gatewayUrl: string;
  pinataUrl?: string;
}

/**
 * Uploads a file to IPFS via our server's Pinata integration
 * @param file File or Blob to upload
 * @param metadata Additional metadata to store with the file
 * @returns Object with CID and gateway URL
 */
export async function uploadToIPFS(
  file: File | Blob,
  metadata: Record<string, any> = {}
): Promise<IPFSUploadResponse> {
  // Enhance metadata with source information
  const enhancedMetadata = {
    ...metadata,
    source: "LUKSO AI Video Generator",
    timestamp: Date.now(),
    type: file instanceof File ? file.type : 'application/octet-stream'
  };
  
  const formData = new FormData();
  formData.append("file", file);
  formData.append("metadata", JSON.stringify(enhancedMetadata));

  console.log("Uploading to IPFS with metadata:", enhancedMetadata);
  
  const response = await fetch("/api/ipfs/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`IPFS upload failed: ${error}`);
  }

  const result = await response.json();
  console.log("IPFS upload successful:", result);
  
  return result;
}

/**
 * Downloads a file from IPFS via our server
 * @param cid IPFS CID of the file
 * @returns Blob containing the file data
 */
export async function downloadFromIPFS(cid: string): Promise<Blob> {
  // Check if this is a real IPFS CID (starts with 'baf')
  const isRealIPFS = cid.startsWith('baf');
  console.log(`Downloading ${isRealIPFS ? 'from IPFS' : 'from local storage'}: ${cid}`);
  
  try {
    const response = await fetch(`/api/ipfs/download?cid=${cid}`, {
      credentials: "include",
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`IPFS download failed: ${error}`);
    }
    
    const blob = await response.blob();
    console.log(`Download complete, size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    return blob;
  } catch (error) {
    console.error("Error downloading from IPFS:", error);
    throw error;
  }
}

/**
 * Gets the URL for an IPFS resource
 * @param cid IPFS CID of the file
 * @returns Gateway URL to access the file
 */
export function getIPFSUrl(cid: string): string {
  // Check if this is a real IPFS CID
  if (cid.startsWith('baf')) {
    return `https://orange-imaginative-hawk-931.mypinata.cloud/ipfs/${cid}`;
  }
  
  // If it's not a real IPFS CID, it's likely a local file
  return `/api/videos/${cid}`;
}
