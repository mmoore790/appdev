// This new file is frontend/src/src/lib/api.ts

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

const API_BASE_URL = rawBaseUrl ? rawBaseUrl.replace(/\/$/, "") : "";

// Log the API base URL configuration (helpful for debugging)
if (typeof window !== "undefined") {
  if (API_BASE_URL) {
    console.log("[api] Using API_BASE_URL:", API_BASE_URL);
  } else {
  console.warn(
      "[api] VITE_API_BASE_URL is not set. Falling back to relative URLs. Configure it in Vercel environment variables when deploying."
  );
  }
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

const ensureLeadingSlash = (path: string) => (path.startsWith("/") ? path : `/${path}`);
const isAbsoluteUrl = (path: string) => /^https?:\/\//i.test(path);

export const resolveApiUrl = (path: string): string => {
  if (isAbsoluteUrl(path)) {
    return path;
  }
  const normalized = ensureLeadingSlash(path);
  const resolved = API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    console.log(`[api] Resolved URL: ${path} -> ${resolved}`);
  }
  return resolved;
};

const looksLikeJson = (payload: string): boolean => {
  const trimmed = payload.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
};

const isBodyInit = (value: unknown): value is BodyInit => {
  if (value == null) return false;
  if (typeof value === "string") return true;

  if (typeof Blob !== "undefined" && value instanceof Blob) return true;
  if (typeof FormData !== "undefined" && value instanceof FormData) return true;
  if (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) return true;
  if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) return true;
  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value)) return true;
  if (typeof ReadableStream !== "undefined" && value instanceof ReadableStream) return true;

  return false;
};

const extractErrorPayload = async (
  response: Response
): Promise<{ message: string; details?: unknown }> => {
  const fallback = `API request failed with status ${response.status}`;
  let message = fallback;
  let details: unknown;

  try {
    const json = await response.clone().json();
    details = json;

    if (typeof json === "string" && json) {
      message = json;
    } else if (json && typeof json === "object") {
      if ("message" in json && typeof json.message === "string") {
        message = json.message;
      } else if ("error" in json && typeof json.error === "string") {
        message = json.error;
      }
    }
  } catch {
    // Ignore JSON parsing errors and fall back to text/ status message below.
  }

  if (message === fallback) {
    try {
      const text = await response.clone().text();
      if (text) {
        message = text;
        if (details === undefined) {
          details = text;
        }
      }
    } catch {
      // Ignore text parsing errors.
    }
  }

  return { message, details };
};

const parseSuccessfulResponse = async <T>(response: Response, parseJson: boolean): Promise<T> => {
  if (!parseJson) {
    return undefined as T;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();

  if (!raw) {
    return undefined as T;
  }

  if (contentType.includes("application/json") || looksLikeJson(raw)) {
    try {
      return JSON.parse(raw) as T;
    } catch {
      console.warn("[api] Failed to parse JSON response. Returning raw text instead.");
    }
  }

  return raw as unknown as T;
};

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  parseJson?: boolean;
}

export async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, headers, credentials, parseJson = true, method = "GET", ...rest } = options;

  const url = resolveApiUrl(path);
  const headersInit = new Headers(headers);

  const init: RequestInit = {
    method,
    credentials: credentials ?? "include",
    ...rest,
    headers: headersInit,
  };

  if (body !== undefined && body !== null) {
    if (isBodyInit(body)) {
      init.body = body;
    } else {
      if (!headersInit.has("Content-Type")) {
        headersInit.set("Content-Type", "application/json");
      }
      init.body = JSON.stringify(body);
    }
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    const { message, details } = await extractErrorPayload(response);
    throw new ApiError(message, response.status, details);
  }

  return parseSuccessfulResponse<T>(response, parseJson);
}

type RequestConfig = Omit<ApiRequestOptions, "method">;
type RequestConfigWithBody = Omit<ApiRequestOptions, "method" | "body">;

export const api = {
  request,
  get: <T>(path: string, options?: RequestConfig) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestConfigWithBody) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestConfigWithBody) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestConfigWithBody) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestConfig) =>
    request<T>(path, { ...options, method: "DELETE" }),
  deleteWithBody: <T>(path: string, body?: unknown, options?: RequestConfigWithBody) =>
    request<T>(path, { ...options, method: "DELETE", body }),
  head: <T>(path: string, options?: RequestConfig) =>
    request<T>(path, { ...options, method: "HEAD", parseJson: false }),
};