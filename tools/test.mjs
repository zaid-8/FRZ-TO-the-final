import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const tests=['tools/check.mjs',...readdirSync(new URL('../qa/',import.meta.url)).filter(name=>/^test_.*\.mjs$/.test(name)).sort().map(name=>'qa/'+name)];
for(const test of tests){
 console.log(`\nRunning ${test}`);
 const result=spawnSync(process.execPath,[test],{cwd:root,stdio:'inherit'});
 if(result.error){console.error(result.error.message);process.exit(1);}
 if(result.status!==0)process.exit(result.status||1);
}
console.log('\nJavaScript checks passed. Live Firebase services and browser appearance are separate checks.');
