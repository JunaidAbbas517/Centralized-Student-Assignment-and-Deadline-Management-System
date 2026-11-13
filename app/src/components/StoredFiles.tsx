import { useState } from 'react'
import { Download, ExternalLink, FileArchive, FileImage, FileText, File as FileIcon } from 'lucide-react'
import { fileExt, formatBytes, openStoredFile } from '../lib/files'

const PREVIEWABLE = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'md'])

function iconFor(name: string) {
  const ext = fileExt(name)
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return FileImage
  if (['zip', 'rar', '7z'].includes(ext)) return FileArchive
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) return FileText
  return FileIcon
}

/** Private files: opens in the browser when it can (PDF, images), otherwise downloads. */
export default function StoredFiles({ bucket, files }: { bucket: string; files: { id: string; path: string; name: string; size: number }[] }) {
  const [error, setError] = useState<string | null>(null)
  if (files.length === 0) return null

  return (
    <div>
      <ul className="space-y-1.5">
        {files.map((f) => {
          const Icon = iconFor(f.name)
          const canPreview = PREVIEWABLE.has(fileExt(f.name))
          return (
            <li key={f.id} className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-inset ring-slate-200">
              <Icon size={16} className="shrink-0 text-indigo-600" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{f.name}</span>
              <span className="tnum font-mono text-[11px] text-slate-500">{formatBytes(f.size)}</span>
              {canPreview && (
                <button
                  type="button"
                  className="tap rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
                  aria-label={`Open ${f.name}`}
                  title="Open"
                  onClick={async () => setError(await openStoredFile(bucket, f.path))}
                >
                  <ExternalLink size={14} />
                </button>
              )}
              <button
                type="button"
                className="tap rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
                aria-label={`Download ${f.name}`}
                title="Download"
                onClick={async () => setError(await openStoredFile(bucket, f.path, f.name))}
              >
                <Download size={14} />
              </button>
            </li>
          )
        })}
      </ul>
      {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  )
}
