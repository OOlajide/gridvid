import { apiRequest } from "./queryClient";

interface IPFSUploadResponse {
  cid: string;
  gatewayUrl: string;
}

export async function uploadToIPFS(
  file: File | Blob,
  metadata: Record<string, any> = {}
): Promise<IPFSUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("metadata", JSON.stringify(metadata));

  const response = await fetch("/api/ipfs/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`IPFS upload failed: ${error}`);
  }

  return await response.json();
}

export async function downloadFromIPFS(cid: string): Promise<Blob> {
  const response = await fetch(`/api/ipfs/download?cid=${cid}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`IPFS download failed: ${error}`);
  }

  return await response.blob();
}
