import type { ComponentProps } from "react";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={`text-xs leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className ?? "font-medium"}`}
      {...props}
    />
  );
}
