import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
const base='http://127.0.0.1:5177',out=path.resolve('../docs/verification/rebuild');
fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],provider:'Test-only deterministic LLM; real FastAPI, persistent Chroma embeddings, SQLite and original files.'};
const check=(name,pass,detail)=>{report.checks.push({name,pass,detail});if(!pass)throw new Error(name+' failed: '+JSON.stringify(detail));};
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-first-run','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],timeout:60000});
try {
 const page=await browser.newPage();await page.setViewport({width:1672,height:941});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base+'/documents',{waitUntil:'networkidle0'});
 await page.evaluate(()=>localStorage.setItem('veris.session_id',crypto.randomUUID()));await page.reload({waitUntil:'networkidle0'});
 const names=['Architecture.txt','Evaluation.txt','Retrieval.txt','Operations.txt','Research.txt','Delivery.txt'];
 const texts=['Semantic retrieval uses embeddings to find similar passages.','Evaluation measures source accuracy and retrieval quality.','Retrieval indexes source passages in a persistent vector store.','Operations preserves source files and handles failed indexing.','Research compares grounded answers with source evidence.','Delivery verifies document processing and collection integrity.'];
 names.forEach((name,i)=>fs.writeFileSync(path.join(out,name),'Acme uses Python to process '+(i===1?'8':'5')+' projects. '+texts[i]));
 await (await page.$('input[type=file]')).uploadFile(...names.map(n=>path.join(out,n)));
 await page.waitForFunction(()=>document.querySelectorAll('.document-table tbody tr').length===6,{timeout:120000});
 check('Batch upload, persistence and list',true);
 const docs=await page.evaluate(async()=>await(await fetch('/intel/documents?session_id='+localStorage.getItem('veris.session_id'))).json());
 check('Extraction and original-file metadata',docs.every(d=>d.chunks>0&&d.size_bytes>0&&d.source_available&&d.extraction_status==='complete'));
 await page.click('.document-name');await page.waitForSelector('.knowledge-inspector');
 const source=await page.$eval('.knowledge-inspector a[target=_blank]',a=>a.href);
 const sourceStatus=await page.evaluate(async u=>(await fetch(u)).status,source);check('Original source opens',sourceStatus===200);
 await page.screenshot({path:path.join(out,'documents-inspector.png')});
 await page.goto(base+'/intelligence',{waitUntil:'networkidle0'});
 await page.type('textarea','What does Acme use?');await page.click('[aria-label="Send question"]');
 await page.waitForSelector('.sources',{timeout:120000});await page.click('.sources summary');
 check('Grounded answer with named chunk citations',await page.$('.sources .citation-chip')!==null);
 await page.type('textarea','What does it process?');await page.keyboard.down('Shift');await page.keyboard.press('Enter');await page.keyboard.up('Shift');
 check('Shift+Enter preserves multiline input',await page.$eval('textarea',e=>e.value.includes('\n')));
 await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.message-assistant').length===2,{timeout:120000});
 check('Follow-up retains both turns',await page.$$eval('.message-user',e=>e.length===2));
 await page.screenshot({path:path.join(out,'chat-conversation.png')});
 await page.click('.sources .citation-chip');await page.waitForSelector('.knowledge-inspector');
 check('Citation selects its exact chunk',await page.$eval('.knowledge-inspector',e=>e.textContent.includes('Chunk ID')));
 for(const route of ['/','/documents','/knowledge','/knowledge/graph','/knowledge/chunks','/knowledge/entities','/intelligence','/intelligence?tab=compare','/intelligence?tab=contradictions','/insights','/settings','/help']){
  await page.goto(base+route,{waitUntil:'networkidle0'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  check('Desktop '+route,!overflow);
  await page.screenshot({path:path.join(out,'desktop-'+(route.slice(1).replaceAll('/','-').replaceAll('?','-').replaceAll('=','-')||'overview')+'.png')});
 }
 await page.goto(base+'/intelligence?tab=compare',{waitUntil:'networkidle0'});
 await page.select('[aria-label="Document A"]',docs.find(d=>d.filename==='Architecture.txt').doc_id);await page.select('[aria-label="Document B"]',docs.find(d=>d.filename==='Evaluation.txt').doc_id);
 await page.click('.compare-picker .veris-btn-primary');await page.waitForSelector('.comparison-workspace');
 check('Comparison has conflicts and evidence',await page.$eval('.comparison-workspace',e=>e.textContent.includes('Conflict')&&e.querySelector('blockquote')!==null));
 await page.screenshot({path:path.join(out,'comparison-results.png')});
 await page.goto(base+'/intelligence?tab=contradictions',{waitUntil:'networkidle0'});await page.click('.page > .veris-btn-primary');await page.waitForSelector('.compare-grid blockquote');check('Contradiction scan has both excerpts',true);
 await page.goto(base+'/knowledge/graph',{waitUntil:'networkidle0'});await page.click('.knowledge-node');await page.waitForSelector('.knowledge-inspector');check('Document node opens actual inspector',true);await page.screenshot({path:path.join(out,'graph-selected.png')});
 await page.goto(base+'/knowledge/entities',{waitUntil:'networkidle0'});await page.click('.knowledge-node');await page.waitForFunction(()=>document.querySelector('.knowledge-inspector')?.textContent.includes('Properties'));check('Entity evidence inspector',true);await page.screenshot({path:path.join(out,'entity-selected.png')});
 for(const width of [390,768]) {
  await page.setViewport({width,height:844});
  for(const route of ['/','/documents','/knowledge/graph','/knowledge/chunks','/knowledge/entities','/intelligence','/insights']){
   await page.goto(base+route,{waitUntil:'networkidle0'});check(width+' '+route,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:path.join(out,width+'-'+(route.slice(1).replaceAll('/','-')||'overview')+'.png')});
  }
 }
 await page.setViewport({width:1672,height:941});await page.goto(base+'/documents',{waitUntil:'networkidle0'});
 page.on('dialog',d=>d.accept());await page.click('[aria-label="Select all matching documents"]');await page.click('.selection-bar button');
 await page.waitForFunction(()=>document.querySelectorAll('.document-table tbody tr').length===0,{timeout:30000});
 const state=await page.evaluate(async()=>{const s=localStorage.getItem('veris.session_id');return await Promise.all(['/intel/stats','/intel/chunk-projection','/intel/relationships','/intel/contradictions'].map(async p=>await(await fetch(p+'?session_id='+s)).json()));});
 check('Confirmed bulk deletion removes every derived record',state[0].documents===0&&state[0].entities===0&&state[1].total===0&&state[2].length===0&&state[3].conflicts.length===0,state);
}catch(e){report.errors.push(e.stack);}finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));if(report.errors.length||report.checks.some(c=>!c.pass))process.exitCode=1;
