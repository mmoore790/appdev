import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { ApiError, request as sendApiRequest } from "./api";

type ApiRequestInput = string | { method: string; url?: string; data?: unknown };
type ApiRequestOptions = { method?: string; data?: unknown };

const hasWindow = typeof window !== "undefined";

export async function apiRequest<T = unknown>(
  urlOrOptions: ApiRequestInput,
  optionsOrData?: ApiRequestOptions | unknown,
  maybeData?: unknown
): Promise<T> {
  let method: string;
  let url: string | undefined;
  let data: unknown | undefined;

  if (typeof urlOrOptions === "string") {
    if (typeof optionsOrData === "string") {
      url = optionsOrData;
      method = urlOrOptions;
      data = maybeData;
    } else {
      url = urlOrOptions;
      const options = (optionsOrData as ApiRequestOptions) ?? {};
      method = options.method ?? "GET";
      data = options.data;
    }
  } else {
    const options = urlOrOptions;
    method = options.method;
    url = options.url;
    data = options.data;
  }

  if (!url) {
    throw new Error("apiRequest requires a URL.");
  }

  const authToken = hasWindow ? localStorage.getItem("authToken") : null;

  const headers: Record<string, string> = {};
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  console.log(`[API Request] ${method} ${url} with data:`, data);

  try {
    const result = await sendApiRequest<T | undefined>(url, {
      method,
      body: data,
      headers: Object.keys(headers).length ? headers : undefined,
    });

    const normalizedResult = (result === undefined ? ({} as T) : (result as T));
    console.log(`[API Response] ${method} ${url} response:`, normalizedResult);
    return normalizedResult;
  } catch (error) {
    console.error(`[API Error] ${method} ${url} failed:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn = <T>({
  on401: unauthorizedBehavior,
}: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> => {
  return async ({ queryKey }) => {
    // Build endpoint from query key parts
    // queryKey[0] is the base endpoint, queryKey[1+], etc. are path parameters
    let endpoint = queryKey[0] as string;
    
    // Append additional query key parts as path segments
    for (let i = 1; i < queryKey.length; i++) {
      const part = queryKey[i];
      if (part != null && part !== '') {
        endpoint = `${endpoint}/${encodeURIComponent(String(part))}`;
      }
    }

    const authToken = hasWindow ? localStorage.getItem("authToken") : null;

    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
      if (typeof window !== "undefined" && endpoint === "/api/auth/me") {
        console.log("[Auth] Sending token in Authorization header for /api/auth/me");
      }
    } else {
      if (typeof window !== "undefined" && endpoint === "/api/auth/me") {
        console.log("[Auth] No token found in localStorage for /api/auth/me");
      }
    }

    try {
      return await sendApiRequest<T>(endpoint, {
        method: "GET",
        headers: Object.keys(headers).length ? headers : undefined,
        credentials: "include", // Ensure cookies are sent cross-origin
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && unauthorizedBehavior === "returnNull") {
        return null as T;
      }
      throw error;
    }
  };
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
