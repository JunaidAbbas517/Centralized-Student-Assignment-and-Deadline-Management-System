import { describe, expect, it } from 'vitest'
import { describeExtensions, extensionsFor, fileExt, isValidLink, safeFileName, validateFiles } from './files'
import { formatMarks, submissionWindow } from './submissions'

const rules = { allowed_extensions: ['pdf', 'zip'], max_file_mb: 1, max_files: 2 }

describe('file rules', () => {
  it('reads extensions case-insensitively', () => {
    expect(fileExt('Report.FINAL.PDF')).toBe('pdf')
    expect(fileExt('Makefile')).toBe('')
  })

  it('makes storage-safe names but keeps the extension', () => {
    expect(safeFileName('My report (v2) ü.pdf')).toBe('My-report-v2-u.pdf')
    expect(safeFileName('???.zip')).toBe('file.zip')
  })

  it('maps chosen groups to extensions', () => {
    expect(extensionsFor(['pdf', 'image'])).toEqual(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'])
    expect(describeExtensions([])).toBe('Any file type')
  })

  it('rejects wrong type, oversize, empty and too many files', () => {
    expect(validateFiles([{ name: 'a.pdf', size: 10 }], rules)).toBeNull()
    expect(validateFiles([{ name: 'a.docx', size: 10 }], rules)).toMatch(/not an accepted file type/)
    expect(validateFiles([{ name: 'a.pdf', size: 2 * 1024 * 1024 }], rules)).toMatch(/larger than 1 MB/)
    expect(validateFiles([{ name: 'a.pdf', size: 0 }], rules)).toMatch(/empty/)
    expect(validateFiles([{ name: 'a.pdf', size: 1 }, { name: 'b.pdf', size: 1 }, { name: 'c.pdf', size: 1 }], rules)).toMatch(/at most 2 files/)
    expect(validateFiles([{ name: 'a.exe', size: 1 }], { ...rules, allowed_extensions: [] })).toBeNull()
  })

  it('accepts only http(s) links', () => {
    expect(isValidLink('https://github.com/x/y')).toBe(true)
    expect(isValidLink('javascript:alert(1)')).toBe(false)
    expect(isValidLink('github.com/x')).toBe(false)
  })
})

describe('submission window', () => {
  const now = new Date('2026-11-14T12:00:00Z')
  const future = { current_deadline: '2026-11-15T12:00:00Z', allow_late: true }
  const past = { current_deadline: '2026-11-13T12:00:00Z', allow_late: true }

  it('allows submitting and resubmitting before the deadline', () => {
    expect(submissionWindow(future, 0, false, now).open).toBe(true)
    expect(submissionWindow(future, 3, false, now).open).toBe(true)
  })

  it('allows one late submission only when late work is accepted', () => {
    expect(submissionWindow(past, 0, false, now)).toMatchObject({ open: true, late: true })
    expect(submissionWindow(past, 1, false, now).open).toBe(false)
    expect(submissionWindow({ ...past, allow_late: false }, 0, false, now).open).toBe(false)
  })

  it('closes once graded', () => {
    expect(submissionWindow(future, 1, true, now).open).toBe(false)
  })

  it('formats marks without trailing zeros', () => {
    expect(formatMarks(18)).toBe('18')
    expect(formatMarks(17.5)).toBe('17.5')
    expect(formatMarks(17.25)).toBe('17.25')
  })
})
