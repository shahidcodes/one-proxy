import * as React from "react";
import { cn } from "@/lib/utils";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}

export function Toast({ message, type = "info", onClose }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 rounded-lg p-4 shadow-lg text-sm",
      type === "success" && "bg-green-600 text-white",
      type === "error" && "bg-red-600 text-white",
      type === "info" && "bg-primary text-primary-foreground"
    )}>
      {message}
    </div>
  );
}
