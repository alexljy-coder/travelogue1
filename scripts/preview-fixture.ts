// Local-only disposable public data fixture. Never run against hosted Supabase.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createTestDatabase,asRole} from '../tests/database';
import {createAnonymousFetch} from '../tests/public-client';
const db=await createTestDatabase();await db.exec(await readFile('supabase/tests/fixtures.sql','utf8'));
await db.exec("update public.countries set code='SG' where code='VC'; update public.photos set latitude=1.23456789,longitude=103.98765432 where id='70000000-0000-4000-8000-000000000003'; update public.hotels set rating=4,review_text='A current personal review. A quiet second paragraph.',recommended_business=true where slug='published-hotel';");
const transport=createAnonymousFetch(db,[],'sb_publishable_fixture_only');
const server=createServer(async(req,res)=>{
 try{
  const adminId='00000000-0000-4000-8000-000000000001';
  const token=process.env.LOCAL_FIXTURE_ADMIN_TOKEN;
  const admin=!!token && req.headers.authorization===`Bearer ${token}`;
  if(admin && req.url?.startsWith('/auth/v1/user')){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({id:adminId,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',app_metadata:{},user_metadata:{}}));return;}
  if(admin && req.url?.startsWith('/rest/v1/rpc/is_admin')){const rows=await asRole(db,'authenticated',adminId,()=>db.query<{is_admin:boolean}>('select public.is_admin()'));res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(rows.rows[0].is_admin));return;}
  if(admin && req.url?.startsWith('/rest/v1/') && ['GET','HEAD'].includes(req.method??'')){
   const url=new URL('http://localhost'+req.url),table=url.pathname.split('/').at(-1)!;
   if(!['hotels','photos','countries','cities','trips','import_items','import_batches'].includes(table))throw new Error('Unknown fixture table');
   const select=url.searchParams.get('select')??'*';if(!/^(\*|[a-z_,]+)$/.test(select))throw new Error('Invalid fixture projection');
   const values:string[]=[],where:string[]=[];
   for(const [key,value] of url.searchParams){if(['select','order','limit','offset'].includes(key))continue;if(!/^[a-z_]+$/.test(key)||!value.startsWith('eq.'))throw new Error('Invalid fixture filter');values.push(value.slice(3));where.push(`${key}=$${values.length}`);}
   const filter=where.length?' where '+where.join(' and '):'';
   const rows=await asRole(db,'authenticated',adminId,()=>db.query(`select ${select} from public.${table}${filter} limit ${Number(url.searchParams.get('limit')??500)} offset ${Number(url.searchParams.get('offset')??0)}`,values));
   const count=await db.query<{n:number}>(`select count(*)::integer n from public.${table}${filter}`,values);
   res.writeHead(200,{'Content-Type':'application/json','Content-Range':`0-${rows.rows.length-1}/${count.rows[0].n}`});res.end(req.method==='HEAD'?'':JSON.stringify(String(req.headers.accept).includes('vnd.pgrst.object')?rows.rows[0]:rows.rows));return;
  }
  if(req.url?.startsWith('/auth/')){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"message":"Fixture has no session"}');return;}
  const chunks:Buffer[]=[];for await(const part of req)chunks.push(Buffer.from(part));
  const result=await transport('http://127.0.0.1:54329'+req.url,{method:req.method,headers:req.headers as HeadersInit,body:chunks.length?Buffer.concat(chunks).toString():undefined});
  res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
 }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end('{"message":"Fixture query failed"}');}
});
server.listen(54329,'127.0.0.1',()=>console.log('Disposable public fixture listening on 54329'));
async function close(){server.close();await db.close();process.exit(0);}
process.on('SIGTERM',close);process.on('SIGINT',close);
