import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {createApi} from './api.js';
const {DATABASE_URL,API_TOKEN,PGSSLROOTCERT,PORT='8787',HOST='127.0.0.1'}=process.env;
if(!DATABASE_URL || !PGSSLROOTCERT)throw new Error('Set DATABASE_URL and PGSSLROOTCERT (trusted Azure CA bundle path).');
const pool=new pg.Pool({connectionString:DATABASE_URL,ssl:{rejectUnauthorized:true,ca:await readFile(PGSSLROOTCERT,'utf8')},max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
pool.on('error',()=>console.error('Database connection error; check server-side configuration.'));
const store={
  insert:(id,owner,report)=>pool.query('INSERT INTO devrescue.reports (id,owner_id,report) VALUES ($1,$2,$3)',[id,owner,report]),
  list:async owner=>(await pool.query('SELECT id,created_at,report FROM devrescue.reports WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100',[owner])).rows,
  remove:(id,owner)=>pool.query('DELETE FROM devrescue.reports WHERE id=$1 AND owner_id=$2',[id,owner])
};
const server=createApi({store,apiToken:API_TOKEN});
server.listen(Number(PORT),HOST,()=>console.log('DevRescue API listening.'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(async()=>{await pool.end();process.exit(0);}));
