import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const fail=message=>{throw new Error(message);};
const firebase=(args,stdio='pipe')=>spawnSync('firebase',args,{cwd:root,encoding:'utf8',stdio,shell:process.platform==='win32',timeout:stdio==='pipe'?60000:undefined,maxBuffer:8*1024*1024});

try{
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--project')fail('Usage: npm run deploy -- --project YOUR_REAL_FIREBASE_PROJECT_ID');
 const projectId=args[1];if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId))fail('Provide a real Firebase project ID, not a display name or an empty placeholder.');
 const hosting=JSON.parse(readFileSync(path.join(root,'firebase.json'),'utf8'));
 if(hosting.hosting?.public!=='public')fail('Hosting must publish only the public directory.');
 const configPath=path.join(root,'public/js/firebase-config.js');if(!existsSync(configPath))fail('public/js/firebase-config.js is missing.');
 const {FIREBASE_CONFIG={},APP_CHECK_SITE_KEY=''}=await import(pathToFileURL(configPath).href);
 const configured=Object.values(FIREBASE_CONFIG).some(value=>typeof value==='string'&&value.trim());
 if(configured){
  for(const key of ['apiKey','authDomain','projectId','appId'])if(typeof FIREBASE_CONFIG[key]!=='string'||!FIREBASE_CONFIG[key].trim())fail(`Firebase config is incomplete: ${key}. Use all required web settings or leave the entire web config blank for Hosting auto-config.`);
  if(FIREBASE_CONFIG.projectId!==projectId)fail('The configured Firebase projectId does not match --project.');
  if(!/^AIza[A-Za-z0-9_-]{30,}$/.test(FIREBASE_CONFIG.apiKey)||!/^\d+:\d+:web:[a-z0-9]+$/i.test(FIREBASE_CONFIG.appId))fail('Firebase web apiKey/appId still appear to be placeholders. Copy the web app configuration from your real project.');
 }
 for(const file of [hosting.firestore?.rules,hosting.firestore?.indexes].filter(Boolean))if(!existsSync(path.join(root,file)))fail(`Deployment file is missing: ${file}`);
 const checks=spawnSync(process.execPath,['tools/test.mjs'],{cwd:root,stdio:'inherit'});if(checks.error||checks.status!==0)fail('Local checks failed; no deployment was attempted.');
 const listed=firebase(['projects:list','--json','--non-interactive']);
 if(listed.error?.code==='ENOENT')fail('Firebase CLI is not installed. Install firebase-tools and run firebase login first.');
 if(listed.error||listed.status!==0)fail('Firebase CLI could not list authenticated projects. Run firebase login, confirm access to your project, and try again.');
 let projects;try{projects=JSON.parse(listed.stdout).result;}catch{fail('Could not read the Firebase CLI project response.');}
 if(!Array.isArray(projects)||!projects.some(project=>project.projectId===projectId))fail('The requested project is not in the authenticated Firebase account. No deployment was attempted.');
 const listedApps=firebase(['apps:list','WEB','--project',projectId,'--json','--non-interactive']);
 if(listedApps.error||listedApps.status!==0)fail('Could not verify the Firebase web apps registered to this project. No deployment was attempted.');
 let webApps;try{const result=JSON.parse(listedApps.stdout).result;webApps=Array.isArray(result)?result:result?.apps;}catch{}
 if(!Array.isArray(webApps)||!webApps.length)fail('Register a real Firebase web app in this project before deploying. No web app was found.');
 if(configured&&!webApps.some(app=>app.appId===FIREBASE_CONFIG.appId))fail('The configured appId is not a registered web app in the selected project.');
 console.log(`Verified Firebase project access: ${projectId}`);
 console.log(configured?'Using explicit public Firebase web configuration.':'Using Firebase Hosting /__/firebase/init.json auto-configuration.');
 if(!APP_CHECK_SITE_KEY)console.log('App Check has no public site key configured. Hosting can deploy, but App Check/AI still need their project setup.');
 const targets=['hosting'];if(hosting.firestore?.rules)targets.push('firestore:rules');if(hosting.firestore?.indexes)targets.push('firestore:indexes');
 const deployed=firebase(['deploy','--only',targets.join(','),'--project',projectId,'--non-interactive'],'inherit');
 if(deployed.error||deployed.status!==0)fail('Firebase CLI did not complete the deployment. Review its output above.');
 console.log('Use the actual Hosting URL printed by Firebase CLI above. Run npm run verify:live -- <that HTTPS URL> to check public assets.');
}catch(error){console.error(error.message);process.exitCode=1;}
