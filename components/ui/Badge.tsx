import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-normal text-slate-600",
        className,
      )}
      {...props}
    />
  );
}
