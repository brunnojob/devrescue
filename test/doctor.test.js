import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {doctor,applyPatch} from '../src/doctor.js';
test('environment checks expose names, never values; patch backs up and refuses stale files',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'devrescue-'));
 try{
 await writeFile(path.join(root,'.env.example'),'TOKEN=secret-value\nDB_URL=x\n');
 await writeFile(path.join(root,'.env'),'TOKEN=private-value\n');await writeFile(path.join(root,'.gitignore'),'node_modules/\n');
 await writeFile(path.join(root,'package.json'),'{"dependencies":{"x":"latest"}}');
 const report=await doctor(root);assert.ok(!JSON.stringify(report).includes('private-value'));assert.ok(!JSON.stringify(report).includes('secret-value'));
 assert.equal(report.findings.find(f=>f.id==='env-missing').detail,'DB_URL');
 await applyPatch(root,report.patches[0]);assert.equal(await readFile(path.join(root,'.gitignore.devrescue.backup'),'utf8'),'node_modules/\n');
 await assert.rejects(()=>applyPatch(root,report.patches[0]),/changed/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('doctor refuses symlinked sensitive files',async t=>{
 if(process.platform==='win32')return t.skip('symlink privileges vary on Windows');
 const root=await mkdtemp(path.join(os.tmpdir(),'devrescue-'));
 try{await symlink('/etc/passwd',path.join(root,'.env.example'));await assert.rejects(()=>doctor(root),/Symlink/);}finally{await rm(root,{recursive:true,force:true});}
});
