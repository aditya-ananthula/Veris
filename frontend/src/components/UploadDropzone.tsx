import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
export function UploadDropzone({ accept, maxMb, onFiles, disabled }: { accept:string; maxMb:number; onFiles:(files:File[])=>void; disabled?:boolean }) {
  const [drag,setDrag]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  return <div className="upload-zone" data-drag={drag} aria-disabled={disabled} role="button" tabIndex={disabled?-1:0} aria-label="Upload documents"
    onClick={()=>{if(!disabled)input.current?.click();}}
    onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&!disabled){e.preventDefault();input.current?.click();}}}
    onDragOver={e=>{e.preventDefault();if(!disabled)setDrag(true);}} onDragLeave={()=>setDrag(false)}
    onDrop={e=>{e.preventDefault();setDrag(false);if(!disabled)onFiles(Array.from(e.dataTransfer.files));}}>
    <UploadCloud size={40}/><strong>{disabled?'Processing documents…':'Drop your documents here'}</strong><span className="veris-btn-primary">Browse Files</span><small>{accept.replace(/\./g,'').toUpperCase()} · up to {maxMb} MB per file</small>
    <input ref={input} type="file" hidden multiple accept={accept} disabled={disabled} onClick={e=>e.stopPropagation()} onChange={e=>{onFiles(Array.from(e.target.files??[]));e.target.value='';}}/>
  </div>;
}
