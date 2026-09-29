import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {startPreviewServer} from '../tools/dev-server.mjs';

function request(url,pathname='/',options={}){
 return new Promise((resolve,reject)=>{
  const target=new URL(url),req=http.request({hostname:target.hostname,port:target.port,path:pathname,method:options.method||'GET',headers:options.headers||{},agent:false},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));
  });req.on('error',reject);req.end();
 });
}

test('JavaScript preview serves only public real paths and uses a free loopback port',async t=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'darb-preview-test-')),publicDir=path.join(folder,'public');
 await mkdir(path.join(publicDir,'js'),{recursive:true});await writeFile(path.join(publicDir,'index.html'),'<!doctype html><title>DARB</title>');
 await writeFile(path.join(publicDir,'js/app.js'),'export const preview = true;');await writeFile(path.join(folder,'private.txt'),'PRIVATE MUST NOT BE SERVED');await writeFile(path.join(publicDir,'.env'),'PRIVATE ENV');
 let server;
 try{
  const started=await startPreviewServer({publicDir});server=started.server;assert.match(started.url,/^http:\/\/127\.0\.0\.1:\d+\/$/);
  const page=await request(started.url);assert.equal(page.status,200);assert.match(page.body,/DARB/);assert.equal(page.headers['x-content-type-options'],'nosniff');
  const script=await request(started.url,'/js/app.js?revision=1');assert.equal(script.status,200);assert.match(script.headers['content-type'],/javascript/);
  const head=await request(started.url,'/js/app.js',{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.body,'');assert.ok(Number(head.headers['content-length'])>0);
  assert.equal((await request(started.url,'/',{method:'POST'})).status,405);
  assert.equal((await request(started.url,'/',{headers:{Host:'untrusted.example'}})).status,403);
  assert.equal((await request(started.url,'/%ZZ')).status,400);
  assert.equal((await request(started.url,'/%2e%2e%2fprivate.txt')).status,403);
  assert.equal((await request(started.url,'/.env')).status,403);
  assert.equal((await request(started.url,'/private.txt')).status,404);
  assert.equal((await request(started.url,'/js')).status,404);
  try{await symlink(path.join(folder,'private.txt'),path.join(publicDir,'outside.txt'),'file');assert.equal((await request(started.url,'/outside.txt')).status,403);}
  catch(error){if(process.platform==='win32'&&['EPERM','EACCES'].includes(error.code))t.diagnostic('Windows did not allow creating the test symlink; other traversal checks passed.');else throw error;}
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await rm(folder,{recursive:true,force:true});}
});
