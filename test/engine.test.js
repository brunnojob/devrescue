import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyze,sanitize,compare,MAX_BYTES,rules} from '../src/engine.js';
test('deduplicates exact compiler locations, keeps independent locations',()=>{
 const r=analyze('src/api.ts(45,7): error TS2322: mismatch\nsrc/api.ts(45,7): error TS2322: mismatch\nsrc/api.ts:46:2 error TS2322: mismatch');
 assert.equal(r.findings.length,2);assert.equal(r.findings[0].occurrences,2);assert.deepEqual(r.findings[0].location,{file:'src/api.ts',line:45,column:7});
});
test('Python traceback uses last frame without false DNS matches',()=>{
 const r=analyze('Traceback (most recent call last):\n  File "main.py", line 12, in <module>\nModuleNotFoundError: No module named \'requests\'');
 assert.equal(r.findings.length,1);assert.equal(r.findings[0].location.line,12);
});
test('secrets are removed before diagnostics and exports',()=>{
 const raw='password="super-secret"\nAuthorization: Bearer abc123\npostgresql://admin:pass@private/db\nghp_abc123\n\x1b[31mEADDRINUSE\x1b[0m';
 const clean=sanitize(raw);for(const secret of ['super-secret','abc123','admin:pass','\x1b'])assert.ok(!clean.includes(secret));
 assert.equal(analyze(raw).findings[0].id,'port');
});
test('all supported rule families have executable fixtures',()=>{
 const samples=['npm error ERESOLVE','npm ci requires lock sync','Missing script: test','Cannot find module x','ModuleNotFoundError: No module named x','ImportError: cannot import name x','error TS1234: x','EADDRINUSE','ENOSPC','OOMKilled','EACCES','Cannot connect to the Docker daemon','exec format error','password authentication failed','relation "foo" does not exist','ECONNREFUSED 5432','ENOTFOUND','CERT_HAS_EXPIRED','CONFLICT (content)','FAIL test'];
 assert.equal(samples.length,rules.length);samples.forEach((s,i)=>assert.ok(analyze(s).findings.some(f=>f.id===rules[i].id),rules[i].id));
});
test('unknown logs are not claimed healthy and oversized logs fail',()=>{
 assert.equal(analyze('Something unexpected happened').recognized,false);assert.throws(()=>analyze('x'.repeat(MAX_BYTES+1)),/2 MiB/);
});
test('comparison identifies added, absent and recurring signatures',()=>{
 const r=compare(analyze('EADDRINUSE\nENOSPC'),analyze('EADDRINUSE\nOOMKilled'));
 assert.equal(r.added[0].id,'memory');assert.equal(r.resolved[0].id,'disk');assert.equal(r.recurring[0].id,'port');
});

