import {readFileSync,writeFileSync,createReadStream,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const PREFIX='/yoren-animations/';
const allowed=new Map([
 ['client.js','text/javascript'],['hero.css','text/css'],
 ['splash/index.html','text/html'],['splash/splash.js','text/javascript'],['splash/player.js','text/javascript'],
 ['media/intro.json','application/json'],['media/poster.webp','image/webp'],['media/hand.png','image/png'],
 ...['intro','idle','wink','lean','toss'].map(name=>['media/'+name+'.mp4','video/mp4'])
]);
export function rangeFor(header,size){
  if(!header)return {start:0,end:size-1,status:200};
  const match=/^bytes=(\d*)-(\d*)$/.exec(header);
  if(!match||(!match[1]&&!match[2]))return null;
  let start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
  let end=match[1]?(match[2]?Math.min(Number(match[2]),size-1):size-1):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return null;
  return {start,end,status:206};
}
export function createHandler(report=()=>{}){
  return function handler(req,res){
    const url=new URL(req.url,'http://localhost');
    const name=url.pathname.slice(PREFIX.length);
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    if(name==='event'){
      const event=url.searchParams.get('name');
      if(['client-ready','splash-playing','splash-dismissed','hero-mounted','hero-playing','hero-fallback','selector-unavailable'].includes(event))report(event);
      res.writeHead(204,{'cache-control':'no-store'});res.end();return;
    }
    if(!allowed.has(name)){res.writeHead(404);res.end();return;}
    const path=join(root,name);let size;
    try{size=statSync(path).size;}catch{res.writeHead(404);res.end();return;}
    const range=rangeFor(req.headers.range,size);
    if(!range){res.writeHead(416,{'content-range':`bytes */${size}`});res.end();return;}
    const headers={'content-type':allowed.get(name),'accept-ranges':'bytes','content-length':range.end-range.start+1,'cache-control':name.endsWith('.mp4')?'private,max-age=3600':'no-store'};
    if(range.status===206)headers['content-range']=`bytes ${range.start}-${range.end}/${size}`;
    res.writeHead(range.status,headers);
    if(req.method==='HEAD'){res.end();return;}
    const stream=createReadStream(path,{start:range.start,end:range.end});
    stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
  };
}
export const inject=['webServer'];
export function apply(ctx){
  const status={pluginVersion:'1.0.0',pid:process.pid,hostStartedAt:new Date().toISOString(),events:{}};
  const record=event=>{
    if(event)status.events[event]=new Date().toISOString();
    try{writeFileSync(join(root,'..','health.json'),JSON.stringify(status,null,2)+'\n',{mode:0o600});}catch(error){console.warn('Animation health log unavailable:',error.message);}
  };
  ctx.effect(()=>ctx.webServer.register({path:PREFIX.slice(0,-1),kind:'prefix',handler:createHandler(record)}));
  const javascript=readFileSync(join(root,'client.js'),'utf8');
  const css=readFileSync(join(root,'hero.css'),'utf8');
  ctx.on('webserver/index-inject',rows=>rows.push({kind:'style',text:css},{kind:'script',placement:'body',text:javascript}));
  record();
}
