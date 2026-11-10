import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('..'),out=path.join(root,'docs/verification');
const base=process.env.VERIS_UI_URL||'http://127.0.0.1:5175';
const report={checks:[],errors:[]};
let count=5,mode='data';
const docs=()=>Array.from({length:count},(_,i)=>({doc_id:'d'+i,filename:'Research source '+(i+1)+'.txt',extension:'.txt',version:1,status:'indexed',extraction_status:'complete',extraction_error:null,chunks:20+i%5}));
const entities=()=>Array.from({length:count},(_,i)=>({entity_id:'e'+i,canonical_name:['Acme Research','Jordan Lee','Knowledge systems','Veris','London'][i%5]+(i>4?' '+i:''),entity_type:['org','person','concept','product','location'][i%5],aliases:[],status:'validated',fact_count:1+i%4}));
const relationships=()=>Array.from({length:count-1},(_,i)=>({rel_id:'r'+i,src_entity_id:'e0',dst_entity_id:'e'+(i+1),rel_type:'relates_to',doc_id:'d'+(i%count),evidence:'Evidence from the synthetic browser-test source.',status:'validated'}));
const chunks=()=>docs().flatMap(d=>Array.from({length:d.chunks},(_,j)=>({id:d.doc_id+'c'+j,docId:d.doc_id,docFilename:d.filename,chunkIndex:j,text:'Evidence passage '+j+' from '+d.filename+'. These are browser-test fixtures, not product data.',embedding:null})));
const dataFor=url=>{
 const p=url.pathname;
 if(p==='/health')return {status:'ok',app:'Veris API',nvidia_configured:true,model:'test-model'};
 if(p==='/capabilities')return {supported_extensions:['.pdf','.docx','.txt','.md'],max_upload_bytes:10485760,max_upload_mb:10,llm_model:'test-model',nvidia_configured:true,session_ttl_seconds:3600,persistence:'ephemeral-in-memory',features:[]};
 if(p==='/intel/stats')return {documents:mode==='empty'?0:count,chunks:mode==='empty'?0:chunks().length,entities:mode==='empty'?0:count,facts:count,relationships:count-1};
 if(p==='/intel/documents')return mode==='empty'?[]:docs();
 if(p==='/intel/document-graph')return {documents:mode==='empty'?[]:docs(),edges:mode==='empty'?[]:Array.from({length:count-1},(_,i)=>({source:'d0',target:'d'+(i+1),weight:1+i%4,similarity:.1+(i%5)*.2,rel_type:'shared_entities',evidence:'Shared test entities.'}))};
 if(p==='/intel/entities')return mode==='empty'?[]:entities();
 if(p==='/intel/relationships')return mode==='empty'?[]:relationships();
 if(p==='/intel/chunks')return {chunks:mode==='empty'?[]:chunks(),total:mode==='empty'?0:chunks().length};
 if(p.startsWith('/intel/entity/')){const e=entities().find(e=>e.entity_id===p.split('/').at(-1));return {...e,facts:[{fact_id:'f1',doc_id:'d0',filename:docs()[0].filename,attribute:'research',value:'document intelligence',unit:'',period:'',evidence:'Evidence from the synthetic browser-test source.',status:'validated'}],related_entities:[],related_count:count-1};}
};
const browser=await puppeteer.launch({headless:true,args:['--no-first-run','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],timeout:60000});
try{
 const page=await browser.newPage();await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.setRequestInterception(true);
 page.on('request',req=>{
  const url=new URL(req.url()),data=dataFor(url);
  if(req.isNavigationRequest()||data===undefined)return void req.continue();
  void req.respond({status:mode==='error'?503:200,contentType:'application/json',body:JSON.stringify(mode==='error'?{detail:'Test service unavailable'}:data)});
 });
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('503'))report.errors.push(m.text());});
 const routes=['/','/documents','/knowledge','/knowledge/graph','/knowledge/chunks','/knowledge/entities','/intelligence','/settings','/help'];
 for(const width of [360,768,1280,1920]){
  await page.setViewport({width,height:width===1920?1080:900,deviceScaleFactor:1});
  for(const route of routes){
   await page.goto(base+route,{waitUntil:'networkidle0'});await page.waitForSelector('h1');await page.evaluate(()=>document.fonts.ready);await new Promise(r=>setTimeout(r,100));
   const measure=await page.evaluate(()=>{
    const r=document.querySelector('.knowledge-viz')?.getBoundingClientRect();
    const nodes=[...document.querySelectorAll('.knowledge-node')].map(n=>{const b=n.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom};});
    return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:innerHeight,scrollHeight:document.documentElement.scrollHeight,visual:r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom}:null,nodes};
   });
   const isVisual=/knowledge\/(graph|chunks|entities)/.test(route);
   const pass=measure.scrollWidth<=width+1&&(!isVisual||(!!measure.visual&&measure.scrollHeight<=measure.height+2&&measure.visual.bottom<=measure.height+1&&measure.nodes.every(n=>n.left>=measure.visual.left-1&&n.right<=measure.visual.right+1&&n.top>=measure.visual.top&&n.bottom<=measure.visual.bottom)));
   report.checks.push({kind:'viewport',route,width,pass,measure});
   await page.screenshot({path:path.join(out,'screenshots',width+'-'+(route.slice(1).replaceAll('/','-')||'overview')+'.png'),fullPage:true});
   if(isVisual){
    const select=await page.$('[role="button"].knowledge-node,[role="button"].cloud-particle');
    if(select){await select.click();await page.waitForSelector('.knowledge-inspector');report.checks.push({kind:'inspect',route,width,pass:true});await page.click('[aria-label="Close inspector"]');}
   }
  }
 }
 for(const route of ['/knowledge/graph','/knowledge/chunks','/knowledge/entities']){
  count=500;await page.setViewport({width:360,height:900});await page.goto(base+route,{waitUntil:'networkidle0'});
  const nodes=await page.$$('[role="button"].knowledge-node,[role="button"].cloud-particle');
  report.checks.push({kind:'large-data',route,count,visible:nodes.length,pass:nodes.length>0&&nodes.length<=480});
  const next=await page.$('.pager button:last-child');await next.click();
  report.checks.push({kind:'paging',route,pass:await page.$eval('.pager span',e=>e.textContent.startsWith('2 /'))});
  count=5;
  for(const state of ['empty','error']){mode=state;await page.goto(base+route,{waitUntil:'networkidle0'});report.checks.push({kind:state,route,pass:await page.$(state==='empty'?'.empty-state':'[role=alert]')!==null});}
  mode='data';
 }
 await page.goto(base+'/knowledge/graph',{waitUntil:'networkidle0'});
 await page.type('input[type=search]','No such source');
 report.checks.push({kind:'filter-no-match',pass:await page.$('.visual-empty')!==null});
 await page.keyboard.down('Control');await page.keyboard.press('KeyK');await page.keyboard.up('Control');
 report.checks.push({kind:'shortcut',pass:await page.$eval('.veris-search input',e=>e===document.activeElement)});
 await page.goto(base+'/knowledge/chunks',{waitUntil:'networkidle0'});await page.goBack({waitUntil:'networkidle0'});
 report.checks.push({kind:'history',pass:new URL(page.url()).pathname==='/knowledge/graph'});
}finally{await browser.close();fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));}
const failed=report.checks.filter(c=>!c.pass);
console.log(JSON.stringify({checks:report.checks.length,failed,errors:[...new Set(report.errors)]},null,2));
if(failed.length||report.errors.length)process.exitCode=1;
