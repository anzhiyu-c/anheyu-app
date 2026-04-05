"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success";
  size?: "default" | "sm" | "lg";
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantStyles = {
      default: "bg-primary text-primary-foreground",
      secondary: "bg-secondary text-secondary-foreground",
      destructive: "bg-red text-white",
      outline: "border border-border bg-transparent text-foreground",
      success: "bg-green text-white",
    };

    const sizeStyles = {
      default: "px-2.5 py-0.5 text-xs",
      sm: "px-2 py-0.5 text-[10px]",
      lg: "px-3 py-1 text-sm",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full font-medium",
          "transition-colors duration-200",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
