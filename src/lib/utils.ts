import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** ترکیب کلاس‌های Tailwind با ادغام هوشمند تعارض‌ها */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
