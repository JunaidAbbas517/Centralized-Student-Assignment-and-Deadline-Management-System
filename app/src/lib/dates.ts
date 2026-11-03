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

/** <input type="datetime-local"> value -> ISO string (local time interpreted). */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString()
}
