const inputs=process.argv.slice(2);
try{
 if(inputs.length!==1)throw new Error('Usage: npm run verify:live -- https://YOUR_ACTUAL_HOSTING_DOMAIN/');
 const base=new URL(inputs[0]);
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw new Error('Provide a public HTTPS deployment URL without credentials, query parameters, or a fragment.');
 if(base.hostname==='localhost'||base.hostname.endsWith('.localhost')||/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/.test(base.hostname))throw new Error('A local preview address is not a public deployment.');
 if(!base.pathname.endsWith('/'))base.pathname+='/';
 const targets=[['','html',text=>text.includes('DARB')&&/src=["']js\/app\.js["']/.test(text)],['js/app.js','javascript',text=>text.includes('import')],['js/firebase-config.js','javascript',text=>text.includes('FIREBASE_CONFIG')],['credits.html','html',text=>text.includes('credits.js')]];
 for(const [file,type,valid] of targets){
  const url=new URL(file,base),response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'follow'});
  if(!response.ok)throw new Error(`${url.pathname}: HTTP ${response.status}`);
  if(new URL(response.url).protocol!=='https:')throw new Error(`${url.pathname}: redirected away from HTTPS.`);
  if(!(response.headers.get('content-type')||'').includes(type))throw new Error(`${url.pathname}: unexpected content type.`);
  const text=await response.text();if(!valid(text))throw new Error(`${url.pathname}: expected project content was not found.`);
  console.log(`PASS ${response.status} ${url.href}`);
 }
 console.log('Public HTTPS assets verified. This does not verify sign-in, Firestore access rules, App Check, AI responses, or browser rendering.');
}catch(error){console.error(error.message);process.exitCode=1;}
