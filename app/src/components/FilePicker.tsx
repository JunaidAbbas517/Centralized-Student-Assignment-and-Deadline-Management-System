import { useRef, useState, type DragEvent } from 'react'
import { CloudUpload, File as FileIcon, X } from 'lucide-react'
import { acceptAttr, describeExtensions, formatBytes, validateFiles } from '../lib/files'

interface Props {
  files: File[]
  onChange: (files: File[]) => void
  allowedExtensions: string[]
  maxFileMb: number
  maxFiles: number
  disabled?: boolean
}

export default function FilePicker({ files, onChange, allowedExtensions, maxFileMb, maxFiles, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rules = { allowed_extensions: allowedExtensions, max_file_mb: maxFileMb, max_files: maxFiles }

  function add(list: FileList | null) {
    if (!list || list.length === 0) return
    const next = [...files]
    for (const f of Array.from(list)) {
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f)
    }
    const problem = validateFiles(next, rules)
    setError(problem)
    if (!problem) onChange(next)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (!disabled) add(e.dataTransfer.files)
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled && (e.preventDefault(), inputRef.current?.click())}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`tap flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? 'border-indigo-400 bg-indigo-50/70' : 'border-slate-300 bg-slate-50/60 hover:border-indigo-300 hover:bg-white'
        } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <CloudUpload size={22} className="text-indigo-600" aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-800">Drop files here or click to browse</p>
        <p className="font-mono text-[11px] text-slate-500">
          {describeExtensions(allowedExtensions)} · up to {maxFileMb} MB each · max {maxFiles} {maxFiles === 1 ? 'file' : 'files'}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple={maxFiles > 1}
          accept={acceptAttr(allowedExtensions)}
          className="hidden"
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}`} className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-inset ring-slate-200">
              <FileIcon size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{f.name}</span>
              <span className="tnum font-mono text-[11px] text-slate-500">{formatBytes(f.size)}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${f.name}`}
                className="tap rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-700"
                onClick={() => {
                  setError(null)
                  onChange(files.filter((_, j) => j !== i))
                }}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
