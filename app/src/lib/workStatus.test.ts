import { describe, expect, it } from 'vitest'
import { deriveWork, isHandedIn, isOpen, nextStep } from './workStatus'

const now = new Date('2026-11-14T12:00:00Z')
const future = { current_deadline: '2026-11-20T12:00:00Z', allow_late: true, total_marks: 20 }
const past = { ...future, current_deadline: '2026-11-10T12:00:00Z' }
const sub = { attempt: 2, is_late: false, submitted_at: '2026-11-13T09:00:00Z' }

describe('deriveWork', () => {
  it('only "in progress" comes from the student; nothing they set means completed', () => {
    expect(deriveWork(future, undefined, undefined, undefined, now).state).toBe('not_started')
    expect(deriveWork(future, 'in_progress', undefined, undefined, now).state).toBe('in_progress')
    expect(deriveWork(future, 'completed', undefined, undefined, now).state).toBe('not_started')
  })

  it('a real submission means submitted, or submitted late', () => {
    expect(deriveWork(future, undefined, sub, undefined, now)).toMatchObject({ state: 'submitted', attempts: 2 })
    expect(deriveWork(past, undefined, { ...sub, is_late: true }, undefined, now).state).toBe('submitted_late')
  })

  it('a returned grade wins and carries the marks', () => {
    const w = deriveWork(future, undefined, sub, { marks: 17.5, returned_at: '2026-11-14T08:00:00Z' }, now)
    expect(w).toMatchObject({ state: 'graded', marks: 17.5, total: 20, gradedAt: '2026-11-14T08:00:00Z' })
  })

  it('past the deadline with nothing handed in is missing, or closed if late work is refused', () => {
    expect(deriveWork(past, 'in_progress', undefined, undefined, now).state).toBe('missing')
    expect(deriveWork({ ...past, allow_late: false }, undefined, undefined, undefined, now).state).toBe('closed')
  })

  it('groups states for lists and buttons', () => {
    expect(isHandedIn('submitted_late')).toBe(true)
    expect(isHandedIn('missing')).toBe(false)
    expect(isOpen('missing')).toBe(true)
    expect(isOpen('closed')).toBe(false)
    expect(nextStep('missing')).toBe('Submit late')
    expect(nextStep('graded')).toBe('View grade')
  })
})
