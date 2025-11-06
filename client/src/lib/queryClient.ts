import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // Try to parse as JSON first to get detailed error
      const errorData = await res.json();
      if (errorData && typeof errorData === 'object' && 'message' in errorData) {
        throw new Error(errorData.message);
      } else {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
    } catch (jsonError) {
      // If JSON parsing fails, try to get text
      try {
        const text = await res.text();
        throw new Error(`${res.status}: ${text || res.statusText}`);
      } catch (textError) {
        // If all else fails
        throw new Error(`${res.status}: ${res.statusText}`);
      }
    }
  }
}

export async function apiRequest(
  urlOrOptions: string | { method: string; url?: string; data?: unknown },
  optionsOrData?: { method?: string; data?: unknown } | unknown,
  maybeData?: unknown
): Promise<any> {
  let method: string;
  let url: string;
  let data: unknown | undefined;
  
  // Handle different parameter formats
  if (typeof urlOrOptions === 'string') {
    // Old format: apiRequest(method, url, data)
    if (typeof optionsOrData === 'string') {
      url = optionsOrData;
      method = urlOrOptions;
      data = maybeData;
    } else {
      // Format: apiRequest(url, options)
      url = urlOrOptions;
      const options = optionsOrData as { method?: string; data?: unknown } || {};
      method = options.method || 'GET';
      data = options.data;
    }
  } else {
    // New format: apiRequest({ url, method, data })
    const options = urlOrOptions;
    method = options.method;
    url = options.url || '';
    data = options.data;
  }
  
  // Get auth token from localStorage if available
  const authToken = localStorage.getItem('authToken');
  
  // Prepare headers with token if available
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  console.log(`[API Request] ${method} ${url} with data:`, data);

  try {
    const res = await fetch(url, {
      method: method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    // If status is OK but no content, return empty object
    if (res.status === 204) {
      return {};
    }

    // Check for client or server errors
    if (!res.ok) {
      await throwIfResNotOk(res);
    }

    // Parse JSON response, with error handling
    try {
      const jsonResponse = await res.json();
      console.log(`[API Response] ${method} ${url} response:`, jsonResponse);
      return jsonResponse;
    } catch (jsonError) {
      console.error(`[API Error] Failed to parse JSON response from ${method} ${url}:`, jsonError);
      throw new Error('Invalid JSON response from server');
    }
  } catch (fetchError: any) {
    console.error(`[API Error] ${method} ${url} failed:`, fetchError);
    throw fetchError;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get auth token from localStorage if available
    const authToken = localStorage.getItem('authToken');
    
    // Prepare headers with token if available
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
