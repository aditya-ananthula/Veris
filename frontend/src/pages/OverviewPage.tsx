import { useEffect, useState } from 'react';
import { CloudUpload, Sparkles, Network, BarChart3, FileText, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { api } from '../services/api';
import { AiOrb } from '../components/AiOrb';
import '../components/AiOrb.css';
import type { IntelDocument } from '../types';

const actions = [
  { icon: CloudUpload, title: 'Upload documents', description: 'Add PDFs, DOCX, TXT and Markdown', to: '/documents' },
  { icon: Network, title: 'Explore knowledge', description: 'Explore passages, entities and connections', to: '/knowledge' },
  { icon: Sparkles, title: 'Ask questions', description: 'Get answers grounded in your sources', to: '/intelligence' },
  { icon: BarChart3, title: 'View insights', description: 'Understand your document collection', to: '/insights' },
];
export function OverviewPage() {
  const { sessionId } = useSession();
  const [docs, setDocs] = useState<IntelDocument[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    api.intelDocuments(sessionId).then(d => { if (active) setDocs(d); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionId]);
  return <section className="overview">
    <div className="hero">
      <div className="hero-copy"><h1>Turn your documents<br/>into <span className="text-gradient">intelligence.</span></h1>
        <p>Upload, explore, ask questions, compare sources, and uncover hidden connections — all in one place.</p>
        <div className="hero-actions"><Link to="/documents" className="veris-btn-primary"><CloudUpload size={20}/>Upload documents<ArrowRight size={18}/></Link><Link to="/intelligence" className="veris-btn-secondary"><Sparkles size={18}/>Ask a question<ArrowRight size={18}/></Link></div>
      </div><AiOrb size={290} className="hero-orb" />
    </div>
    <section className="panel getting-started"><div><h2><Sparkles size={18}/> Getting started</h2><p>Build understanding from the sources you trust.</p>
      <div className="capability-grid">{actions.map(a => <Link key={a.to} to={a.to} className="capability"><a.icon size={28}/><h3>{a.title}</h3><p>{a.description}</p><ArrowRight size={18}/></Link>)}</div>
    </div><div className="recent-activity"><h2>Recent documents <Link to="/documents">View all →</Link></h2>
      {loading ? <p role="status">Loading your collection…</p> : error ? <p role="alert">{error}</p> : docs.length ? docs.slice().sort((a,b) => (b.created_at ?? 0)-(a.created_at ?? 0)).slice(0,4).map(d => <Link className="activity-item" key={d.doc_id} to={'/documents?doc='+encodeURIComponent(d.doc_id)}><FileText size={20}/><span>{d.filename}<small>{d.extraction_status === 'complete' ? 'Analyzed' : d.extraction_status} · {d.chunks} chunks</small></span></Link>) : <p>No documents yet. Upload a source to get started.</p>}
    </div></section>
  </section>;
}