import { describe, expect, it } from "vitest";

import { validateCover, validateGallery, validateVideo } from "./media-validation";

function file(name: string, type: string, size = 10) {
  return new File([new Uint8Array(size)], name, { type });
}

describe("listing media validation", () => {
  it("accepts the agreed cover and video formats", () => {
    expect(validateCover(file("cover.webp", "image/webp"))).toBeNull();
    expect(validateVideo(file("preview.webm", "video/webm"))).toBeNull();
  });

  it("rejects unsupported formats and oversized covers", () => {
    expect(validateCover(file("cover.gif", "image/gif"))).toMatch(/allowed file type/);
    expect(validateCover(file("cover.png", "image/png", 5 * 1024 * 1024 + 1))).toMatch(/larger than 5 MB/);
  });

  it("limits the gallery to five valid images", () => {
    const gallery = Array.from({ length: 6 }, (_, index) => file(`image-${index}.png`, "image/png"));
    expect(validateGallery(gallery)).toBe("Gallery accepts up to 5 images.");
  });
});
