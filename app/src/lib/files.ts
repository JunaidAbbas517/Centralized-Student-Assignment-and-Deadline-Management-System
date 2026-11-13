import { supabase } from './supabase'
import type { Assignment } from './types'

export const ASSIGNMENT_BUCKET = 'assignment-files'
export const SUBMISSION_BUCKET = 'submissions'

/** File-type choices an instructor can tick. Each maps to the extensions it allows. */
export const FILE_GROUPS: { id: string; label: string; ext: string[] }[] = [
  { id: 'pdf', label: 'PDF', ext: ['pdf'] },
  { id: 'image', label: 'Images (PNG, JPG)', ext: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
  { id: 'zip', label: 'ZIP archives', ext: ['zip', 'rar', '7z'] },
  { id: 'word', label: 'Word', ext: ['doc', 'docx'] },
  { id: 'slides', label: 'PowerPoint', ext: ['ppt', 'pptx'] },
  { id: 'sheet', label: 'Excel / CSV', ext: ['xls', 'xlsx', 'csv'] },
  { id: 'code', label: 'Code and text', ext: ['txt', 'md', 'py', 'ipynb', 'java', 'c', 'cpp', 'js', 'ts', 'html', 'css', 'sql'] },
]

export function extensionsFor(groupIds: string[]): string[] {
  return [...new Set(FILE_GROUPS.filter((g) => groupIds.includes(g.id)).flatMap((g) => g.ext))]
}

export function fileExt(name: string): string {
  const m = name.match(/\.([A-Za-z0-9]+)$/)
  return m ? m[1].toLowerCase() : ''
}

/** Storage keys only allow a safe character set; the original name is stored separately. */
export function safeFileName(name: string): string {
  const ext = fileExt(name)
  const base = (ext ? name.slice(0, -(ext.length + 1)) : name)
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80) || 'file'
  return ext ? `${base}.${ext}` : base
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** "PDF, PNG, JPG" or "Any file type". */
export function describeExtensions(exts: string[]): string {
  return exts.length === 0 ? 'Any file type' : exts.map((e) => e.toUpperCase()).join(', ')
}

/** Value for <input accept>; undefined allows anything. */
export function acceptAttr(exts: string[]): string | undefined {
  return exts.length === 0 ? undefined : exts.map((e) => `.${e}`).join(',')
}

type Rules = Pick<Assignment, 'allowed_extensions' | 'max_file_mb' | 'max_files'>

/** Client-side check before uploading. The server repeats every check in submit_assignment(). */
export function validateFiles(files: { name: string; size: number }[], rules: Rules): string | null {
  if (files.length > rules.max_files) return `You can attach at most ${rules.max_files} ${rules.max_files === 1 ? 'file' : 'files'}.`
  for (const f of files) {
    if (rules.allowed_extensions.length > 0 && !rules.allowed_extensions.includes(fileExt(f.name))) {
      return `${f.name} is not an accepted file type. Accepted: ${describeExtensions(rules.allowed_extensions)}.`
    }
    if (f.size > rules.max_file_mb * 1024 * 1024) return `${f.name} is larger than ${rules.max_file_mb} MB.`
    if (f.size === 0) return `${f.name} is empty.`
  }
  return null
}

export function isValidLink(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim())
}

/** Opens a private file in a new tab using a short-lived signed link. */
export async function openStoredFile(bucket: string, path: string, download?: string): Promise<string | null> {
  // Open the tab during the click; browsers block window.open after an await.
  // Downloads need no tab: an attachment response leaves the current page in place.
  const tab = download ? null : window.open('about:blank', '_blank')
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300, download ? { download } : undefined)
  if (error || !data) {
    tab?.close()
    return error?.message ?? 'Could not open the file.'
  }
  if (tab) {
    tab.opener = null
    tab.location.href = data.signedUrl
  } else window.location.assign(data.signedUrl)
  return null
}

export async function uploadFile(bucket: string, path: string, file: File): Promise<string | null> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  return error ? `${file.name}: ${error.message}` : null
}
