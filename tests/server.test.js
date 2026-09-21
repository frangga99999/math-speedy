import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from '../server.js';

test('owner access, protected assets, VPS generation, validation and logout',async()=>{
  const accessKey='test-owner-key-that-is-at-least-32-characters';
  const server=createServer({accessKey,ai:{baseURL:'https://vps.test/v1',model:'private-model',apiKey:'test-vps-key'}});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  const realFetch=globalThis.fetch;
  let question={a:8,b:4}, calls=0;
  globalThis.fetch=async(url,options)=>{
    if(String(url).startsWith('https://vps.test/')) {
      calls++; assert.equal(String(url),'https://vps.test/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer test-vps-key');assert.equal(JSON.parse(options.body).model,'private-model');
      return Response.json({choices:[{message:{content:JSON.stringify(question)}}]});
    }
    return realFetch(url,options);
  };
  try {
    const post=(endpoint,body,cookie='',origin=base)=>fetch(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:origin},body:JSON.stringify(body)});
    assert.match(await (await fetch(base)).text(),/Ruang latihan pribadi/);
    assert.equal((await fetch(base+'/app.js')).status,401);
    assert.equal((await fetch(base+'/assets/figma-challenge.png')).status,401);
    assert.equal((await post('/api/challenge',{operation:'tambah',difficulty:'mudah'})).status,401);
    assert.equal((await post('/api/access',{key:'wrong'})).status,401);
    assert.equal((await post('/api/access',{key:accessKey},'','https://evil.example')).status,403);
    assert.equal((await post('/api/access',{key:accessKey},'',base.replace(/^http/,'https'))).status,200);
    const login=await post('/api/access',{key:accessKey}); assert.equal(login.status,200);
    const header=login.headers.get('set-cookie');assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Strict/);const cookie=header.split(';')[0];
    for(const file of ['home.css','progress.js','assets/figma-panel-front.svg','assets/figma-challenge.png']) assert.equal((await fetch(base+'/'+file,{headers:{Cookie:cookie}})).status,200,file);
    assert.equal((await fetch(base+'/.private-access',{headers:{Cookie:cookie}})).status,404);
    assert.equal((await fetch(base+'/.env',{headers:{Cookie:cookie}})).status,404);
    assert.equal((await post('/api/challenge',{operation:'tambah',difficulty:'mudah'},cookie)).status,200);assert.equal(calls,0);
    assert.equal((await post('/api/challenge',{operation:'constructor',difficulty:'mudah'},cookie)).status,400);
    const q=await (await post('/api/challenge',{operation:'kali',difficulty:'mudah',engine:'ai'},cookie)).json();assert.equal(q.source,'ai');assert.equal(calls,1);
    assert.equal((await post('/api/ai/test',{},cookie)).status,200);
    question={a:9999,b:0};const fallback=await (await post('/api/challenge',{operation:'bagi',difficulty:'mudah',engine:'ai'},cookie)).json();assert.equal(fallback.fallback,true);assert.equal(fallback.source,'default');
    assert.equal((await post('/api/access/logout',{},cookie)).status,200);
    assert.equal((await fetch(base+'/app.js',{headers:{Cookie:cookie}})).status,401);
  } finally {globalThis.fetch=realFetch;await new Promise(resolve=>server.close(resolve));}
});

test('status AI langsung "terhubung" setelah server dibuat (warm-up saat start)',async()=>{
  const accessKey='test-owner-key-that-is-at-least-32-characters';
  const realFetch=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    if(String(url).startsWith('https://vps.test/')) return Response.json({choices:[{message:{content:JSON.stringify({a:5,b:3})}}]});
    return realFetch(url,options);
  };
  const server=createServer({accessKey,ai:{baseURL:'https://vps.test/v1',model:'private-model',apiKey:'test-vps-key'}});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const login=await fetch(base+'/api/access',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({key:accessKey})});
    const cookie=login.headers.get('set-cookie').split(';')[0];
    await new Promise(resolve=>setTimeout(resolve,300));
    const status=await (await fetch(base+'/api/ai/status',{headers:{Cookie:cookie}})).json();
    assert.equal(status.configured,true);
    assert.equal(status.connected,true,'warm-up harus menandai model terhubung tanpa menunggu permintaan pengguna');
    assert.equal(status.model,'private-model');
  } finally {globalThis.fetch=realFetch;await new Promise(resolve=>server.close(resolve));}
});
