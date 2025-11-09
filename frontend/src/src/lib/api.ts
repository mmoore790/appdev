// This new file is frontend/src/src/lib/api.ts

import 'dotenv/config';

// Get the API base URL from the environment
const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!VITE_API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not set. Check your frontend/.env.local file.");
}

/**
 * A custom fetch wrapper for making API requests.
 */
export const api = {
  get: async <T>(path: string): Promise<T> => {
    const res = await fetch(`${VITE_API_BASE_URL}${path}`, {
      method: 'GET',
      credentials: 'include', // Important for sessions
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `API request failed with status ${res.status}`);
    }
    return res.json() as T;
  },

  post: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetch(`${VITE_API_BASE_URL}${path}`, {
      method: 'POST',
      credentials: 'include', // Important for sessions
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `API request failed with status ${res.status}`);
    }
    return res.json() as T;
  }
};