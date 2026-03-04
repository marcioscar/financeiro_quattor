import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Parse YYYY-MM-DD string to Date at local midnight */
export function parseLocalDate(str: string): Date {
	const [y, m, d] = str.split("-").map(Number);
	return new Date(y, (m ?? 1) - 1, d ?? 1);
}
