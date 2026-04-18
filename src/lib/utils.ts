import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Fungsi bawaan shadcn (sudah ada, jangan hapus)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Tambahkan fungsi-fungsi ini:

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  const d = new Date(date)
  
  if (isNaN(d.getTime())) return '-'
  
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format database snake_case/lowercase values to human-readable labels.
 * e.g. "belum_bayar" → "Belum Bayar", "menunggu_verifikasi" → "Menunggu Verifikasi"
 */
export function formatLabel(value: string | null | undefined): string {
  if (!value) return '-'
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Calculate attendance percentage using weighted formula:
 * ((Hadir * 1) + (Izin * 0.5) + (Alpha * 0)) / Total * 100
 */
export function calcAttendancePercentage(hadir: number, izin: number, alpha: number): number {
  const total = hadir + izin + alpha
  if (total === 0) return 0
  return (hadir + (izin * 0.5)) / total * 100
}

/**
 * Get color class based on attendance percentage
 * 100%-75% → green, 74.9%-65% → yellow, 64.9%-50% → orange, <50% → red
 */
export function getAttendanceColor(percentage: number): string {
  if (percentage >= 75) return 'text-green-600'
  if (percentage >= 65) return 'text-yellow-600'
  if (percentage >= 50) return 'text-orange-600'
  return 'text-red-600'
}

export function getAttendanceBgColor(percentage: number): string {
  if (percentage >= 75) return 'bg-green-100 text-green-800'
  if (percentage >= 65) return 'bg-yellow-100 text-yellow-800'
  if (percentage >= 50) return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

/**
 * Calculate the average of an array of numbers
 */
export function calcAverage(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}