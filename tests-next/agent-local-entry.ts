import { createAgentWorker } from '../src/agent/index';
import { agentSetRevision, createAgentSet, type AgentSetSnapshot, type AgentMutationResult } from '@lexiro/agent-contract';
import type { AgentEnv, AgentLibraryRepository, MutationReceipt } from '../src/agent/types';
import { HttpError, fingerprint } from '../src/http';
import { AuthenticationError } from '../src/auth';
class LocalAgentLibrary implements AgentLibraryRepository {
  constructor(private env:AgentEnv) {}
  async list(uid:string) { const result=await this.env.AGENT_DB.prepare('SELECT snapshot FROM local_agent_sets WHERE uid=? AND snapshot IS NOT NULL').bind(uid).all<{snapshot:string}>();return result.results.map(row=>{const value=JSON.parse(row.snapshot) as AgentSetSnapshot;return {id:value.set.id,setName:value.set.setName};}); }
  async read(uid:string,setId:string) { const row=await this.env.AGENT_DB.prepare('SELECT snapshot FROM local_agent_sets WHERE uid=? AND set_id=?').bind(uid,setId).first<{snapshot:string|null}>();return row?.snapshot?JSON.parse(row.snapshot) as AgentSetSnapshot:null; }
  async create(uid:string,snapshot:AgentSetSnapshot) { const old=await this.read(uid,snapshot.set.id);if(old)throw new HttpError(409,'set_exists');await this.env.AGENT_DB.prepare('INSERT INTO local_agent_sets(uid,set_id,snapshot,revision) VALUES(?,?,?,?)').bind(uid,snapshot.set.id,JSON.stringify(snapshot),agentSetRevision(snapshot)).run(); }
  async mutate(uid:string,setId:string,revision:string,operationId:string,action:unknown,apply:(snapshot:AgentSetSnapshot)=>AgentMutationResult) {
    const hash=await fingerprint(JSON.stringify({setId,revision,action}));
    const previous=await this.env.AGENT_DB.prepare('SELECT input_hash,receipt FROM local_agent_operations WHERE uid=? AND id=?').bind(uid,operationId).first<{input_hash:string;receipt:string}>();
    if(previous) {if(previous.input_hash!==hash)throw new HttpError(409,'operation_conflict');return JSON.parse(previous.receipt) as MutationReceipt;}
    const before=await this.read(uid,setId);if(!before)throw new HttpError(404,'set_not_found');if(agentSetRevision(before)!==revision)throw new HttpError(409,'stale_set');
    const {snapshot:after}=apply(before);
    const receipt:MutationReceipt={operationId,setId,revision:agentSetRevision(after),wordCount:after?.words.length ?? 0,questionCount:after?.questions.length ?? 0,deleted:!after};
    const updated=await this.env.AGENT_DB.prepare('UPDATE local_agent_sets SET snapshot=?,revision=? WHERE uid=? AND set_id=? AND revision=? RETURNING set_id').bind(after?JSON.stringify(after):null,receipt.revision,uid,setId,revision).first();if(!updated)throw new HttpError(409,'stale_set');
    await this.env.AGENT_DB.prepare('INSERT INTO local_agent_operations(uid,id,input_hash,receipt) VALUES(?,?,?,?)').bind(uid,operationId,hash,JSON.stringify(receipt)).run();return receipt;
  }
}
const worker=createAgentWorker({verify:async(request)=>{const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!['local-user-a','local-user-b'].includes(token ?? ''))throw new AuthenticationError();return {uid:token!,email:`${token}@example.invalid`,emailVerified:true};},repository:env=>new LocalAgentLibrary(env)});
export default {async fetch(request:Request,env:AgentEnv,context:Parameters<typeof worker.fetch>[2]) {
  if(new URL(request.url).pathname==='/__local/seed' && request.method==='POST') {
    const repo=new LocalAgentLibrary(env);for(const [uid,id,name] of [['local-user-a','11111111-1111-4111-8111-111111111111','本機測試單字集'],['local-user-a','22222222-2222-4222-8222-222222222222','不可修改的另一集'],['local-user-b','33333333-3333-4333-8333-333333333333','另一位使用者']])if(!await repo.read(uid,id))await repo.create(uid,createAgentSet(id,name));
    return Response.json({seeded:true});
  }
  return worker.fetch(request,env,context);
}};
