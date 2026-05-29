import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | null | undefined) {
  if (!dateString) return '';
  
  if (typeof dateString === 'string' && dateString.includes('-')) {
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
    } catch (e) {
      return dateString;
    }
  }
  
  return new Date(dateString).toLocaleDateString('pt-BR');
}

export function parseLocalDate(dateString: string | null | undefined) {
  if (!dateString) return new Date();
  if (typeof dateString !== 'string') return new Date(dateString);
  
  const parts = dateString.split('-');
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const day = parts[2] ? parseInt(parts[2]) : 1;
  
  return new Date(year, month, day);
}

export function getDaysInMonth(year: number, month: number) {
  // Date(year, month, 0) gives the last day of the month
  // Month is 1-indexed for this helper if we want to match the behavior of split('-')
  return new Date(year, month, 0).getDate();
}

export function getBusinessDaysInWindow(year: number, month: number, startDay: number = 1) {
  let count = 0;
  const daysInMonth = getDaysInMonth(year, month);
  for (let day = startDay; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }
  return count;
}

export function calculateDailyTarget(totalValue: number, dateString: string) {
  if (!dateString) return 0;
  const start = parseLocalDate(dateString);
  const year = start.getFullYear();
  const month = start.getMonth() + 1;
  const startDay = start.getDate();
  
  const businessDays = getBusinessDaysInWindow(year, month, startDay);
  return totalValue / Math.max(1, businessDays);
}

export function getBusinessDaysBetween(startDate: Date, endDate: Date) {
  let count = 0;
  let curDate = new Date(startDate.getTime());
  // Normalize time to avoid issues
  curDate.setHours(0, 0, 0, 0);
  const end = new Date(endDate.getTime());
  end.setHours(23, 59, 59, 999);
  
  while (curDate <= end) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
}
