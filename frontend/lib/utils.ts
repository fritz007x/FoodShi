import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns the URL only if it uses the HTTPS scheme, otherwise null.
 * Use before rendering any user-supplied image URL to prevent loading
 * attacker-controlled resources (IP leaks, tracking pixels, data: URIs).
 */
export function getSafeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}
