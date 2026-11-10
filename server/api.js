import {createServer} from 'node:http';
import {createHash, timingSafeEqual, randomUUID} from 'node:crypto';
import {analyze,MAX_BYTES} from '../src/engine.js';
export function createApi({store, apiToken}) {
  if(!apiToken || apiToken.length<32)throw new Error('API_TOKEN must contain at least 32 characters.');
  const digest=s=>createHash('sha256').update(s).digest();
  const owner=digest(apiToken).toString('hex');
  return createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');
    res.setHeader('Cache-Control','no-store');
    const send=(status,data)=>{res.writeHead(status);res.end(JSON.stringify(data));};
    if(req.url==='/health'&&req.method==='GET')return send(200,{status:'ok'});
    const candidate=(req.headers.authorization||'').replace(/^Bearer /,'');
    if(!timingSafeEqual(digest(candidate),digest(apiToken)))return send(401,{error:'Unauthorized'});
    try {
      if(req.url==='/v1/reports'&&req.method==='POST') {
        let body='',size=0;
        for await(const chunk of req){size+=chunk.length;if(size>MAX_BYTES){send(413,{error:'Payload too large'});req.resume();return;}body+=chunk.toString();}
        let payload;try{payload=JSON.parse(body);}catch{return send(400,{error:'Invalid JSON'});}
        if(typeof payload.log!=='string')return send(400,{error:'Expected a log string'});
        const {sanitizedLog,...report}=analyze(payload.log);
        // Store derived sanitized evidence only, never the complete log.
        const id=randomUUID();await store.insert(id,owner,report);return send(201,{id,report});
      }
      if(req.url==='/v1/reports'&&req.method==='GET')return send(200,{reports:await store.list(owner)});
      const id=req.url?.match(/^\/v1\/reports\/([a-f0-9-]{36})$/)?.[1];
      if(id&&req.method==='DELETE'){await store.remove(id,owner);return send(200,{deleted:true});}
      send(404,{error:'Not found'});
    }catch{send(500,{error:'Request failed'});}
  });
}
