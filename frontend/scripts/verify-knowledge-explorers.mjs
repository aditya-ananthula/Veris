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
const chunks=()=>docs().flatMap(d=>Array.from({length:d.chunks},(_,j)=>({id:d.doc_id+'c'+j,docId:d.doc_id,docFilename:d.filename,chunkIndex:j,text:'Evidence passage '+j+' from '+d.filename+'. These are browser-test fixtures, not product data.',embedding:null,projection:j===0?null:[Math.sin(j*3+d.doc_id.charCodeAt(1))*.75,Math.cos(j*2)*.7]})));
const dataFor=url=>{
 const p=url.pathname;
 if(p==='/health')return {status:'ok',app:'Veris API',nvidia_configured:true,model:'test-model'};
 if(p==='/capabilities')return {supported_extensions:['.pdf','.docx','.txt','.md'],max_upload_bytes:10485760,max_upload_mb:10,llm_model:'test-model',nvidia_configured:true,session_ttl_seconds:3600,persistence:'ephemeral-in-memory',features:[]};
 if(p==='/intel/stats')return {documents:mode==='empty'?0:count,chunks:mode==='empty'?0:chunks().length,entities:mode==='empty'?0:count,facts:count,relationships:count-1};
 if(p==='/intel/documents')return mode==='empty'?[]:docs();
 if(p==='/intel/document-graph')return {documents:mode==='empty'?[]:docs(),edges:mode==='empty'?[]:Array.from({length:count-1},(_,i)=>({source:'d0',target:'d'+(i+1),weight:1+i%4,similarity:.1+(i%5)*.2,rel_type:'shared_entities',evidence:'Shared entities: '+['Acme Research','Jordan Lee','Knowledge systems','London'][i%4],shared_entities:[{entity_id:'e'+i,name:['Acme Research','Jordan Lee','Knowledge systems','London'][i%4]}]}))};
 if(p==='/intel/entities')return mode==='empty'?[]:entities();
 if(p==='/intel/relationships')return mode==='empty'?[]:[...relationships(),{...relationships()[0],rel_id:'extra-proof',doc_id:'d1',evidence:'A second source confirms this relationship.'}];
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
 const go=async route=>{await page.goto(base+route,{waitUntil:'networkidle0'});await page.waitForSelector('.knowledge');};
 const clickText=async text=>{const clicked=await page.evaluate(text=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===text);if(!b)return false;b.click();return true;},text);if(!clicked)throw new Error('Button missing: '+text);};
 await page.setViewport({width:1440,height:1050});
 await go('/knowledge/chunks');
 const markerCount=await page.$$eval('.cloud-particle .chunk-marker',els=>els.length);
 if(markerCount!==chunks().length*10)throw new Error('Source marker count '+markerCount);
 await page.screenshot({path:path.join(out,'explorer-cloud-desktop.png')});
 await clickText('Embedding map');
 await page.waitForFunction(n=>document.querySelectorAll('.cloud-particle').length===n,{},chunks().filter(c=>c.projection).length);
 if(await page.$$eval('.cloud-particle',e=>e.length)!==chunks().filter(c=>c.projection).length)throw new Error('Invalid projected records');
 await clickText('Source islands');
 await page.$eval('.cloud-particle',e=>e.focus());await page.keyboard.press('Enter');
 await page.waitForSelector('[aria-label="Passage 1"]');
 await page.click('[aria-label="Next source passage"]');await page.waitForSelector('[aria-label="Passage 2"]');
 await clickText('Locate in cloud');
 if(!await page.$eval('.cloud-world',e=>e.getAttribute('transform').includes('scale(2)')))throw new Error('Locate failed');
 await page.screenshot({path:path.join(out,'explorer-cloud-reading.png')});
 await page.click('[aria-label="Close inspector"]');await clickText('Fit View');
 await page.$eval('.cloud-stage',e=>e.scrollIntoView({block:'center'}));
 const stage=await page.$eval('.cloud-stage svg',e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y}));
 const before=await page.$eval('.cloud-world',e=>e.getAttribute('transform'));
 await page.mouse.move(stage.x+30,stage.y+30);await page.mouse.down();await page.mouse.move(stage.x+100,stage.y+75,{steps:5});await page.mouse.up();
 if(await page.$eval('.cloud-world',e=>e.getAttribute('transform'))===before)throw new Error('Cloud pan failed');
 report.checks.push('All records plotted with ten markers; missing projections excluded only in embedding mode; keyboard selection; adjacent-source reading; locate; pan and fit');
 await go('/knowledge/entities');await page.screenshot({path:path.join(out,'explorer-entities-desktop.png')});
 await page.$eval('.graph-edge',e=>e.focus());await page.keyboard.press('Enter');await page.waitForSelector('[aria-label="Relationship evidence"]');
 if(!await page.$eval('.knowledge-inspector',e=>e.textContent.includes('A second source confirms')))throw new Error('Lost supporting evidence');
 await page.screenshot({path:path.join(out,'explorer-relationship-evidence.png')});
 await page.click('[aria-label="Close inspector"]');
 await page.$eval('.knowledge-node',e=>e.focus());await page.keyboard.press('Enter');
 await clickText('Explore this neighborhood');await page.waitForSelector('.explorer-trail');
 if(!await page.$eval('.explorer-trail',e=>e.textContent.includes('Neighborhood')))throw new Error('Focus mode missing');
 await page.screenshot({path:path.join(out,'explorer-entity-focus.png')});
 await clickText('Show full network');
 report.checks.push('Keyboard relationship selection; all supporting records retained; entity neighborhood focus and return');
 count=8;await go('/knowledge/chunks');
 if(await page.$$eval('.cloud-particle',e=>e.length)!==120)throw new Error('Unbounded cloud page');
 await page.click('[aria-label="Next passages"]');
 await page.waitForFunction(n=>document.querySelectorAll('.cloud-particle').length===n,{},chunks().length-120);
 await go('/knowledge/chunks?document=d0&chunk=d0c1');await page.waitForSelector('[aria-label="Passage 2"]');
 count=5;report.checks.push('Bounded pagination and passage deep links');
 for(const width of [390,768]) {
  await page.setViewport({width,height:900});
  for(const route of ['/knowledge/chunks','/knowledge/entities']) {await go(route);if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Overflow '+width+' '+route);await page.screenshot({path:path.join(out,'explorer-'+route.split('/').at(-1)+'-'+width+'.png')});report.checks.push(route+' fits '+width);}
 }
 for(const nextMode of ['empty','error']) {mode=nextMode;for(const route of ['/knowledge/chunks','/knowledge/entities']) {await go(route);await page.waitForSelector(nextMode==='empty'?'.empty-state':'[role="alert"]');if(await page.$('.cloud-particle,.knowledge-node'))throw new Error('Phantom data in '+nextMode);report.checks.push(route+' '+nextMode);}}
 if(report.errors.length)throw new Error(report.errors.join('; '));
 console.log(JSON.stringify(report,null,2));fs.writeFileSync(path.join(out,'explorer-browser-report.json'),JSON.stringify(report,null,2));
} finally {await browser.close();}
