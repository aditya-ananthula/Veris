import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],timeout:60000});
const p=await b.newPage();await p.setViewport({width:1280,height:900});await p.goto('http://127.0.0.1:5175/knowledge/graph',{waitUntil:'networkidle0'});
console.log(await p.evaluate(()=>({labels:[...document.querySelectorAll('.veris-sidebar span,.veris-sidebar p')].map(e=>({text:e.textContent,display:getComputedStyle(e).display,color:getComputedStyle(e).color,rect:e.getBoundingClientRect().toJSON()})),gl:!!document.querySelector('#gl').getContext('webgl'),body:getComputedStyle(document.body).background})));
await p.screenshot({path:'../docs/verification/gpu-check.png'});
await b.close();
