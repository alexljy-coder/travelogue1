// Local-only disposable public data fixture. Never run against hosted Supabase.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createTestDatabase} from '../tests/database';
import {createAnonymousFetch} from '../tests/public-client';
const db=await createTestDatabase();await db.exec(await readFile('supabase/tests/fixtures.sql','utf8'));
await db.exec("update public.countries set code='SG' where code='VC'; update public.photos set latitude=1.23456789,longitude=103.98765432 where id='70000000-0000-4000-8000-000000000003'; update public.hotels set rating=4,review_text='A current personal review.\\nA quiet second paragraph.',recommended_business=true where slug='published-hotel';");
const transport=createAnonymousFetch(db,[],'sb_publishable_fixture_only');
const server=createServer(async(req,res)=>{
 try{
  if(req.url?.startsWith('/auth/')){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"message":"Fixture has no session"}');return;}
  const chunks:Buffer[]=[];for await(const part of req)chunks.push(Buffer.from(part));
  const result=await transport('http://127.0.0.1:54329'+req.url,{method:req.method,headers:req.headers as HeadersInit,body:chunks.length?Buffer.concat(chunks).toString():undefined});
  res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
 }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end('{"message":"Fixture query failed"}');}
});
server.listen(54329,'127.0.0.1',()=>console.log('Disposable public fixture listening on 54329'));
async function close(){server.close();await db.close();process.exit(0);}
process.on('SIGTERM',close);process.on('SIGINT',close);
