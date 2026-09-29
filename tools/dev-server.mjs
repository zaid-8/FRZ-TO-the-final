import http from 'node:http';
import path from 'node:path';
import {createReadStream} from 'node:fs';
import {realpath,stat} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';

const PUBLIC_DIR=fileURLToPath(new URL('../public/',import.meta.url));
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.ico':'image/x-icon','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2','.glb':'model/gltf-binary','.gltf':'model/gltf+json'};
const inside=(base,file)=>file===base||file.startsWith(base+path.sep);

export async function startPreviewServer({port=0,publicDir=PUBLIC_DIR}={}){
 if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Port must be an integer between 0 and 65535.');
 const base=await realpath(publicDir);
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Cache-Control','no-store');
  const fail=(status,text)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?'':text);};
  const host=req.headers.host||'',allowed=new Set([`127.0.0.1:${server.address().port}`,`localhost:${server.address().port}`]);
  if(!allowed.has(host)){fail(403,'Invalid preview host.');return;}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.setHeader('Allow','GET, HEAD');fail(405,'This is a static preview server.');return;}
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{fail(400,'Invalid request path.');return;}
  if(pathname.includes('\0')||pathname.includes('\\')||pathname.split('/').some(part=>part.startsWith('.'))){fail(403,'Path unavailable.');return;}
  if(pathname==='/')pathname='/index.html';
  const candidate=path.resolve(base,'.'+pathname);
  if(!inside(base,candidate)){fail(403,'Path unavailable.');return;}
  try{
   const target=await realpath(candidate);if(!inside(base,target)){fail(403,'Path unavailable.');return;}
   const info=await stat(target);if(!info.isFile()){fail(404,'File not found.');return;}
   res.writeHead(200,{'Content-Type':TYPES[path.extname(target).toLowerCase()]||'application/octet-stream','Content-Length':info.size});
   if(req.method==='HEAD'){res.end();return;}
   const stream=createReadStream(target);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
  }catch(error){if(!res.headersSent)fail(error.code==='ENOENT'||error.code==='ENOTDIR'?404:500,'File unavailable.');else res.destroy();}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});});
 return {server,url:`http://127.0.0.1:${server.address().port}/`};
}

function openBrowser(url){
 let command,args;
 if(process.platform==='win32'){command='cmd.exe';args=['/d','/c','start','',url];}
 else if(process.platform==='darwin'){command='open';args=[url];}
 else{command='xdg-open';args=[url];}
 const child=spawn(command,args,{detached:true,stdio:'ignore'});child.once('error',()=>console.log('Open the DARB address above in your browser.'));child.unref();
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{
  const args=process.argv.slice(2);let value=process.env.PORT;
  for(let i=0;i<args.length;i++){if(args[i]==='--open')continue;if(args[i]==='--port'){value=args[++i];if(value===undefined)throw new Error('--port requires a number.');}else throw new Error('Usage: node tools/dev-server.mjs [--open] [--port 4173]');}
  const port=value===undefined?0:Number(value);
  const {server,url}=await startPreviewServer({port});console.log(`DARB: ${url}\nStatic preview only. Keep this window open; press Ctrl+C to stop.`);
  if(args.includes('--open'))openBrowser(url);
  const stop=()=>server.close(()=>process.exit(0));process.once('SIGINT',stop);process.once('SIGTERM',stop);
 }catch(error){console.error(error.message);process.exitCode=1;}
}
