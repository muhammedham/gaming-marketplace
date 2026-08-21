import { fileURLToPath } from "node:url";
import path from "node:path";

import { env } from "./env.js";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

export const uploadDirectory = path.isAbsolute(env.UPLOAD_DIR)
  ? path.resolve(env.UPLOAD_DIR)
  : path.resolve(repositoryRoot, env.UPLOAD_DIR);

export const mediaPublicUrl = env.MEDIA_PUBLIC_URL.replace(/\/$/, "");

export function mediaUrl(storageKey: string) {
  return `${mediaPublicUrl}/${storageKey.split(path.sep).join("/")}`;
}
