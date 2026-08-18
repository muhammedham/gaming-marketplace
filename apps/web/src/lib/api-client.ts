const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, string[]>;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string[]>;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.error?.message ?? "The request could not be completed.");
    this.name = "ApiError";
    this.status = status;
    this.code = payload.error?.code ?? "UNKNOWN_ERROR";
    this.details = payload.error?.details;
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as ApiErrorPayload & { data?: T };

  if (!response.ok) {
    throw new ApiError(response.status, payload);
  }

  return payload.data as T;
}
