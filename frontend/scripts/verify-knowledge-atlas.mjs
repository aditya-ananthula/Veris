import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('..'),out=path.join(root,'docs/verification');
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

const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.setRequestInterception(true);
 page.on('request',req=>{const data=dataFor(new URL(req.url()));if(req.isNavigationRequest()||data===undefined)return void req.continue();void req.respond({status:mode==='error'?503:200,contentType:'application/json',body:JSON.stringify(mode==='error'?{detail:'Test failure'}:data)});});
 for(const width of [1440,390]) {
  await page.setViewport({width,height:1000});
  for(const route of ['/knowledge','/knowledge/graph','/knowledge/chunks','/knowledge/entities']) {
   await page.goto(base+route,{waitUntil:'networkidle0'});
   await page.waitForSelector('.knowledge');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   if(overflow)throw new Error('Overflow: '+route+' '+width);
   await page.screenshot({path:path.join(out,'atlas-'+route.split('/').at(-1)+'-'+width+'.png')});
   report.checks.push(route+' renders at '+width);
  }
 }
 await page.setViewport({width:1440,height:1000});
 await page.goto(base+'/knowledge/graph',{waitUntil:'networkidle0'});
 await page.$eval('.graph-edge', e => e.focus()); await page.keyboard.press('Enter');
 await page.waitForSelector('[aria-label="Why these sources connect"]');
 if(!await page.$eval('.knowledge-inspector',e=>e.textContent.includes('Acme Research')))throw new Error('Missing actual entity evidence');
 await page.screenshot({path:path.join(out,'atlas-connection-evidence.png')});
 await page.keyboard.press('Escape'); await page.waitForFunction(()=>!document.querySelector('.knowledge-inspector'));
 await page.select('select[aria-label="Relationship filter"]','3');
 if(await page.$$eval('.graph-edge',e=>e.length)!==2)throw new Error('Threshold filter failed');
 await page.click('button[aria-label="Zoom in"]');
 await page.goto(base+'/knowledge/entities?q=London',{waitUntil:'networkidle0'});
 if(await page.$$eval('.knowledge-node',e=>e.length)!==1)throw new Error('Entity deep link filter failed');
 report.checks.push('Keyboard edge evidence, Escape, threshold, zoom, entity deep link');
 for(const nextMode of ['empty','error']) {
  mode=nextMode;await page.goto(base+'/knowledge',{waitUntil:'networkidle0'});
  await page.waitForSelector(nextMode==='empty'?'.empty-state':'[role="alert"]');
  if(await page.$('.knowledge-node'))throw new Error('Fabricated nodes in '+nextMode);
  report.checks.push(nextMode+' state');
 }
 if(report.errors.length)throw new Error(report.errors.join('; '));
 console.log(JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(out,'atlas-browser-report.json'),JSON.stringify(report,null,2));
} finally { await browser.close(); }
