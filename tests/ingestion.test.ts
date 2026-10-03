import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createTestDatabase } from './database';
import { createIngestion, type ImportRepository, type ImportItem, type Photo, type PhotoStorage } from '../src/lib/photos/ingestion';
import { objectKey, variants, type PrepareInput } from '../src/lib/photos/model';

let db: PGlite; let source: Buffer;
const admin = '00000000-0000-4000-8000-000000000001'; const other = '00000000-0000-4000-8000-000000000002';
const trip = '30000000-0000-4000-8000-000000000001'; const location = '40000000-0000-4000-8000-000000000001';
const owner = <T>(fn: () => Promise<T>) => asRole(db,'authenticated',admin,fn);
before(async () => { db = await createTestDatabase(); source = await sharp({ create: { width: 800, height: 400, channels: 3, background: '#aabbcc' } }).jpeg().toBuffer(); });
after(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec('truncate public.countries,public.cities,public.locations,public.trips,public.trip_cities,public.trip_locations,public.hotels,public.stays,public.photos,public.import_items,public.import_batches,private.admin_identity,auth.users');
  await db.exec(await readFile('supabase/tests/fixtures.sql','utf8'));
});
function repo(): ImportRepository {
  const rpc = async (name: string, args: unknown[]) => (await db.query<{ result: unknown }>(`select public.${name}(${args.map((_,index)=>`$${index+1}`).join(',')}) as result`, args)).rows[0];
  return {
    async reserve(input) { return (await rpc('admin_reserve_context_photo_import',[input.id,input.batch_id,input.filename,input.file_hash,input.file_size,input.classification,input.context??'travel',input.hotel_id??null])).result as string; },
    async item(id) { const item = (await db.query<ImportItem>('select * from public.import_items where id=$1',[id])).rows[0]; if (!item) throw new Error('Item not found.'); return item; },
    async photo(id) { return (await db.query<Photo>('select * from public.photos where id=$1',[id])).rows[0] ?? null; },
    async claim(id,token,phase) { await rpc('admin_claim_photo_import',[id,token,phase]); },
    async markUpload(id,token,uploadId) { await rpc('admin_mark_photo_upload',[id,token,uploadId]); },
    async finalize(id,token,metadata) { await rpc('admin_finalize_photo_import',[id,token,JSON.stringify(metadata)]); },
    async fail(id,token,clean) { await rpc('admin_fail_photo_import',[id,token,clean]); },
    async beginDelete(id,token) { await rpc('admin_begin_photo_delete',[id,token]); },
    async finishDelete(id,token) { await rpc('admin_finish_photo_delete',[id,token]); },
    async failDelete(id,token) { await rpc('admin_fail_photo_delete',[id,token]); },
  };
}
class FakeR2 implements PhotoStorage {
  objects = new Map<string,Buffer>(); sessions = new Map<string,string>(); putCount = 0;
  failPutAt = 0; failCleanup = false; cleanups = 0;
  async createUpload(id: string) { const uploadId = randomUUID(); this.sessions.set(id,uploadId); return { uploadId, url: 'https://synthetic-upload.invalid/one-part' }; }
  async completeUpload(id: string, uploadId: string) { assert.equal(this.sessions.get(id),uploadId); this.sessions.delete(id); this.objects.set(objectKey(id,'source'),source); }
  async readSource(id: string) { return this.objects.get(objectKey(id,'source'))!; }
  async putDerivative(id: string, variant: 'large'|'medium'|'thumbnail'|'tiny', bytes: Buffer) {
    this.putCount++; if (this.putCount===this.failPutAt) throw new Error('Synthetic upload failure.'); this.objects.set(objectKey(id,variant),bytes);
  }
  async removeAll(id: string) {
    this.cleanups++; this.sessions.delete(id);
    for (const variant of variants) { this.objects.delete(objectKey(id,variant)); if (this.failCleanup) throw new Error('Synthetic cleanup failure.'); }
  }
}
async function input(): Promise<PrepareInput> {
  const batch_id = randomUUID();
  await db.query("select public.admin_create_import_batch($1,'Synthetic Lightroom export',1,1,0)",[batch_id]);
  return { id: randomUUID(), batch_id, filename: 'synthetic.jpg', path: '01 Nice/synthetic.jpg', classification: 'nice', file_hash: createHash('sha256').update(source).digest('hex'), file_size: source.length };
}
async function imported(storage = new FakeR2(), repository = repo()) {
  const data = await input(); const service = createIngestion(repository,storage); const prepared = await service.prepare(data);
  assert.equal(prepared.existing,false); if (prepared.existing) throw new Error('Unexpected duplicate.');
  await service.process(prepared.id,prepared.token);
  return { id: prepared.id, data, service, storage, repository };
}
test('complete import stores five objects, creates one ready Draft Photo and is retry-idempotent', async () => owner(async () => {
  const { id,data,service,storage,repository } = await imported();
  assert.equal(storage.objects.size,5); assert.deepEqual(storage.objects.get(objectKey(id,'source')),source);
  const photo = await repository.photo(id); assert.equal(photo?.status,'draft'); assert.equal(photo?.featured,false); assert.equal(photo?.classification,'nice'); assert.equal(photo?.context,'travel'); assert.equal(photo?.trip_id,null); assert.equal(photo?.processing_status,'ready'); assert.equal(photo?.derivative_profile,2);
  const cleanups = storage.cleanups;
  assert.deepEqual(await service.prepare(data),{ id,existing:true });
  const duplicate = await input(); assert.deepEqual(await service.prepare(duplicate),{ id,existing:true });
  assert.equal(storage.cleanups,cleanups); assert.equal((await db.query('select id from public.photos where file_hash=$1',[data.file_hash])).rows.length,1);
  await db.query('select public.admin_finish_import_batch($1)',[data.batch_id]);
  assert.equal((await db.query<{ imported: number }>('select imported from public.import_batches where id=$1',[data.batch_id])).rows[0].imported,1);
}));
test('reserved request rejects changed identity and simultaneous work until lease expiry', async () => owner(async () => {
  const data = await input(); const storage = new FakeR2(); const repository = repo(); const service = createIngestion(repository,storage);
  const prepared = await service.prepare(data); assert.equal(prepared.existing,false);
  await assert.rejects(service.prepare(data),/active operation/);
  await assert.rejects(service.prepare({ ...data,filename:'changed.jpg' }),/identity mismatch/);
  assert.equal(storage.sessions.size,1);
  await db.query("update public.import_items set lease_until=now()-interval '1 second' where id=$1",[data.id]);
  await service.cleanup(data.id); assert.equal(storage.sessions.size,0); assert.equal((await repository.item(data.id)).state,'failed');
}));
test('failed derivative upload cleans source and partial derivatives and leaves a retryable failure', async () => owner(async () => {
  const data = await input(); const storage = new FakeR2(); storage.failPutAt = 2;
  const repository = repo(); const service = createIngestion(repository,storage); const prepared = await service.prepare(data); if (prepared.existing) throw new Error('Unexpected duplicate.');
  await assert.rejects(service.process(prepared.id,prepared.token),/Storage was cleaned/);
  assert.equal(storage.objects.size,0); assert.equal(await repository.photo(data.id),null); assert.equal((await repository.item(data.id)).state,'failed');
  storage.failPutAt=0; const retry = await service.prepare(data); if (retry.existing) throw new Error('Unexpected duplicate.');
  await service.process(retry.id,retry.token); assert.equal(storage.objects.size,5); assert.equal((await repository.item(data.id)).state,'complete');
}));
test('a failed browser upload can be cancelled promptly without aborting an active processor', async () => owner(async () => {
  const data=await input(); const storage=new FakeR2(); const repository=repo(); const service=createIngestion(repository,storage);
  let prepared=await service.prepare(data); if (prepared.existing) throw new Error('Unexpected duplicate.');
  await assert.rejects(service.cancel(prepared.id,randomUUID()));
  await service.cancel(prepared.id,prepared.token); assert.equal(storage.sessions.size,0); assert.equal((await repository.item(data.id)).state,'failed');
  prepared=await service.prepare(data); if (prepared.existing) throw new Error('Unexpected duplicate.');
  await repository.claim(prepared.id,prepared.token,'process');
  await assert.rejects(service.cancel(prepared.id,prepared.token)); assert.equal(storage.sessions.size,1);
}));
test('cleanup failure remains explicit and can be recovered without a Photo record', async () => owner(async () => {
  const data = await input(); const storage = new FakeR2(); const repository=repo(); const service=createIngestion(repository,storage);
  const prepared=await service.prepare(data); if (prepared.existing) throw new Error('Unexpected duplicate.');
  storage.failPutAt=2; storage.failCleanup=true;
  await assert.rejects(service.process(prepared.id,prepared.token),/cleanup is incomplete/);
  assert.equal((await repository.item(data.id)).state,'cleanup_required'); assert.ok(storage.objects.size>0); assert.equal(await repository.photo(data.id),null);
  storage.failCleanup=false; await service.cleanup(data.id); assert.equal(storage.objects.size,0); assert.equal((await repository.item(data.id)).state,'failed');
}));
test('database failure before finalize commit rolls back objects, but lost response after commit preserves them', async () => owner(async () => {
  const data=await input(); const base=repo(); const storage=new FakeR2();
  const broken={ ...base, finalize: async () => { throw new Error('Synthetic DB failure.'); } };
  let service=createIngestion(broken,storage); let prepared=await service.prepare(data); if (prepared.existing) throw new Error('Unexpected duplicate.');
  await assert.rejects(service.process(prepared.id,prepared.token),/Storage was cleaned/); assert.equal(storage.objects.size,0);
  service=createIngestion({ ...base, finalize: async (id,token,metadata) => { await base.finalize(id,token,metadata); throw new Error('Response lost after commit.'); } },storage);
  prepared=await service.prepare(data); if (prepared.existing) throw new Error('Unexpected duplicate.');
  await service.process(prepared.id,prepared.token); assert.equal(storage.objects.size,5); assert.equal((await base.item(data.id)).state,'complete');
}));
test('uncertain finalize state does not destructively clean a potentially committed import', async () => owner(async () => {
  const data=await input(); const base=repo(); const storage=new FakeR2(); let uncertain=false;
  const repository={ ...base, photo: async (id: string) => { if (uncertain) throw new Error('Database unreachable.'); return base.photo(id); }, finalize: async (id: string,token: string,metadata: Parameters<ImportRepository['finalize']>[2]) => { await base.finalize(id,token,metadata); uncertain=true; throw new Error('Response lost.'); } };
  const service=createIngestion(repository,storage); const prepared=await service.prepare(data); if (prepared.existing) throw new Error('Unexpected duplicate.');
  await assert.rejects(service.process(prepared.id,prepared.token),/could not be confirmed/); assert.equal(storage.objects.size,5); assert.equal((await base.item(data.id)).state,'complete');
}));
test('partial deletion hides the Photo and stays retryable; full deletion leaves no objects and preserves history', async () => {
  let id=''; let batch='';
  await owner(async () => {
    const result=await imported(); id=result.id; batch=result.data.batch_id;
    await db.query("update public.photos set trip_id=$1,location_id=$2,status='published',featured=true where id=$3",[trip,location,id]);
    result.storage.failCleanup=true;
    await assert.rejects(result.service.delete(id),/Deletion is incomplete/);
    const hidden=await result.repository.photo(id); assert.equal(hidden?.status,'draft'); assert.equal(hidden?.featured,false); assert.equal(hidden?.processing_status,'failed'); assert.equal((await result.repository.item(id)).state,'deleting');
    result.storage.failCleanup=false; await result.service.delete(id);
    assert.equal(result.storage.objects.size,0); assert.equal(await result.repository.photo(id),null); assert.equal((await result.repository.item(id)).state,'deleted');
    await result.service.delete(id); // Repeating a confirmed delete is harmless.
    await db.query('select public.admin_finish_import_batch($1)',[batch]);
    assert.equal((await db.query<{ imported: number }>('select imported from public.import_batches where id=$1',[batch])).rows[0].imported,1);
  });
  await asRole(db,'anon',null,async () => { assert.equal((await db.query('select id from public.photos where id=$1',[id])).rows.length,0); });
});
test('cover references block deletion before storage changes; Draft parents and GPS stay private', async () => {
  let id='';
  await owner(async () => {
    const result=await imported(); id=result.id;
    await db.query('update public.trips set cover_photo_id=$1 where id=$2',[id,trip]);
    const before=result.storage.objects.size; await assert.rejects(result.service.delete(id),/covers/); assert.equal(result.storage.objects.size,before);
    await db.query("update public.photos set trip_id=$1,location_id=$2,status='published',latitude=1.2,longitude=103.8 where id=$3",[trip,location,id]);
    await db.query("update public.trips set status='draft' where id=$1",[trip]);
  });
  await asRole(db,'anon',null,async () => {
    assert.equal((await db.query('select id from public.photos where id=$1',[id])).rows.length,0);
    await assert.rejects(db.query('select latitude,longitude from public.photos'));
    await assert.rejects(db.query('select * from public.import_items'));
  });
});
test('loss of row visibility after a delete error is not treated as successful deletion', async () => owner(async () => {
  const result=await imported(); let lostVisibility=false;
  const repository={ ...result.repository,
    photo: async (id: string) => lostVisibility ? null : result.repository.photo(id),
    item: async (id: string) => { if (lostVisibility) throw new Error('Identity no longer authorized.'); return result.repository.item(id); },
    finishDelete: async () => { lostVisibility=true; throw new Error('Deletion did not commit.'); },
  };
  await assert.rejects(createIngestion(repository,result.storage).delete(result.id),/Deletion is incomplete/);
  assert.ok(await result.repository.photo(result.id)); assert.equal((await result.repository.item(result.id)).state,'deleting');
}));
test('new RPCs and import state reject anonymous and unrelated authenticated users', async () => {
  const id=randomUUID(); const token=randomUUID();
  const calls=[
    `select public.admin_create_import_batch('${id}','Intrusion',1,1,0)`,
    `select public.admin_reserve_photo_import('${id}','${id}','x.jpg','${'a'.repeat(64)}',1,'nice')`,
    `select public.admin_claim_photo_import('${id}','${token}','prepare')`,
    `select public.admin_mark_photo_upload('${id}','${token}','upload')`,
    `select public.admin_finalize_photo_import('${id}','${token}','{}')`,
    `select public.admin_fail_photo_import('${id}','${token}',true)`,
    `select public.admin_finish_import_batch('${id}',false)`,
    `select public.admin_begin_photo_delete('${id}','${token}')`,
    `select public.admin_finish_photo_delete('${id}','${token}')`,
    `select public.admin_fail_photo_delete('${id}','${token}')`,
  ];
  for (const role of ['anon','authenticated'] as const) await asRole(db,role,role==='authenticated'?other:null,async () => {
    for (const call of calls) await assert.rejects(db.query(call),(error: unknown) => typeof error==='object' && error!==null && 'code' in error && error.code==='42501');
    if (role==='authenticated') assert.equal((await db.query('select * from public.import_items')).rows.length,0);
  });
});
test('batch cap, request identity, metadata constraints and Record classification are enforced', async () => owner(async () => {
  const batch=randomUUID(); await assert.rejects(db.query("select public.admin_create_import_batch($1,'x',11,11,0)",[batch]));
  const data=await input(); await assert.rejects(db.query("select public.admin_create_import_batch($1,'different',1,1,0)",[data.batch_id]));
  const repository=repo(); const service=createIngestion(repository,new FakeR2());
  const prepared=await service.prepare({ ...data,classification:'record',path:'02 Record Shots/synthetic.jpg' }); if (prepared.existing) throw new Error('Unexpected duplicate.');
  await service.process(prepared.id,prepared.token); assert.equal((await repository.photo(data.id))?.classification,'record');
  const second={ ...data,id:randomUUID(),file_hash:createHash('sha256').update('another-source').digest('hex') }; await assert.rejects(repository.reserve(second),/file limit/);
  await assert.rejects(db.query("update public.photos set status='published' where id=$1",[data.id]));
  await assert.rejects(db.query("update public.photos set featured=true where id=$1",[data.id]));
}));

test('Hotel context uses the same five-object ingestion, failure compensation and recoverable deletion',async()=>owner(async()=>{
  const stayId='50000000-0000-4000-8000-000000000001';const data={...await input(),context:'hotel' as const,hotel_id:stayId};
  const storage=new FakeR2();const repository=repo();const service=createIngestion(repository,storage);
  storage.failPutAt=2;let prepared=await service.prepare(data);if(prepared.existing)throw new Error('Unexpected duplicate');
  await assert.rejects(service.process(prepared.id,prepared.token),/Storage was cleaned/);assert.equal(storage.objects.size,0);assert.equal((await repository.item(data.id)).hotel_id,null);
  storage.failPutAt=0;prepared=await service.prepare(data);if(prepared.existing)throw new Error('Unexpected duplicate');await service.process(prepared.id,prepared.token);
  const photo=await repository.photo(prepared.id);assert.equal(photo?.context,'hotel');assert.equal(photo?.hotel_id,stayId);assert.equal(photo?.location_id,null);assert.equal(photo?.trip_id,null);assert.equal(storage.objects.size,5);assert.deepEqual(storage.objects.get(objectKey(prepared.id,'source')),source);
  await assert.rejects(service.prepare({...data,context:'travel',hotel_id:null}),/another context or Hotel/);
  storage.failCleanup=true;await assert.rejects(service.delete(prepared.id),/hidden/);assert.equal((await repository.photo(prepared.id))?.processing_status,'failed');
  storage.failCleanup=false;await service.delete(prepared.id);assert.equal(storage.objects.size,0);assert.equal(await repository.photo(prepared.id),null);assert.equal((await repository.item(prepared.id)).hotel_id,null);
}));
