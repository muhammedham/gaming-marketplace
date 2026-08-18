const MB = 1024 * 1024;

export const listingMediaRules = {
  cover: { count: 1, maxBytes: 5 * MB, types: ["image/jpeg", "image/png", "image/webp"] },
  gallery: { count: 5, maxBytes: 5 * MB, types: ["image/jpeg", "image/png", "image/webp"] },
  video: { count: 1, maxBytes: 25 * MB, types: ["video/mp4", "video/webm"] },
} as const;

function validateFile(file: File, allowedTypes: readonly string[], maxBytes: number, label: string) {
  if (!allowedTypes.includes(file.type)) {
    return `${label} must use an allowed file type.`;
  }

  if (file.size > maxBytes) {
    return `${label} is larger than ${Math.round(maxBytes / MB)} MB.`;
  }

  return null;
}

export function validateCover(file: File | null) {
  return file
    ? validateFile(file, listingMediaRules.cover.types, listingMediaRules.cover.maxBytes, "Cover")
    : null;
}

export function validateGallery(files: File[]) {
  if (files.length > listingMediaRules.gallery.count) {
    return `Gallery accepts up to ${listingMediaRules.gallery.count} images.`;
  }

  for (const file of files) {
    const error = validateFile(
      file,
      listingMediaRules.gallery.types,
      listingMediaRules.gallery.maxBytes,
      `Gallery image ${file.name}`,
    );
    if (error) return error;
  }

  return null;
}

export function validateVideo(file: File | null) {
  return file
    ? validateFile(file, listingMediaRules.video.types, listingMediaRules.video.maxBytes, "Video")
    : null;
}
