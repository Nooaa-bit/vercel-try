import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({
  className,
  size = "md",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-2",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "animate-spin rounded-full border-solid border-current border-r-transparent",
          sizeClasses[size],
          "text-pulse-500"
        )}
        role="status"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}
