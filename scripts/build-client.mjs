// Rebuilds plugin/client.js from src/: hero-runtime.ts with its TypeScript
// types stripped (code keeps its positions), then client-tail.js, in one IIFE.
// Needs Node.js 22.13 or later for module.stripTypeScriptTypes.
import {readFileSync,writeFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const root=new URL('..',import.meta.url);
const runtime=stripTypeScriptTypes(readFileSync(new URL('src/hero-runtime.ts',root),'utf8'));
const tail=readFileSync(new URL('src/client-tail.js',root),'utf8');
writeFileSync(new URL('plugin/client.js',root),'(function(){\n'+runtime+tail+'\n})();\n');
