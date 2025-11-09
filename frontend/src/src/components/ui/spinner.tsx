interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  showLogo?: boolean;
  text?: string;
}

export function Spinner({ 
  size = "md", 
  className = "", 
  showLogo = true,
  text
}: SpinnerProps) {
  // Size classes for the spinner
  const sizeClasses = {
    sm: "h-8 w-8 border-2",
    md: "h-12 w-12 border-2",
    lg: "h-16 w-16 border-3",
  };
  
  // Size classes for the logo
  const logoSizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };
  
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative">
        <div className={`animate-spin rounded-full ${sizeClasses[size]} border-t-green-600 border-r-green-600 border-b-green-200 border-l-green-200`}>
        </div>
        
        {showLogo && (
          <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center">
          </div>
        )}
      </div>
      
      {text && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{text}</p>
      )}
    </div>
  );
}