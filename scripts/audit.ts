import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { mkdir,writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';

const url=process.argv[2]??'http://localhost:5173';
const socket=createServer();await new Promise<void>(resolve=>socket.listen(0,'127.0.0.1',resolve));
const address=socket.address();if(!address||typeof address==='string')throw new Error('No CDP port');const port=address.port;
await new Promise<void>(resolve=>socket.close(()=>resolve()));
const browser=await chromium.launch({channel:'chrome',args:[`--remote-debugging-port=${port}`]});
await mkdir('docs/qa',{recursive:true});
try{
  const page=await browser.newPage();await page.goto(url);await page.waitForSelector('.quick-add input:not([disabled])');
  const summary:Record<string,unknown>={};
  for(const mode of ['mobile','desktop'] as const){
    const runs:Array<{scores:Record<string,number>;failures:Array<{id:string;title:string;score:number|null;details:unknown}>}>=[];
    for(let index=0;index<3;index++){
      const result=await lighthouse(url,{port,output:'json',logLevel:'error',onlyCategories:['performance','accessibility','best-practices','seo'],disableStorageReset:true},mode==='desktop'?{extends:'lighthouse:default',settings:{formFactor:'desktop',screenEmulation:{mobile:false,width:1280,height:900,deviceScaleFactor:1,disabled:false},throttling:{rttMs:40,throughputKbps:10240,cpuSlowdownMultiplier:1,requestLatencyMs:0,downloadThroughputKbps:0,uploadThroughputKbps:0}}}:undefined);
      if(!result)throw new Error('Lighthouse did not return a report');
      await writeFile(`docs/qa/lighthouse-${mode}-${index+1}.json`,JSON.stringify(result.lhr,null,2));
      const scores=Object.fromEntries(Object.entries(result.lhr.categories).map(([key,value])=>[key,Math.round((value.score??0)*100)]));
      const failures=Object.values(result.lhr.audits).filter(audit=>audit.score!==null&&audit.score<1).map(audit=>({id:audit.id,title:audit.title,score:audit.score,details:audit.details}));
      runs.push({scores,failures});
    }
    const median=Object.fromEntries(['performance','accessibility','best-practices','seo'].map(key=>[key,runs.map(run=>run.scores[key]??0).sort((a,b)=>a-b)[1]]));
    summary[mode]={median,runs:runs.map(run=>run.scores),failures:runs[1]?.failures};
    console.log(mode,JSON.stringify(median));
  }
  await writeFile('docs/qa/lighthouse-summary.json',JSON.stringify(summary,null,2));
}finally{await browser.close();}
