import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges conditional class strings and resolves conflicting Tailwind
 * utilities (e.g. `cn("px-2", condition && "px-4")` keeps only `px-4`) —
 * the standard `clsx` + `tailwind-merge` combo every component in
 * components/ui/ is built on. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
