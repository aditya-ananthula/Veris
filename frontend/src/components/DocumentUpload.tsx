import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { clearKnowledgeCache } from '../hooks/useKnowledgeData';
import { UploadDropzone } from './UploadDropzone';
import type { Capabilities } from '../types';
export function DocumentUpload({ sessionId, onComplete }: { sessionId:string; onComplete?:()=>void|Promise<void> }) {
  const [caps,setCaps]=useState<Capabilities>();
  const [capsError,setCapsError]=useState('');
  const [revision,setRevision]=useState(0);
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState({ done:0,total:0,current:'' });
  const [results,setResults]=useState<{name:string;error:boolean;text:string}[]>([]);
  useEffect(()=>{let active=true;api.capabilities().then(c=>{if(active){setCaps(c);setCapsError('');}}).catch(e=>{if(active)setCapsError(e.message);});return()=>{active=false;};},[revision]);
  const upload=async(files:File[])=>{
    if(!sessionId||busy||!caps)return;
    setBusy(true);setResults([]);setProgress({done:0,total:files.length,current:''});
    for(let i=0;i<files.length;i++){
      const f=files[i];setProgress({done:i,total:files.length,current:f.name});
      try{
        const ext='.'+(f.name.split('.').pop()??'').toLowerCase();
        if(!caps.supported_extensions.includes(ext))throw new Error('Unsupported format.');
        if(f.size>caps.max_upload_bytes)throw new Error('File exceeds '+caps.max_upload_mb+' MB.');
        const r=await api.absorb(f,sessionId);
        setResults(prev=>[...prev,{name:f.name,error:false,text:r.chunks_added+' chunks indexed. See Documents for analysis status.'}]);
      }catch(e){setResults(prev=>[...prev,{name:f.name,error:true,text:e instanceof Error?e.message:'Upload failed.'}]);}
      setProgress({done:i+1,total:files.length,current:''});
    }
    clearKnowledgeCache(sessionId);setBusy(false);await onComplete?.();
  };
  return <div>
    {capsError?<div role="alert" className="status error">{capsError}<button onClick={()=>setRevision(r=>r+1)}>Retry upload configuration</button></div>:caps?<UploadDropzone accept={caps.supported_extensions.join(', ')} maxMb={caps.max_upload_mb} disabled={busy||!sessionId} onFiles={files=>void upload(files)}/>:<div role="status" className="loading-state">Preparing upload…<div className="skeleton"/></div>}
    {(busy||results.length>0)&&<div className="upload-feedback" aria-live="polite">
      {busy&&<><span>Processing {progress.current} · {progress.done} of {progress.total} files complete</span><progress value={progress.done} max={progress.total} aria-label="Files processed"/></>}
      {results.map((r,i)=><div className={r.error?'error':''} key={i}><strong>{r.name}</strong>: {r.text}{r.error&&' Select the file again to retry.'}</div>)}
    </div>}
  </div>;
}
