import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// Expected formatDate function
export function formatDate(date: Date): string {
  return date.toLocaleDateString(); // Or your preferred format
}
