import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Miniflare } from 'miniflare';
import { describe, expect, it } from 'vitest';
import { agentSetRevision, createAgentSet, mutateAgentSet, UNCATEGORIZED_FOLDER_ID, type AgentFolderMutation, type AgentCloudRecord } from '@lexiro/agent-contract';
import { D1AgentLibrary } from '../src/agent/library-repository';
import { handleCloudApi } from '../src/cloud/api';
import { DEFAULT_AI_MODEL } from '@lexiro/ai-contract';
import { snapshotRecords } from '../src/cloud/records';
import type { AgentEnv } from '../src/agent/types';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
async function fixture() {
  const runtime=new Miniflare({workers:[{config:{name:'agent-library-d1-test',compatibilityDate:'2026-10-10',manifest:{mainModule:'index.js',modules:{'index.js':{type:'esm',contents:"export default {fetch(){return new Response('synthetic')}}"}}},env:{CLOUD_DB:{type:'d1'}}}}]});
  const db=await runtime.getD1Database('CLOUD_DB');
  for(const file of (await readdir(new URL('../library-migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()) {
    const sql=await readFile(new URL(`../library-migrations/${file}`,import.meta.url),'utf8');
    await db.batch(sql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
  }
  const repo=new D1AgentLibrary({CLOUD_DB:db} as unknown as AgentEnv);
  await repo.create('a',createAgentSet(A,'合成 A'));
  await repo.create('b',createAgentSet(B,'合成 B'));
  return {runtime,db,repo};
}
function words(count:number) {
  return Array.from({length:count},(_,i)=>({word:`synthetic-${String(i).padStart(3,'0')}`,senses:[{pos:'n.',meaningZh:`合成項目${i}`,examples:[`This synthetic item belongs to example number ${i}.`]}]}));
}

describe('native D1 agent library with synthetic users',()=>{
  it('stores 200 words, rejects 201 without writing, and reuses a receipt exactly',async()=>{
    const f=await fixture();
    try {
      const before=(await f.repo.read('a',A))!;
      const revision=agentSetRevision(before),operationId=randomUUID();
      const action={type:'put_words',words:words(200)};
      const receipt=await f.repo.mutate('a',A,revision,operationId,action,s=>mutateAgentSet(s,action));
      const after=(await f.repo.read('a',A))!;
      expect(receipt.wordCount).toBe(200);
      expect(after.words).toHaveLength(200);
      expect(new Set(after.words.map(w=>w.wordKey)).size).toBe(200);
      expect(after.memberships).toHaveLength(200);
      expect(after.words.flatMap(w=>w.senses)).toHaveLength(200);
      expect(receipt.revision).toBe(agentSetRevision(after));
      expect(await f.repo.mutate('a',A,revision,operationId,action,()=>{throw new Error('must not execute a replay');})).toEqual(receipt);
      const different={type:'rename_set',setName:'不應寫入'};
      await expect(f.repo.mutate('a',A,revision,operationId,different,s=>mutateAgentSet(s,different))).rejects.toThrow();
      const oversized={type:'put_words',words:words(201)};
      await expect(f.repo.mutate('a',A,receipt.revision,randomUUID(),oversized,s=>mutateAgentSet(s,oversized))).rejects.toThrow();
      expect(agentSetRevision((await f.repo.read('a',A))!)).toBe(receipt.revision);
      await expect(f.repo.mutate('a',A,revision,randomUUID(),different,s=>mutateAgentSet(s,different))).rejects.toThrow();
      expect(await f.repo.read('b',A)).toBeNull();
      expect((await f.repo.list('a')).map(s=>s.id)).toEqual([A]);
      expect((await f.repo.list('b')).map(s=>s.id)).toEqual([B]);
    } finally {await f.runtime.dispose();}
  });

  it('allows only one mutation from a shared revision under concurrency',async()=>{
    const f=await fixture();
    try {
      const revision=agentSetRevision((await f.repo.read('a',A))!);
      const actions=[{type:'rename_set',setName:'修改一'},{type:'rename_set',setName:'修改二'}];
      const results=await Promise.allSettled(actions.map(action=>f.repo.mutate('a',A,revision,randomUUID(),action,s=>mutateAgentSet(s,action))));
      expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
      expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
      expect(actions.map(a=>a.setName)).toContain((await f.repo.read('a',A))!.set.setName);
    } finally {await f.runtime.dispose();}
  });

  it('handles folder CRUD, cycles, duplicate names, null root, movement and uid isolation',async()=>{
    const f=await fixture();
    try {
      const mutate=async(action:AgentFolderMutation)=>{const old=await f.repo.folders('a');return f.repo.mutateFolders('a',old.revision,randomUUID(),action);};
      const before=await f.repo.folders('a'),operationId=randomUUID();
      const create:AgentFolderMutation={type:'create_folder',name:'課程'};
      const root=await f.repo.mutateFolders('a',before.revision,operationId,create);
      expect(root.folder?.name).toBe('課程');
      expect(await f.repo.mutateFolders('a',before.revision,operationId,create)).toEqual(root);
      await expect(f.repo.mutateFolders('a',before.revision,operationId,{type:'create_folder',name:'不同操作'})).rejects.toThrow();
      await expect(f.repo.mutateFolders('a',before.revision,randomUUID(),{type:'create_folder',name:'舊版本'})).rejects.toThrow();
      await expect(mutate({type:'create_folder',name:'課程'})).rejects.toThrow();
      await expect(mutate({type:'create_folder',name:'子層',parentId:'missing'})).rejects.toThrow();
      const rootId=root.folder!.id;
      const child=await mutate({type:'create_folder',name:'子層',parentId:rootId});
      const childId=child.folder!.id;
      await expect(mutate({type:'update_folder',folderId:rootId,parentId:childId})).rejects.toThrow();
      await expect(mutate({type:'update_folder',folderId:rootId,parentId:rootId})).rejects.toThrow();
      await expect(mutate({type:'delete_folder',folderId:rootId})).rejects.toThrow();
      const renamed=await mutate({type:'update_folder',folderId:childId,name:'獨立單元',parentId:null});
      expect(renamed.folder?.name).toBe('獨立單元');
      expect(renamed.folder?.parentId).toBeUndefined();
      await expect(mutate({type:'update_folder',folderId:childId,name:'課程'})).rejects.toThrow();
      const foldersB=await f.repo.folders('b');
      expect(foldersB.folders.some(folder=>folder.id===rootId)).toBe(false);
      await expect(f.repo.mutateFolders('b',foldersB.revision,randomUUID(),{type:'update_folder',folderId:rootId,name:'跨使用者'})).rejects.toThrow();
      let snapshot=(await f.repo.read('a',A))!;
      const missing={type:'move_set',folderId:'missing'};
      await expect(f.repo.mutate('a',A,agentSetRevision(snapshot),randomUUID(),missing,s=>mutateAgentSet(s,missing))).rejects.toThrow();
      const move={type:'move_set',folderId:rootId};
      await f.repo.mutate('a',A,agentSetRevision(snapshot),randomUUID(),move,s=>mutateAgentSet(s,move));
      expect((await f.repo.read('a',A))!.set.folderId).toBe(rootId);
      await expect(mutate({type:'delete_folder',folderId:rootId})).rejects.toThrow();
      snapshot=(await f.repo.read('b',B))!;
      await expect(f.repo.mutate('b',B,agentSetRevision(snapshot),randomUUID(),move,s=>mutateAgentSet(s,move))).rejects.toThrow();
      snapshot=(await f.repo.read('a',A))!;
      const toRoot={type:'move_set',folderId:UNCATEGORIZED_FOLDER_ID};
      await f.repo.mutate('a',A,agentSetRevision(snapshot),randomUUID(),toRoot,s=>mutateAgentSet(s,toRoot));
      const deleted=await mutate({type:'delete_folder',folderId:rootId});
      expect(deleted.folder).toBeNull();
      expect(deleted.folders.some(folder=>folder.id===rootId)).toBe(false);
      await mutate({type:'delete_folder',folderId:childId});
      expect((await f.repo.read('b',B))!.set.setName).toBe('合成 B');
    } finally {await f.runtime.dispose();}
  });
});

describe('frontend synchronization API using the same native D1 records',()=>{
  it('pushes, paginates, replays, isolates users and exposes tombstones',async()=>{
    const f=await fixture();
    try {
      const origin=randomUUID();
      const push=async(uid:string,records:AgentCloudRecord[],operationId=randomUUID())=>{
        const response=await handleCloudApi(new Request('http://local.invalid/sync/records',{method:'POST',body:JSON.stringify({origin,operationId,records})}),uid,f.db);
        return response.json() as Promise<{revision:number;count:number}>;
      };
      const records=Array.from({length:402},(_,i)=>{
        const snapshot=createAgentSet(randomUUID(),`同步合成 ${i}`);
        return [...snapshotRecords(snapshot).values()].find(r=>r.type==='set')!;
      });
      const operationId=randomUUID(),first=await push('a',records.slice(0,400),operationId);
      expect(first.count).toBe(400);
      expect(await push('a',records.slice(0,400),operationId)).toEqual(first);
      await expect(push('a',records.slice(0,1),operationId)).rejects.toMatchObject({code:'operation_conflict'});
      await push('a',records.slice(400));
      const pull=async(uid:string,cursor='')=>{
        const response=await handleCloudApi(new Request(`http://local.invalid/sync/records?cursor=${encodeURIComponent(cursor)}`),uid,f.db);
        return response.json() as Promise<{records:AgentCloudRecord[];cursor:string;hasMore:boolean}>;
      };
      const page1=await pull('a');expect(page1.records).toHaveLength(400);expect(page1.hasMore).toBe(true);
      const page2=await pull('a',page1.cursor);expect(page2.hasMore).toBe(false);
      const all=[...page1.records,...page2.records];
      expect(all).toHaveLength(404);
      expect(new Set(all.map(r=>`${r.type}:${r.recordKey}`)).size).toBe(404);
      expect((await pull('a',page2.cursor)).records).toEqual([]);
      const other=await pull('b');expect(other.records).toHaveLength(2);expect(other.records.some(r=>r.recordKey===A)).toBe(false);
      await push('a',[{...records[0],deleted:true,payload:null}]);
      const deletion=await pull('a',page2.cursor);expect(deletion.records).toHaveLength(1);expect(deletion.records[0]).toMatchObject({recordKey:records[0].recordKey,deleted:true,payload:null});
      expect((await f.repo.list('a')).some(s=>s.id===records[0].recordKey)).toBe(false);
      await expect(pull('a','broken')).rejects.toMatchObject({code:'invalid_cursor'});
    } finally {await f.runtime.dispose();}
  });

  it('round trips frontend and Agent writes, and applies blob revision and operation checks',async()=>{
    const f=await fixture();
    try {
      const origin=randomUUID(),snapshot=mutateAgentSet(createAgentSet(randomUUID(),'前端建立'),{type:'put_words',words:words(2)}).snapshot!;
      const response=await handleCloudApi(new Request('http://local.invalid/sync/records',{method:'POST',body:JSON.stringify({origin,operationId:randomUUID(),records:[...snapshotRecords(snapshot).values()]})}),'a',f.db);
      expect(response.status).toBe(200);
      const read=(await f.repo.read('a',snapshot.set.id))!;
      expect(read.words.map(w=>w.word).sort()).toEqual(snapshot.words.map(w=>w.word).sort());
      const action={type:'rename_set',setName:'Agent 改名'};
      const operationId=randomUUID();
      await f.repo.mutate('a',snapshot.set.id,agentSetRevision(read),operationId,action,s=>mutateAgentSet(s,action));
      const pull=await handleCloudApi(new Request('http://local.invalid/sync/records'),'a',f.db);
      const feed=await pull.json() as {records:AgentCloudRecord[]};
      expect(feed.records.find(r=>r.type==='set'&&r.recordKey===snapshot.set.id)?.payload?.setName).toBe('Agent 改名');
      const status=await handleCloudApi(new Request('http://local.invalid/sync/status'),'a',f.db);
      expect((await status.json() as {changedBy:string}).changedBy).toBe(`agent:${operationId}`);
      const blobOperation=randomUUID();
      const envelope={origin,operationId:blobOperation,expectedRevision:0,blobs:[{kind:'preferences',data:{schemaVersion:1,model:DEFAULT_AI_MODEL,updatedAt:new Date().toISOString()}}]};
      const post=async(value:unknown,uid='a')=>{
        const result=await handleCloudApi(new Request('http://local.invalid/sync/blobs',{method:'POST',body:JSON.stringify(value)}),uid,f.db);
        return result.json();
      };
      expect(await post(envelope)).toEqual({revision:1});
      expect(await post(envelope)).toEqual({revision:1});
      await expect(post({...envelope,expectedRevision:1})).rejects.toMatchObject({code:'operation_conflict'});
      await expect(post({...envelope,operationId:randomUUID()})).rejects.toMatchObject({code:'cloud_conflict'});
      const blobs=await handleCloudApi(new Request('http://local.invalid/sync/blobs'),'a',f.db);
      const persisted=await blobs.json() as {revision:number;blobs:{preferences:{ownerId:string;schemaVersion:number}}};
      expect(persisted.revision).toBe(1);expect(persisted.blobs.preferences).toMatchObject({ownerId:'a',schemaVersion:1});
      const other=await handleCloudApi(new Request('http://local.invalid/sync/blobs'),'b',f.db);
      expect(await other.json()).toEqual({blobs:{},revision:0});
      await expect(post({...envelope,operationId:randomUUID(),expectedRevision:1,blobs:[{kind:'preferences',data:{}},{kind:'preferences',data:{}}]})).rejects.toMatchObject({code:'duplicate_blob'});
    } finally {await f.runtime.dispose();}
  });
});
