#!/usr/bin/env node
import {readFile, appendFile} from 'node:fs/promises';
import {analyze,compare,markdown,MAX_BYTES} from '../src/engine.js';
import {doctor,applyPatch} from '../src/doctor.js';
const args=process.argv.slice(2), command=args.shift();
const option=name=>{const i=args.indexOf(name);if(i<0)return null;if(!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Missing value for ${name}`);return args[i+1];};
async function input(file) {
  if(file && file!=='-') {const {stat}=await import('node:fs/promises');if((await stat(file)).size>MAX_BYTES)throw new Error('Log exceeds 2 MiB.');return readFile(file,'utf8');}
  if(process.stdin.isTTY)throw new Error('Provide a log file or pipe input.');
  let data='',size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>MAX_BYTES)throw new Error('Log exceeds 2 MiB.');data+=chunk.toString();}return data;
}
try {
  if(!command||['--help','help','-h'].includes(command)) {
    console.log(`DevRescue 0.1.0 — local troubleshooting, no paid API\n\nUsage:\n  devrescue analyze <log|-> [--json|--markdown] [--fail-on-findings]\n  devrescue compare <before.log> <after.log>\n  devrescue doctor [directory] [--json]\n  devrescue fix [directory] [--apply ignore-env]\n\nFix defaults to a preview. Only ignore-env can be applied. No log-derived commands are executed.\nRedaction is best effort. Review reports before sharing.`);
  } else if(command==='analyze') {
    const report=analyze(await input(args[0]?.startsWith('--')?null:args[0]));
    const output=args.includes('--json')?JSON.stringify(report,null,2):markdown(report);
    console.log(output);
    if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,markdown(report)+'\n');
    if(args.includes('--fail-on-findings')&&report.findings.length)process.exitCode=1;
  } else if(command==='compare') {
    if(!args[0]||!args[1])throw new Error('Provide two log paths.');
    console.log(JSON.stringify(compare(analyze(await input(args[0])),analyze(await input(args[1]))),null,2));
  } else if(command==='doctor'||command==='fix') {
    const dir=args[0]&&!args[0].startsWith('--')?args[0]:'.', report=await doctor(dir);
    if(command==='fix') {
      const id=option('--apply');
      if(id){const patch=report.patches.find(p=>p.id===id);if(!patch)throw new Error('No eligible patch.');console.log(JSON.stringify(await applyPatch(report.root,patch)));}
      else console.log(JSON.stringify({message:'Preview only. Review before applying.',patches:report.patches},null,2));
    } else console.log(JSON.stringify(report,null,2));
  } else throw new Error(`Unknown command: ${command}`);
} catch(error) {console.error(`DevRescue: ${error.message}`);process.exitCode=2;}

