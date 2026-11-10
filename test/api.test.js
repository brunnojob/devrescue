import {test} from 'node:test';import assert from 'node:assert/strict';
import {createApi} from '../server/api.js';
test('API requires authorization and stores only sanitized derived evidence',async()=>{
 const saved=[];const apiToken='test-only-token-with-at-least-32-characters';
 const store={insert:async(...args)=>saved.push(args),list:async()=>saved,remove:async()=>{}};
 const api=createApi({store,apiToken});await new Promise(r=>api.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${api.address().port}`;
 try{
 assert.equal((await fetch(base+'/v1/reports')).status,401);
 const headers={authorization:`Bearer ${apiToken}`,'content-type':'application/json'};
 const response=await fetch(base+'/v1/reports',{method:'POST',headers,body:JSON.stringify({log:'EADDRINUSE password=hidden-secret'})});
 assert.equal(response.status,201);assert.equal(saved.length,1);assert.ok(!JSON.stringify(saved).includes('hidden-secret'));assert.ok(!('sanitizedLog' in saved[0][2]));
 assert.equal((await fetch(base+'/v1/reports',{method:'POST',headers,body:'bad-json'})).status,400);
 }finally{await new Promise(r=>api.close(r));}
});
