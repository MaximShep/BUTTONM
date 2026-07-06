import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentPropsWithoutRef<"label">) {
  return (
    <label className={cn("block text-sm font-normal text-slate-700", className)} {...props} />
  );
}

export function Input({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return (
    <input
      className={cn(
        "mt-2 h-11 w-full rounded-xl bg-white px-4 text-sm text-slate-900 outline-none transition-shadow placeholder:text-slate-400 focus:ring-4 focus:ring-slate-200",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea
      className={cn(
        "mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition-shadow placeholder:text-slate-400 focus:ring-4 focus:ring-slate-200",
        className,
      )}
      {...props}
    />
  );
}
