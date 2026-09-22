import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import http from 'node:http';
import {createServer} from '../server.js';

test('owner access, local-only host, VPS generation and visual explanations',async()=>{
  const ownerKey='test-owner-key-with-more-than-thirty-two-characters';
  const server=createServer({ownerKey,ai:{baseURL:'https://vps.test/v1',model:'private-model',apiKey:'test-vps-key'}});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  const realFetch=globalThis.fetch;
  let question={a:8,b:4}, calls=0;
  globalThis.fetch=async(url,options)=>{
    if(String(url).startsWith('https://vps.test/')) {
      calls++; assert.equal(String(url),'https://vps.test/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer test-vps-key');assert.equal(JSON.parse(options.body).model,'private-model');
      const request=JSON.parse(options.body); const system=request.messages[0].content; const explanation=system.includes('Asisten Belajar');const iq=system.includes('penalaran numerik');
      const result=iq?{sequence:[2,4,8,16],answer:32,hint:'Kalikan dua.',type:'sequence'}:explanation?{title:'Lihat kelompok',summary:'Susun angka menjadi kelompok.',steps:['Buat empat kelompok.','Isi masing-masing dua.','Hitung semuanya.'],insight:'Totalnya delapan.',visual:{type:'groups',values:[2,4,8],labels:['2','4','8']}}:question;
      return Response.json({choices:[{message:{content:JSON.stringify(result)}}]});
    }
    return realFetch(url,options);
  };
  try {
    let cookie='';const post=(endpoint,body,origin=base)=>fetch(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:JSON.stringify(body)});
    assert.match(await (await fetch(base)).text(),/access-key-math\.txt/);
    assert.equal((await fetch(base+'/app.js')).status,401);
    assert.equal((await post('/api/access',{key:'wrong'})).status,401);
    const login=await post('/api/access',{key:ownerKey});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
    for(const file of ['app.js','home.css','progress.js','assets/figma-panel-front.svg']) assert.equal((await fetch(base+'/'+file,{headers:{Cookie:cookie}})).status,200,file);
    assert.equal((await fetch(base+'/access-key-math.txt',{headers:{Cookie:cookie}})).status,404);
    assert.equal((await fetch(base+'/.env',{headers:{Cookie:cookie}})).status,404);
    const rejectedHost=await new Promise((resolve,reject)=>{const request=http.get(base,{headers:{Host:'evil.example'}},response=>{response.resume();resolve(response.statusCode);});request.on('error',reject);});
    assert.equal(rejectedHost,403);
    assert.equal((await post('/api/challenge',{operation:'tambah',difficulty:'mudah'},'https://evil.example')).status,403);
    assert.equal((await post('/api/challenge',{operation:'tambah',difficulty:'mudah'})).status,200);assert.equal(calls,0);
    assert.equal((await post('/api/challenge',{operation:'constructor',difficulty:'mudah'})).status,400);
    const q=await (await post('/api/challenge',{operation:'kali',difficulty:'mudah',engine:'ai'})).json();assert.equal(q.source,'ai');assert.equal(calls,1);
    const explanation=await (await post('/api/explanation',{question:{operation:'kali',a:2,b:4,answer:8}})).json();assert.equal(explanation.source,'asisten');assert.equal(explanation.visual.type,'groups');
    const iq=await (await post('/api/iq-test',{difficulty:'sedang',history:[]})).json();assert.deepEqual(iq.sequence,[2,4,8,16]);assert.equal(iq.source,'ai');
    assert.equal((await post('/api/explanation',{question:{operation:'unknown'}})).status,400);
    question={a:9999,b:0};const fallback=await (await post('/api/challenge',{operation:'bagi',difficulty:'mudah',engine:'ai'})).json();assert.equal(fallback.fallback,true);assert.equal(fallback.source,'default');
  } finally {globalThis.fetch=realFetch;await new Promise(resolve=>server.close(resolve));}
});

test('host publik dari ALLOWED_HOSTS diterima, host asing ditolak',async()=>{
  const ownerKey='test-owner-key-with-more-than-thirty-two-characters';
  const server=createServer({ownerKey,hosts:new Set(['mathspeedy.duckdns.org','127.0.0.1']),ai:{baseURL:'',model:''}});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const port=server.address().port;
  const status=host=>new Promise((resolve,reject)=>{const request=http.get({host:'127.0.0.1',port,path:'/',headers:{Host:host}},response=>{response.resume();resolve(response.statusCode);});request.on('error',reject);});
  try{
    assert.equal(await status('mathspeedy.duckdns.org'),200);
    assert.equal(await status('EVIL.example'),403);
  } finally {await new Promise(resolve=>server.close(resolve));}
});

test('status AI langsung "terhubung" setelah server dibuat (warm-up saat start)',async()=>{
  const ownerKey='test-owner-key-with-more-than-thirty-two-characters';
  const realFetch=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    if(String(url).startsWith('https://vps.test/')) return Response.json({choices:[{message:{content:JSON.stringify({a:5,b:3})}}]});
    return realFetch(url,options);
  };
  const server=createServer({ownerKey,ai:{baseURL:'https://vps.test/v1',model:'private-model',apiKey:'test-vps-key'}});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const login=await fetch(base+'/api/access',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({key:ownerKey})});
    const cookie=login.headers.get('set-cookie').split(';')[0];
    await new Promise(resolve=>setTimeout(resolve,300));
    const status=await (await fetch(base+'/api/ai/status',{headers:{Cookie:cookie}})).json();
    assert.equal(status.configured,true);
    assert.equal(status.connected,true,'warm-up harus menandai model terhubung tanpa menunggu permintaan pengguna');
    assert.equal(status.model,'private-model');
  } finally {globalThis.fetch=realFetch;await new Promise(resolve=>server.close(resolve));}
});

test('tes penalaran tetap jalan pakai soal bawaan saat model mengirim isi kosong',async()=>{
  const ownerKey='test-owner-key-with-more-than-thirty-two-characters';
  const realFetch=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    if(String(url).startsWith('https://vps.test/')) return Response.json({choices:[{message:{content:''}}]});
    return realFetch(url,options);
  };
  const server=createServer({ownerKey,ai:{baseURL:'https://vps.test/v1',model:'private-model',apiKey:'test-vps-key'}});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const login=await fetch(base+'/api/access',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({key:ownerKey})});
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const response=await fetch(base+'/api/iq-test',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify({difficulty:'sedang',history:[]})});
    assert.equal(response.status,200);
    const question=await response.json();
    assert.equal(question.fallback,true);
    assert.equal(question.operation,'iq');
    assert.equal(question.sequence.length,4);
    assert.ok(Number.isInteger(question.answer)&&question.answer>0);
  } finally {globalThis.fetch=realFetch;await new Promise(resolve=>server.close(resolve));}
});
