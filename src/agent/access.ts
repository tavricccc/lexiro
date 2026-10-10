import { z } from 'zod';
import { fingerprint, HttpError } from '../http';
import type { AgentEnv, AgentIdentity } from './types';
export const linkOptions = z.strictObject({ setId:z.string().uuid(), expiresInSeconds:z.number().int().min(300).max(86400).default(7200) });
export async function createAgentLink(env:AgentEnv,uid:string,input:unknown) {
  const {setId,expiresInSeconds}=linkOptions.parse(input),id=crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const now=Date.now(),expiresAt=now+expiresInSeconds*1000;
  await env.AGENT_DB.prepare('INSERT INTO agent_links(id,token_hash,uid,set_id,created_at,expires_at) VALUES(?,?,?,?,?,?)').bind(id,await fingerprint(token),uid,setId,now,expiresAt).run();
  return {id,setId,expiresAt,url:`${env.AGENT_PUBLIC_URL}/access/${id}?token=${token}`};
}
export async function linkIdentity(request:Request,env:AgentEnv,id:string):Promise<AgentIdentity> {
  const header=request.headers.get('authorization');
  const token=header?.startsWith('Bearer ')?header.slice(7):new URL(request.url).searchParams.get('token');
  if (!token) throw new HttpError(401,'link_unauthorized');
  const link=await env.AGENT_DB.prepare('SELECT uid,set_id,expires_at,revoked_at FROM agent_links WHERE id=? AND token_hash=?').bind(id,await fingerprint(token)).first<{uid:string;set_id:string;expires_at:number;revoked_at:number|null}>();
  if (!link) throw new HttpError(401,'link_unauthorized');
  if (link.revoked_at!==null || link.expires_at<=Date.now()) throw new HttpError(410,'link_expired');
  return {uid:link.uid,email:'',setId:link.set_id};
}
