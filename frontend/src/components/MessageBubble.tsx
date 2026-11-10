import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ChatMessage } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
export function verdictTone(validation:string|undefined):'ok'|'warn'|'muted'{
 const first=(validation??'').split('\n')[0].toUpperCase();
 if(first.includes('UNSUPPORTED')||first.includes('PARTIALLY'))return 'warn';
 return first.includes('SUPPORTED')?'ok':'muted';
}
export function MessageBubble({msg}:{msg:ChatMessage}){
 const [copy,setCopy]=useState('');
 if(msg.role==='user')return <div className="message message-user">{msg.text}</div>;
 const tone=verdictTone(msg.validation);
 return <article className="message message-assistant">
  {msg.error?<p className="error" role="alert">{msg.text}</p>:<>
   <MarkdownRenderer text={msg.text}/>
   <div className="actions"><span className={'badge badge-'+(tone==='ok'?'success':tone==='warn'?'warn':'default')}>{(msg.validation??'Validation unavailable').split('\n')[0]}</span>
   <button aria-label="Copy response" onClick={()=>{void navigator.clipboard.writeText(msg.text).then(()=>setCopy('Copied')).catch(()=>setCopy('Copy unavailable'));}}><Copy size={14}/>{copy||'Copy'}</button></div>
   {msg.validation&&<details><summary>{tone==='warn'?'Validation detail':'How this answer was checked'}</summary><pre>{msg.validation}</pre></details>}
   {msg.citations?.length?<details className="sources"><summary>Sources ({msg.citations.length})</summary><ol className="evidence-list">{msg.citations.map((c,i)=><li key={c.chunk_id}><Link className="citation-chip" to={'/knowledge/chunks?chunk='+encodeURIComponent(c.chunk_id)+'&document='+encodeURIComponent(c.doc_id)} aria-label={'Open source passage '+(i+1)}><strong>[{i+1}] {c.filename}{c.page?' · p. '+c.page:''}</strong><blockquote>{c.excerpt}</blockquote><small>Chunk {c.chunk_id}</small></Link></li>)}</ol></details>:!!msg.sources?.length&&<details><summary><span>Cited evidence</span> <span className="badge">{msg.sources.length}</span></summary><ol className="evidence-list">{msg.sources.map((s,i)=><li key={i}><Link className="citation-chip" to={'/knowledge/chunks?q='+encodeURIComponent(s)} aria-label={'Open source passage '+(i+1)}><span>Source {i+1}</span><blockquote>{s}</blockquote></Link></li>)}</ol></details>}
  </>}
 </article>;
}
