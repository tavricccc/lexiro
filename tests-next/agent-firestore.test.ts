import { describe, expect, it } from 'vitest';
import { exportPKCS8, generateKeyPair } from 'jose';
import { agentRecordId, agentSetRevision, createAgentSet, mutateAgentSet } from '@lexiro/agent-contract';
import { FirestoreAgentLibrary } from '../src/agent/library-repository';
import { decodeFields, encodeFields, type FirestoreDocument } from '../src/agent/firestore-values';
import type { AgentEnv } from '../src/agent/types';

const setId='11111111-1111-4111-8111-111111111111';
const secondId='22222222-2222-4222-8222-222222222222';
const putWords={type:'put_words',words:[{word:'rescue',senses:[{pos:'v.',meaningZh:'救援',examples:['The volunteers rescued the stranded hikers.']}]},{word:'shelter',senses:[{pos:'n.',meaningZh:'避難所',examples:['They found shelter before the storm.']}]}]};

async function fixture() {
  const {privateKey}=await generateKeyPair('RS256',{extractable:true});
  const env={FIREBASE_PROJECT_ID:'local-project',FIREBASE_SERVICE_ACCOUNT:JSON.stringify({project_id:'local-project',client_email:'fixture@example.test',private_key:await exportPKCS8(privateKey)})} as AgentEnv;
  const docs=new Map<string,FirestoreDocument>();
  const root='projects/local-project/databases/(default)/documents/users/u/';
  let commits=0;
  const fetcher:typeof fetch=async(input,init)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    if (url.hostname==='oauth2.googleapis.com') return Response.json({access_token:'synthetic',expires_in:3600});
    const body=JSON.parse(String(init?.body));
    if (url.pathname.endsWith(':beginTransaction')) return Response.json({transaction:crypto.randomUUID()});
    if (url.pathname.endsWith(':rollback')) return Response.json({});
    if (url.pathname.endsWith(':batchGet')) return Response.json((body.documents as string[]).map(name=>docs.has(name)?{found:docs.get(name)}:{missing:name}).reverse());
    if (url.pathname.endsWith(':runQuery')) return Response.json([...docs.values()].filter(doc=>doc.name.startsWith(root+'records-v9/') && decodeFields(doc.fields).type===body.structuredQuery.where.fieldFilter.value.stringValue).reverse().map(document=>({document})));
    if (url.pathname.endsWith(':commit')) {
      commits++;
      for (const write of body.writes as {update:FirestoreDocument;updateTransforms?:{fieldPath:string}[]}[]) {
        const doc=structuredClone(write.update);
        for (const transform of write.updateTransforms ?? []) doc.fields[transform.fieldPath]={timestampValue:new Date().toISOString()};
        docs.set(doc.name,doc);
      }
      return Response.json({commitTime:new Date().toISOString()});
    }
    throw new Error(`Unexpected local request ${url.pathname}`);
  };
  return {repo:new FirestoreAgentLibrary(env,fetcher),docs,root,commits:()=>commits};
}

describe('production Firestore agent repository with synthetic REST transport',()=>{
  it('writes native scoped records and atomically reuses an operation receipt',async()=>{
    const f=await fixture();
    await f.repo.create('u',createAgentSet(setId,'測試'));
    const before=(await f.repo.read('u',setId))!;
    const operationId=crypto.randomUUID();
    const revision=agentSetRevision(before);
    const receipt=await f.repo.mutate('u',setId,revision,operationId,putWords,snapshot=>mutateAgentSet(snapshot,putWords));
    const after=(await f.repo.read('u',setId))!;
    expect(after.words.map(word=>word.word).sort()).toEqual(['rescue','shelter']);
    expect(receipt.revision).toBe(agentSetRevision(after));
    const commits=f.commits();
    expect(await f.repo.mutate('u',setId,revision,operationId,putWords,()=>{throw new Error('must not apply twice');})).toEqual(receipt);
    expect(f.commits()).toBe(commits);
    expect(decodeFields(f.docs.get(f.root+'meta/library-v9')!.fields).changedBy).toBe(`agent:${operationId}`);
    await expect(f.repo.mutate('u',setId,revision,crypto.randomUUID(),putWords,snapshot=>mutateAgentSet(snapshot,putWords))).rejects.toMatchObject({status:409,code:'stale_set'});
    expect(await f.repo.read('other-user',setId)).toBeNull();
  });
  it('deletes only set sources and keeps other learning progress and history',async()=>{
    const f=await fixture();
    const first=mutateAgentSet(createAgentSet(setId,'刪除'),putWords).snapshot!;
    const second=mutateAgentSet(createAgentSet(secondId,'保留'),putWords).snapshot!;
    await f.repo.create('u',first);await f.repo.create('u',second);
    const removed=first.words[0].senses[0].id,retained=second.words[0].senses[0].id;
    f.docs.set(f.root+'progress/global-v9',{name:f.root+'progress/global-v9',fields:encodeFields({ownerId:'u',schemaVersion:9,cards:{[removed]:{lastReview:'2026-10-01'},[retained]:{lastReview:'2026-10-02'}}})});
    f.docs.set(f.root+'stats/summary-v9',{name:f.root+'stats/summary-v9',fields:encodeFields({ownerId:'u',schemaVersion:9,questionStatsBySense:{[removed]:{total:2},[retained]:{total:3}},dailyHistory:{'2026-10-01':{questionTotal:5}}})});
    await f.repo.mutate('u',setId,agentSetRevision(first),crypto.randomUUID(),{type:'delete_set'},snapshot=>mutateAgentSet(snapshot,{type:'delete_set'}));
    expect(await f.repo.read('u',setId)).toBeNull();
    expect(await f.repo.read('u',secondId)).toEqual(second);
    expect(decodeFields(f.docs.get(f.root+'progress/global-v9')!.fields).cards).toEqual({[retained]:{lastReview:'2026-10-02'}});
    expect(decodeFields(f.docs.get(f.root+'stats/summary-v9')!.fields).dailyHistory).toEqual({'2026-10-01':{questionTotal:5}});
    expect(decodeFields(f.docs.get(f.root+`records-v9/${agentRecordId('word',first.words[0].wordKey)}`)!.fields).deleted).toBe(true);
  });
  it('rejects a colliding question ID before committing anything',async()=>{
    const f=await fixture();
    const snapshot=mutateAgentSet(createAgentSet(setId,'測試'),putWords).snapshot!;
    await f.repo.create('u',snapshot);
    const id='question-owned-by-other-set';
    const path=f.root+`records-v9/${agentRecordId('question',id)}`;
    f.docs.set(path,{name:path,fields:encodeFields({type:'question',deleted:false,payload:{id,kind:'multipleChoice',wordKey:'word-other-set'}})});
    const action={type:'put_questions',questions:[{id,kind:'multipleChoice',questionStyle:'vocabulary',difficulty:1,wordKey:snapshot.words[0].wordKey,senseId:snapshot.words[0].senses[0].id,prompt:'The team _____ the hikers.',options:['rescued','ignored','watched','followed'],answerIndex:0}]};
    const commits=f.commits();
    await expect(f.repo.mutate('u',setId,agentSetRevision(snapshot),crypto.randomUUID(),action,before=>mutateAgentSet(before,action))).rejects.toMatchObject({status:403,code:'question_outside_scope'});
    expect(f.commits()).toBe(commits);
    expect(decodeFields(f.docs.get(path)!.fields).payload).toMatchObject({wordKey:'word-other-set'});
  });
});
