import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('..'),out=path.join(root,'docs/verification/glass');
const base=process.env.VERIS_UI_URL||'http://127.0.0.1:5180';
const report={checks:[],errors:[]};
let count=5,mode='data';
const docs=()=>Array.from({length:count},(_,i)=>({doc_id:'d'+i,filename:'Research source '+(i+1)+'.txt',extension:'.txt',version:1,status:'indexed',extraction_status:'complete',extraction_error:null,chunks:20+i%5}));
const entities=()=>Array.from({length:count},(_,i)=>({entity_id:'e'+i,canonical_name:['Acme Research','Jordan Lee','Knowledge systems','Veris','London'][i%5]+(i>4?' '+i:''),entity_type:['org','person','concept','product','location'][i%5],aliases:[],status:'validated',fact_count:1+i%4}));
const relationships=()=>Array.from({length:count-1},(_,i)=>({rel_id:'r'+i,src_entity_id:'e0',dst_entity_id:'e'+(i+1),rel_type:'relates_to',doc_id:'d'+(i%count),evidence:'Evidence from the synthetic browser-test source.',status:'validated'}));
const chunks=()=>docs().flatMap(d=>Array.from({length:d.chunks},(_,j)=>({id:d.doc_id+'c'+j,docId:d.doc_id,docFilename:d.filename,chunkIndex:j,text:'Evidence passage '+j+' from '+d.filename+'. These are browser-test fixtures, not product data.',embedding:null,projection:[Math.sin(j*3+d.doc_id.charCodeAt(1))*.75,Math.cos(j*2)*.7]})));
const dataFor=url=>{
 const p=url.pathname;
 if(p==='/health')return {status:'ok',app:'Veris API',nvidia_configured:true,model:'test-model'};
 if(p==='/capabilities')return {supported_extensions:['.pdf','.docx','.txt','.md'],max_upload_bytes:10485760,max_upload_mb:10,llm_model:'test-model',nvidia_configured:true,session_ttl_seconds:3600,persistence:'ephemeral-in-memory',features:[]};
 if(p==='/intel/stats')return {documents:mode==='empty'?0:count,chunks:mode==='empty'?0:chunks().length,entities:mode==='empty'?0:count,facts:count,relationships:count-1};
 if(p==='/intel/documents')return mode==='empty'?[]:docs();
 if(p==='/intel/document-graph')return {documents:mode==='empty'?[]:docs(),edges:mode==='empty'?[]:Array.from({length:count-1},(_,i)=>({source:'d0',target:'d'+(i+1),weight:1+i%4,similarity:.1+(i%5)*.2,rel_type:'shared_entities',evidence:'Shared entities: '+['Acme Research','Jordan Lee','Knowledge systems','London'][i%4],shared_entities:[{entity_id:'e'+i,name:['Acme Research','Jordan Lee','Knowledge systems','London'][i%4]}]}))};
 if(p==='/intel/entities')return mode==='empty'?[]:entities();
 if(p==='/intel/relationships')return mode==='empty'?[]:relationships();
 if(p==='/intel/chunks'||p==='/intel/chunk-projection')return {chunks:mode==='empty'?[]:chunks(),total:mode==='empty'?0:chunks().length};
 if(p.startsWith('/intel/entity/')){const e=entities().find(e=>e.entity_id===p.split('/').at(-1));return {...e,facts:[{fact_id:'f1',doc_id:'d0',filename:docs()[0].filename,attribute:'research',value:'document intelligence',unit:'',period:'',evidence:'Evidence from the synthetic browser-test source.',status:'validated'}],related_entities:[],related_count:count-1};}
};


fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.setRequestInterception(true);
 page.on('request',req=>{const data=dataFor(new URL(req.url()));if(req.isNavigationRequest()||data===undefined)return void req.continue();void req.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});});
 for(const width of [390,768,1440]) {
  await page.setViewport({width,height:1000});
  for(const route of ['/','/documents','/knowledge','/knowledge/graph','/knowledge/chunks','/knowledge/entities','/intelligence','/intelligence?tab=compare','/intelligence?tab=contradictions','/insights','/settings','/help']) {
   await page.goto(base+route,{waitUntil:'networkidle0'});
   const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth, controls:[...document.querySelectorAll('button:not(.veris-nav-scrim),.veris-nav-item,.knowledge-tabs a,.intelligence-nav a,a[class*=veris-btn]')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height}).filter(e=>!getComputedStyle(e).backdropFilter.includes('blur(18px)')).map(e=>e.outerHTML.slice(0,160))}));
   if(result.overflow||result.controls.length)throw new Error(JSON.stringify({route,width,result}));
   report.checks.push(route+' at '+width+': no horizontal overflow; shared glass controls');
   await page.screenshot({path:path.join(out,width+'-'+(route.slice(1).replaceAll('/','-').replaceAll('?','-').replaceAll('=','-')||'overview')+'.png')});
  }
  if(width<800){
   await page.click('[aria-label="Toggle navigation"]');
   await page.waitForSelector('.veris-sidebar-open');
   await page.screenshot({path:path.join(out,width+'-navigation.png')});
   await page.click('.veris-sidebar a[href="/documents"]');
   if(await page.$('.veris-sidebar-open'))throw new Error('Menu did not close');
   report.checks.push('Mobile navigation opens, navigates and closes at '+width);
  }
 }
 await page.goto(base+'/documents',{waitUntil:'networkidle0'});
 await page.click('.document-name');await page.waitForSelector('.knowledge-inspector');
 await page.screenshot({path:path.join(out,'document-inspector.png')});
 await page.click('[aria-label="Close inspector"]');
 report.checks.push('Document inspection opens and closes');
 await page.focus('.veris-sidebar a');
 if(!await page.$eval('.veris-sidebar a',e=>getComputedStyle(e).outlineStyle==='solid'))throw new Error('Missing keyboard focus');
 report.checks.push('Visible keyboard focus');
 if(report.errors.length)throw new Error(report.errors.join('; '));
} finally {await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({checks:report.checks.length,errors:report.errors}));
