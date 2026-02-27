import type { ComponentProps } from "react";

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={`flex h-8 w-full rounded-md border border-border bg-background px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${className ?? ""}`}
      {...props}
    />
  );
}
