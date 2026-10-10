import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {createHandler,rangeFor,apply} from '../plugin/index.mjs';

const serve=async(handler,run)=>{
 const server=createServer(handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await run('http://127.0.0.1:'+server.address().port+'/yoren-animations/');}
 finally{await new Promise(resolve=>server.close(resolve));}
};

test('ranges handle bounded/open/suffix ranges and reject invalid or multipart ranges',()=>{
 assert.deepEqual(rangeFor('bytes=10-19',100),{start:10,end:19,status:206});
 assert.deepEqual(rangeFor('bytes=90-',100),{start:90,end:99,status:206});
 assert.deepEqual(rangeFor('bytes=-10',100),{start:90,end:99,status:206});
 assert.deepEqual(rangeFor('bytes=90-999',100),{start:90,end:99,status:206});
 for(const value of ['bytes=100-','bytes=9-8','bytes=-0','bytes=-','bytes=0-1,4-5','garbage'])assert.equal(rangeFor(value,100),null,value);
});
test('real media server returns exact bytes, MIME, Range and HEAD and rejects other paths/methods',async()=>{
 const events=[];
 await serve(createHandler(event=>events.push(event)),async base=>{
  const expected=readFileSync(new URL('../plugin/media/idle.mp4',import.meta.url));
  const partial=await fetch(base+'media/idle.mp4',{headers:{Range:'bytes=10-19'}});
  assert.equal(partial.status,206);assert.equal(partial.headers.get('content-type'),'video/mp4');
  assert.deepEqual(Buffer.from(await partial.arrayBuffer()),expected.subarray(10,20));
  const head=await fetch(base+'media/idle.mp4',{method:'HEAD'});assert.equal(head.headers.get('content-length'),String(expected.length));assert.equal((await head.arrayBuffer()).byteLength,0);
  assert.equal((await fetch(base+'media/idle.mp4',{headers:{Range:'bytes=999999999-'}})).status,416);
  for(const file of ['../package.json','%2e%2e/package.json','media/not-there.mp4'])assert.equal((await fetch(base+file)).status,404);
  assert.equal((await fetch(base+'media/idle.mp4',{method:'POST'})).status,405);
  await fetch(base+'event?name=hero-playing');await fetch(base+'event?name=untrusted');assert.deepEqual(events,['hero-playing']);
 });
});
test('config route serves only the greeting name and tolerates a missing or broken file',async()=>{
 const file=join(mkdtempSync(join(tmpdir(),'dsh-skin-')),'config.json');
 await serve(createHandler(()=>{},file),async base=>{
  const read=async()=>(await fetch(base+'config.json')).json();
  assert.deepEqual(await read(),{});
  writeFileSync(file,JSON.stringify({name:'Yoren',other:'not served'}));
  assert.deepEqual(await read(),{name:'Yoren'});
  writeFileSync(file,'{broken');
  assert.deepEqual(await read(),{});
 });
});
test('greeting names the user only when configured, escaped and cut to fit',async()=>{
 await import('../plugin/splash/splash.js');
 const splash=globalThis.DeepSeekSplash;
 const greeting=name=>splash.splashMarkup({title:'早上好',line:'深海听令，随时出击！'},undefined,name).match(/fill="#f4f8fc">([^<]*)</)[1];
 assert.equal(greeting(),'早上好。深海听令，随时出击！');
 assert.equal(greeting('  '),'早上好。深海听令，随时出击！');
 assert.equal(greeting('Yoren'),'Yoren，早上好。深海听令，随时出击！');
 assert.equal(greeting('<b>一二三四五六七'),'&lt;b&gt;一二三四五，早上好。深海听令，随时出击！');
});
test('host registers compatible prefix route and nonblocking official boot injections',()=>{
 let route,callback;let disposed=false;
 apply({webServer:{register(value){route=value;return()=>{disposed=true;};}},effect(fn){const off=fn();off();},on(name,fn){assert.equal(name,'webserver/index-inject');callback=fn;}});
 assert.equal(route.kind,'prefix');assert.equal(route.path,'/yoren-animations');assert.equal(disposed,true);
 const rows=[];callback(rows);assert.deepEqual(rows.map(x=>x.kind),['style','script']);
 assert.ok(rows[1].text.includes('data-content-phase="hero"'));assert.ok(rows[1].text.includes('25000'));
});
test('plugin/client.js is the current build of src/ (npm run build)',()=>{
 const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
 const built='(function(){\n'+stripTypeScriptTypes(read('../src/hero-runtime.ts'))+read('../src/client-tail.js')+'\n})();\n';
 assert.equal(read('../plugin/client.js'),built);
});
