const DAY_MS = 24 * 60 * 60 * 1000

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function isOverdue(deadlineIso: string, now: Date = new Date()): boolean {
  return new Date(deadlineIso).getTime() < now.getTime()
}

/** Due within the next `days` days (and not already past). */
export function isDueSoon(deadlineIso: string, days = 3, now: Date = new Date()): boolean {
  const diff = new Date(deadlineIso).getTime() - now.getTime()
  return diff >= 0 && diff <= days * DAY_MS
}

/** Local calendar-day key, e.g. "2026-11-03". Used to place deadlines on the calendar. */
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Cells for a Monday-first month grid; null = padding cell. */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const count = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= count; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** Monday-first month grid that includes the neighbouring months' days. */
export function monthGridFull(year: number, month: number): Date[] {
  return monthGrid(year, month).map((cell, i, all) => {
    if (cell) return cell
    const lead = all.findIndex((c) => c !== null)
    return new Date(year, month, 1 - (lead - i))
  })
}

/** <input type="datetime-local"> value -> ISO string (local time interpreted). */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString()
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Whole calendar days from today to the deadline's day (negative = past). */
export function daysFromToday(iso: string, now: Date = new Date()): number {
  return Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(now).getTime()) / DAY_MS)
}

export function relativeLabel(iso: string, now: Date = new Date()): { text: string; overdue: boolean } {
  const d = daysFromToday(iso, now)
  if (d < 0) return { text: `${-d} day${d === -1 ? '' : 's'} overdue`, overdue: true }
  if (d === 0) return isOverdue(iso, now) ? { text: 'overdue today', overdue: true } : { text: 'today', overdue: false }
  if (d === 1) return { text: 'tomorrow', overdue: false }
  return { text: `in ${d} days`, overdue: false }
}

/** Monday..Sunday of the week containing `now`. */
export function weekDays(now: Date = new Date()): Date[] {
  const start = startOfDay(now)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const time = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
const dayMonth = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const weekday = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short' })

/** "Thu 5 Nov, 23:59" */
export function formatShort(iso: string): string {
  const d = new Date(iso)
  return `${weekday(d)} ${dayMonth(d)}, ${time(d)}`
}

/** "Mon 16 Nov 2026, 23:59" */
export function formatFull(iso: string): string {
  const d = new Date(iso)
  return `${weekday(d)} ${dayMonth(d)} ${d.getFullYear()}, ${time(d)}`
}

/** "12 Nov" */
export function formatDay(iso: string): string {
  return dayMonth(new Date(iso))
}

/** "12 Nov, 23:59" */
export function formatDayTime(iso: string): string {
  const d = new Date(iso)
  return `${dayMonth(d)}, ${time(d)}`
}

/** "3 Nov 2026, 15:40" */
export function formatStamp(iso: string): string {
  const d = new Date(iso)
  return `${dayMonth(d)} ${d.getFullYear()}, ${time(d)}`
}

/** "Tuesday, 3 November 2026" */
export function formatLongDate(d: Date = new Date()): string {
  const w = d.toLocaleDateString('en-GB', { weekday: 'long' })
  const rest = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return `${w}, ${rest}`
}

const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime()

/** "today at 15:40" or "on 2 Nov" */
export function whenPhrase(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  return sameDay(d, now) ? `today at ${time(d)}` : `on ${dayMonth(d)}`
}

/** "Today, 15:40" or "Mon 2 Nov" */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  return sameDay(d, now) ? `Today, ${time(d)}` : `${weekday(d)} ${dayMonth(d)}`
}
