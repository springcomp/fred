import type { ComponentProps } from "react";

interface BadgeProps extends ComponentProps<"span"> {
  variant?: "default" | "outline";
}

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  const base = "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  const variants = {
    default: "bg-primary text-primary-foreground",
    outline: "border border-border text-foreground",
  };
  return <span className={`${base} ${variants[variant]} ${className ?? ""}`} {...props} />;
}
