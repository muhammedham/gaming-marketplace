import { apiRequest } from "../../lib/api-client";

export type InventoryAnalysisStatus =
  | "AWAITING_UPLOAD"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED";

export type InventoryAnalysis = {
  id: string;
  listingId: string;
  gameId: string;
  status: InventoryAnalysisStatus;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  providerJobId: string | null;
  output: unknown;
  rawResponse: unknown;
  errorMessage: string | null;
  uploadExpiresAt: string;
  deleteAfter: string;
  deletedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InventoryOverview = {
  listing: {
    id: string;
    title: string;
    category: { slug: string; name: string };
    game: { id: string; name: string; slug: string } | null;
  };
  eligible: boolean;
  integrationConfigured: boolean;
  storageConfigured: boolean;
  maxSizeBytes: number;
  retentionMinutes: number;
  acceptedTypes: string[];
  latest: InventoryAnalysis | null;
};

type UploadTarget = {
  analysis: InventoryAnalysis;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
};

export const inventoryAnalysisApi = {
  overview: (listingId: string) =>
    apiRequest<InventoryOverview>(`/inventory-analyses/listings/${listingId}`),
  requestUpload: (listingId: string, file: File) =>
    apiRequest<UploadTarget>("/inventory-analyses/upload-url", {
      method: "POST",
      body: JSON.stringify({
        listingId,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      }),
    }),
  completeUpload: (analysisId: string) =>
    apiRequest<InventoryAnalysis>(`/inventory-analyses/${analysisId}/complete-upload`, { method: "POST" }),
  get: (analysisId: string) =>
    apiRequest<InventoryAnalysis>(`/inventory-analyses/${analysisId}`),
};

export function uploadToR2(
  file: File,
  target: Pick<UploadTarget, "uploadUrl" | "uploadHeaders">,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", target.uploadUrl);
    Object.entries(target.uploadHeaders).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("The browser could not upload the video to Cloudflare R2."));
    request.onabort = () => reject(new Error("The video upload was cancelled."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Cloudflare R2 rejected the upload (HTTP ${request.status}). Check the bucket CORS policy.`));
    };
    request.send(file);
  });
}
