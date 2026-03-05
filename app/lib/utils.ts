import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Primeira letra de cada palavra maiúscula, resto minúscula */
export function toTitleCase(str: string): string {
	const s = (str ?? "").trim();
	if (!s) return "";
	return s
		.toLowerCase()
		.split(/\s+/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

/** Parse YYYY-MM-DD string to Date at local midnight */
export function parseLocalDate(str: string): Date {
	const [y, m, d] = str.split("-").map(Number);
	return new Date(y, (m ?? 1) - 1, d ?? 1);
}
