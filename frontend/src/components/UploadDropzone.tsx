import { useCallback, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';

export function UploadDropzone({
  accept,
  maxMb,
  onFiles,
  disabled,
}: {
  accept: string;
  maxMb: number;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      onFiles(Array.from(list));
    },
    [onFiles],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (!disabled) handle(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) inputRef.current?.click();
      }}
      tabIndex={0}
      role="button"
      aria-label="Upload documents"
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-9 text-center transition-colors ${
        drag ? 'border-accent-400 bg-accent-500/10' : 'border-ink-700 bg-ink-900/40 hover:border-slate-600'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <UploadCloud size={26} className="text-accent-400" />
      <p className="text-sm text-slate-200">Drag &amp; drop files here, or click to browse</p>
      <p className="text-xs text-slate-400">
        {accept} · up to {maxMb} MB each
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
