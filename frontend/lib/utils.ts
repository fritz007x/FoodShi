import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatNumber(num: number, decimals = 2): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(decimals)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(decimals)}K`;
  }
  return num.toFixed(decimals);
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatRelativeTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return formatDate(date);
  }
  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return 'Just now';
}

export function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export const MEDAL_COLORS = {
  bronze: {
    bg: 'bg-amber-600',
    text: 'text-amber-600',
    border: 'border-amber-600',
  },
  silver: {
    bg: 'bg-gray-400',
    text: 'text-gray-400',
    border: 'border-gray-400',
  },
  gold: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-500',
    border: 'border-yellow-500',
  },
  platinum: {
    bg: 'bg-cyan-400',
    text: 'text-cyan-400',
    border: 'border-cyan-400',
  },
};

export const MEDAL_REQUIREMENTS = {
  bronze: { days: 30, donations: 20, burn: 50 },
  silver: { days: 90, donations: 70, burn: 150 },
  gold: { days: 180, donations: 150, burn: 300 },
  platinum: { days: 365, donations: 320, burn: 500 },
};
