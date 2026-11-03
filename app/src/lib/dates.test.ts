import { dayKey, isDueSoon, isOverdue, monthGrid } from './dates'

const now = new Date('2026-11-03T12:00:00Z')

describe('dates', () => {
  it('detects overdue deadlines', () => {
    expect(isOverdue('2026-11-03T11:00:00Z', now)).toBe(true)
    expect(isOverdue('2026-11-03T13:00:00Z', now)).toBe(false)
  })

  it('detects deadlines due soon but not past ones', () => {
    expect(isDueSoon('2026-11-05T12:00:00Z', 3, now)).toBe(true)
    expect(isDueSoon('2026-11-10T12:00:00Z', 3, now)).toBe(false)
    expect(isDueSoon('2026-11-01T12:00:00Z', 3, now)).toBe(false)
  })

  it('builds a Monday-first month grid padded to full weeks', () => {
    // November 2026 starts on a Sunday -> 6 leading blanks, 30 days, padded to 5 weeks
    const cells = monthGrid(2026, 10)
    expect(cells.length % 7).toBe(0)
    expect(cells.slice(0, 6).every((c) => c === null)).toBe(true)
    expect(cells[6]?.getDate()).toBe(1)
    expect(cells.filter(Boolean)).toHaveLength(30)
  })

  it('formats a local day key', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
