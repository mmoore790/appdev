import { useQuery, useQueryClient } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { resolveApiUrl } from "@/lib/api"; 

export function useAuth() {
  const queryClient = useQueryClient();
  
  // Query to fetch the current user from the server
  const { 
    data: user, 
    isLoading, 
    error 
  } = useQuery<User>({ 
    queryKey: ["/api/auth/me"],
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Helper function to log out the user
  const logout = async () => {
    try {
      // Clear auth token from localStorage
      localStorage.removeItem('authToken');
      
      // Make API request to log out
      const logoutUrl = resolveApiUrl('/api/auth/logout');
      await fetch(logoutUrl, {
        method: 'POST',
        credentials: 'include',
      });
      
      // Clear ALL queries to prevent data leakage between users
      // This ensures that when a new user logs in, they don't see the previous user's cached data
      queryClient.clear();
      
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout fails, clear the cache and redirect
      queryClient.clear();
      window.location.href = '/login';
    }
  };

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    logout,
  };
}

export default useAuth;