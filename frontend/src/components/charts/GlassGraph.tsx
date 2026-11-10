import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { FileText, Building2, User, Lightbulb, Tag, Box, Calendar, MapPin } from 'lucide-react';
import { useElementSize } from '../../hooks/useElementSize';
import { colorFor } from './knowledgeLayout';

export interface GlassNode { id: string; label: string; type: string; detail: string; size?: number }
export interface GlassEdge { id: string; source: string; target: string; label: string; evidence: string; weight?: number; directed?: boolean }

const icons: Record<string, typeof Tag> = {
  document: FileText,
  organization: Building2,
  org: Building2,
  person: User,
  concept: Lightbulb,
  technology: Box,
  product: Box,
  date: Calendar,
  location: MapPin,
};

export function graphPositions(nodes: GlassNode[], edges: GlassEdge[], width: number, height: number, layout = 'network') {
  const sorted = [...nodes].sort((a,b) => a.id.localeCompare(b.id));
  const p = new Map(sorted.map((n,i) => [n.id, {x: width/2 + Math.cos(i*2.399963)*Math.sqrt((i+1)/sorted.length)*width*.34, y: height/2 + Math.sin(i*2.399963)*Math.sqrt((i+1)/sorted.length)*height*.32}]));
  if (layout === 'circle') sorted.forEach((n,i) => p.set(n.id,{x:width/2+Math.cos(i*2*Math.PI/sorted.length-Math.PI/2)*(width/2-100),y:height/2+Math.sin(i*2*Math.PI/sorted.length-Math.PI/2)*(height/2-100)}));
  if (sorted.length === 1) p.set(sorted[0].id,{x:width/2,y:height/2});
  for (let step=0;step<180 && layout !== 'circle';step++) {
    const forces = new Map(sorted.map(n => [n.id,{x:0,y:0}]));
    for(let i=0;i<sorted.length;i++) for(let j=i+1;j<sorted.length;j++) {
      const a=p.get(sorted[i].id)!, b=p.get(sorted[j].id)!, dx=a.x-b.x,dy=a.y-b.y,d=Math.max(1,Math.hypot(dx,dy));
      const repulsion= Math.min(12, 1800/(d*d) + Math.max(0,175-d)*.12);
      const fa=forces.get(sorted[i].id)!,fb=forces.get(sorted[j].id)!;
      fa.x+=dx/d*repulsion;fa.y+=dy/d*repulsion;fb.x-=dx/d*repulsion;fb.y-=dy/d*repulsion;
    }
    edges.forEach(e => { const a=p.get(e.source),b=p.get(e.target);if(!a||!b)return;const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),f=(d-210)*.008;const fa=forces.get(e.source)!,fb=forces.get(e.target)!;fa.x+=dx/d*f;fa.y+=dy/d*f;fb.x-=dx/d*f;fb.y-=dy/d*f; });
    sorted.forEach(n => {const point=p.get(n.id)!,f=forces.get(n.id)!; point.x=Math.max(90,Math.min(width-90,point.x+f.x+(width/2-point.x)*.002));point.y=Math.max(64,Math.min(height-84,point.y+f.y+(height/2-point.y)*.002));});
  }
  // Expand the settled network to use the available canvas while keeping labels inside it.
  if (sorted.length > 2 && layout !== 'circle') {
    const points=[...p.values()], xs=points.map(v=>v.x),ys=points.map(v=>v.y);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    points.forEach(v=>{v.x=100+(v.x-minX)/Math.max(1,maxX-minX)*(width-200);v.y=65+(v.y-minY)/Math.max(1,maxY-minY)*(height-165);});
  }
  return p;
}

export function GlassGraph({ nodes, edges, selectedId, selectedEdgeId, onSelect, onEdgeSelect, query = '', type = 'all', layout = 'network', height: requestedHeight = 540 }: {
  nodes: GlassNode[]; edges: GlassEdge[]; selectedId?: string; selectedEdgeId?: string; onSelect?: (id: string) => void; onEdgeSelect?: (id: string) => void; query?: string; type?: string; layout?: 'network' | 'mindmap' | 'circle'; height?: number;
}) {
  const {ref,width} = useElementSize();
  const height = requestedHeight;
  const [page,setPage] = useState(0), [zoom,setZoom] = useState(1),[pan,setPan]=useState({x:0,y:0});
  const [layoutMode, setLayoutMode] = useState<'network' | 'circle'>(layout === 'circle' ? 'circle' : 'network');
  const drag=useRef<{x:number;y:number;px:number;py:number}|null>(null);
  const uid=useId().replace(/:/g,'');
  const [hoveredId, setHoveredId] = useState('');
  const activeId = hoveredId || selectedId;
  const activeEdge = edges.find(e => e.id === selectedEdgeId);
  const connectedIds = new Set<string>();
  if (activeId) { connectedIds.add(activeId); edges.forEach(e => { if (e.source === activeId) connectedIds.add(e.target); if (e.target === activeId) connectedIds.add(e.source); }); }
  else if (activeEdge) { connectedIds.add(activeEdge.source); connectedIds.add(activeEdge.target); }
  const matches=useMemo(()=>nodes.filter(n => (type==='all'||n.type===type)&&n.label.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.label.localeCompare(b.label)),[nodes,query,type]);
  const capacity=width<500?6:15, pages=Math.max(1,Math.ceil(matches.length/capacity)),current=Math.min(page,pages-1);
  useEffect(()=>{setPage(0);setZoom(1);setPan({x:0,y:0});},[query,type]);
  useEffect(() => { const index = matches.findIndex(n => n.id === selectedId); if (index >= 0) setPage(Math.floor(index / capacity)); }, [selectedId, matches, capacity]);
  const visible=useMemo(()=>matches.slice(current*capacity,(current+1)*capacity),[matches,current,capacity]);
  const links=useMemo(()=>{const ids=new Set(visible.map(n=>n.id));return edges.filter(e=>ids.has(e.source)&&ids.has(e.target));},[visible,edges]);
  const worldWidth=Math.max(width, width<500?620:width),worldHeight=height;
  const positions=useMemo(()=>graphPositions(visible,links,worldWidth,worldHeight,layoutMode),[visible,links,worldWidth,worldHeight,layoutMode]);
  const fit=Math.min(width/worldWidth,1);
  const reset=()=>{setZoom(1);setPan({x:0,y:0});};
  const isDocumentGraph = visible.length > 0 && visible.every(n => n.type === 'document');

  const labelBoxes: {x:number;y:number}[]=[];
  const labelPosition=(a:{x:number;y:number},b:{x:number;y:number},cx:number,cy:number) => {
    for(const t of [.5,.3,.7,.2,.8]) {
      const x=(1-t)**2*a.x+2*(1-t)*t*cx+t*t*b.x,y=(1-t)**2*a.y+2*(1-t)*t*cy+t*t*b.y;
      if([...positions.values()].some(p=>(Math.abs(x-p.x)<125&&Math.abs(y-p.y)<52)||(Math.abs(x-p.x)<175&&y>p.y+35&&y<p.y+104))||labelBoxes.some(p=>Math.abs(x-p.x)<180&&Math.abs(y-p.y)<32))continue;
      labelBoxes.push({x,y});return {x,y,show:true};
    }
    return {x:(a.x+b.x+2*cx)/4,y:(a.y+b.y+2*cy)/4,show:false};
  };

  return <div className="knowledge-glass knowledge-viz relative overflow-hidden">
    <div className="viz-meta">
      <span className="flex items-center gap-1.5">
        <strong>{matches.length}</strong> {isDocumentGraph ? 'sources' : 'entities'} · <strong>{edges.length}</strong> relationships
      </span>
      <div className="viz-controls">
        <button aria-pressed={layoutMode === 'network'} onClick={() => setLayoutMode('network')}>Network</button>
        <button aria-pressed={layoutMode === 'circle'} onClick={() => setLayoutMode('circle')}>Circle</button>
        <button aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(.4,z/1.2))}>−</button>
        <span className="font-mono text-xs text-violet-200">{Math.round(zoom*100)}%</span>
        <button aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(3,z*1.2))}>+</button>
        <button onClick={reset}>Fit to View</button>
      </div>
    </div>
    <div className="viz-canvas" ref={ref} style={{height}}>
      {!matches.length?<div className="visual-empty">No matches. Try another search or filter.</div>:<svg width={width} height={height} role="group" aria-label="Interactive knowledge graph" style={{touchAction:'none'}}
        onPointerDown={e=>{if((e.target as Element).closest('[role="button"]'))return;drag.current={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e=>{if(drag.current)setPan({x:drag.current.px+e.clientX-drag.current.x,y:drag.current.py+e.clientY-drag.current.y});}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
        <defs>
          <radialGradient id={uid+'glass'} cx="32%" cy="28%" r="68%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="35%" stopColor="currentColor" stopOpacity="0.2" />
            <stop offset="75%" stopColor="#15243c" stopOpacity="0.78" />
            <stop offset="100%" stopColor="#0d1729" stopOpacity="0.92" />
          </radialGradient>
          <marker id={uid+'arrow'} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L10 5 L0 10Z" fill="#9bcfda" />
          </marker>
        </defs>

        <g transform={'translate('+(width/2+pan.x)+' '+(height/2+pan.y)+') scale('+(zoom*fit)+') translate('+(-worldWidth/2)+' '+(-height/2)+')'}>
        {/* Relationships remain selectable even when their labels are hidden. */}
        {links.map((e,i)=>{
          const a=positions.get(e.source)!,b=positions.get(e.target)!,dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy));
          const sx=a.x+dx/d*34,sy=a.y+dy/d*34,tx=b.x-dx/d*34,ty=b.y-dy/d*34;
          const bend=(i%2?1:-1)*26,mx=(sx+tx)/2-dy/d*bend,my=(sy+ty)/2+dx/d*bend;
          const label=labelPosition({x:sx,y:sy},{x:tx,y:ty},mx,my);
          const isSelectedEdge = selectedEdgeId === e.id || !!activeId && (e.source === activeId || e.target === activeId);
          const thickness = 1 + Math.min(4, Math.log2((e.weight ?? 1) + 1)) * .5;
          const edgeColor = colorFor(e.source);
          return <g key={e.id} tabIndex={0} role={onEdgeSelect ? "button" : undefined} onClick={() => onEdgeSelect?.(e.id)} onKeyDown={event => { if (onEdgeSelect && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onEdgeSelect(e.id); } }} aria-label={e.label+": "+e.evidence} className={"graph-edge"+((label.show || isSelectedEdge)&&(!selectedId||isSelectedEdge)?" show-label":"")} opacity={(activeId || selectedEdgeId)&&!isSelectedEdge? .18:1}>
            <title>{e.label+': '+e.evidence}</title>
            <path d={'M'+sx+','+sy+' Q'+mx+','+my+' '+tx+','+ty} fill="none" stroke="transparent" strokeWidth="18"/>
            <path d={'M'+sx+','+sy+' Q'+mx+','+my+' '+tx+','+ty} fill="none" stroke={isSelectedEdge ? "#9de9f0" : edgeColor} strokeWidth={isSelectedEdge ? thickness + 1 : thickness} opacity={isSelectedEdge ? ".95" : ".58"} strokeDasharray={e.directed ? "5 3" : undefined} markerEnd={e.directed?'url(#'+uid+'arrow)':undefined}/>
            <g className="edge-annotation" transform={'translate('+(label.x)+','+(label.y)+')'}>
              <rect x="-78" y="-12" width="156" height="24" rx="6" fill="#101b2de8" stroke={isSelectedEdge ? "#9de9f0a0" : "#a8c2f42b"} strokeWidth="1"/>
              <text y="4" textAnchor="middle" className="knowledge-edge-label" fill="#f5f3ff" fontSize="10px" fontWeight="600">{e.label.replace(/_/g,' ').length > 27 ? e.label.replace(/_/g,' ').slice(0,25) + '…' : e.label.replace(/_/g,' ')}</text>
            </g>
          </g>;
        })}

        {/* Nodes expose their name and evidence counts in the graph itself. */}
        {visible.map(n=>{
          const p=positions.get(n.id)!,Icon=icons[n.type]??Tag;
          const nodeColor = colorFor(n.type==='document'?n.id:n.type);
          const isSelected = selectedId === n.id;
          const isActive = isSelected || hoveredId === n.id;
          const muted = connectedIds.size > 0 && !connectedIds.has(n.id);
          return <g key={n.id} transform={'translate('+p.x+' '+p.y+')'} role="button" tabIndex={0} aria-label={n.label+', '+n.detail} aria-pressed={isSelected} className={"knowledge-node" + (isActive ? " is-active" : "") + (n.type !== "document" ? " entity-node" : "")} opacity={muted ? .22 : 1} onMouseEnter={() => setHoveredId(n.id)} onMouseLeave={() => setHoveredId('')} onFocus={() => setHoveredId(n.id)} onBlur={() => setHoveredId('')} style={{color:nodeColor}} onClick={()=>onSelect?.(n.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.(n.id);}}}>
            <title>{n.label+' — '+n.detail}</title>
            <circle className="graph-node-core" r="32" fill={'url(#'+uid+'glass)'} stroke="currentColor" strokeWidth={isSelected ? 2.5 : 1.4} />
            <path className="graph-node-specular" d="M-19,-19 A27,27 0 0,1 16,-23" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.48" strokeLinecap="round" />
            <Icon x="-10" y="-10" width="20" height="20" stroke="#f1f7ff" strokeWidth="1.6" />
            <g transform="translate(0, 41)">
              <rect x="-78" y="0" width="156" height="40" rx="7" fill="#0d1829e8" stroke={isSelected ? 'currentColor' : '#a8c2f42b'} strokeWidth={isSelected ? 1.5 : 1} />
              <text y="18" textAnchor="middle" className="node-label" fill="#ffffff" fontSize="12px" fontWeight="600">{n.label.length>22?n.label.slice(0,20)+'…':n.label}</text>
              <text y="33" textAnchor="middle" className="node-detail" fill="#c4b5fd" fontSize="10px">{n.detail}</text>
            </g>
          </g>;
        })}
        </g>
      </svg>}
    </div>

    {/* Bottom Footer with Page controls and Legend */}
    <div className="viz-footer">
      <span>Drag to pan · select a node or relationship to inspect evidence</span>

      {/* Mode-specific legend */}
      {isDocumentGraph ? (
        <span className="graph-legend">Line width = shared entity count / Color identifies source</span>
      ) : (
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="text-slate-400">Entity types:</span>
          {[...new Set(visible.map(node => node.type))].slice(0, 6).map(type => (
            <span key={type} className="inline-flex items-center gap-1.5 text-[11px] text-slate-200">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(type) }} />
              {type.replace(/^\w/, letter => letter.toUpperCase())}
            </span>
          ))}
        </div>
      )}

      <div className="pager">
        <button aria-label="Previous nodes" disabled={!current} onClick={()=>setPage(current-1)}>Previous</button>
        <span>Page {current+1} of {pages}</span>
        <button aria-label="Next nodes" disabled={current+1>=pages} onClick={()=>setPage(current+1)}>Next</button>
      </div>
    </div>
  </div>;
}
