import { useQuery, useQueryClient } from "@tanstack/react-query";
import { User } from "@shared/schema"; 

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
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      // Invalidate the user query to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.setQueryData(["/api/auth/me"], null);
      
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
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