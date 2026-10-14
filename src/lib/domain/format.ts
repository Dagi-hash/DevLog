import type { PercentVariance } from './calculations';

const MINUS = '−';

/** 135 → "2h 15m", 45 → "45m", 0 → "0m". */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? MINUS : '';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}

/** Signed minutes for variance cells: +20, −15, 0. */
export function formatSignedMinutes(minutes: number): string {
  if (minutes > 0) return `+${minutes}`;
  if (minutes < 0) return `${MINUS}${Math.abs(minutes)}`;
  return '0';
}

export function formatPercentVariance(v: PercentVariance): string {
  switch (v.kind) {
    case 'zero':
      return '0.0%';
    case 'unestimated':
      return 'Unestimated';
    case 'value': {
      const sign = v.value > 0 ? '+' : v.value < 0 ? MINUS : '';
      return `${sign}${Math.abs(v.value).toFixed(1)}%`;
    }
  }
}

/** Seconds → "01:23:45". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...opts });
}

export function formatLongDate(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Local calendar day key, e.g. "2026-10-14". */
export function localDayKey(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isSameLocalDay(iso: string, date: Date): boolean {
  return localDayKey(iso) === localDayKey(date);
}

/** "Today", "Yesterday", or "Mon 12 Oct". */
export function formatDayHeading(dayKey: string, now: Date): string {
  const today = localDayKey(now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (dayKey === today) return 'Today';
  if (dayKey === localDayKey(y)) return 'Yesterday';
  const [year, month, day] = dayKey.split('-').map(Number);
  const d = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Relative "last activity" text: "Just now", "3h ago", "Yesterday", "12 Oct". */
export function formatRelative(iso: string, now: Date): string {
  const diffMs = now.getTime() - Date.parse(iso);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && isSameLocalDay(iso, now)) return `${hours}h ago`;
  const key = localDayKey(iso);
  const heading = formatDayHeading(key, now);
  if (heading === 'Yesterday') return heading;
  return formatDate(iso);
}
