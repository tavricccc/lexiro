import { z } from 'zod';
import { agentGenerationBrief, agentSetRevision, createAgentSet, mutateAgentSet, type GeneratedQuestionKind, type QuestionDifficulty } from '@lexiro/agent-contract';
import { HttpError } from '../http';
import { questionPrompt } from '../question-prompts';
import { jsonSchema, questionOutput } from '../schemas';
import type { AgentIdentity, AgentLibraryRepository } from './types';
export const mutationEnvelope=z.strictObject({expectedRevision:z.string().regex(/^[a-f0-9]{32}$/),operationId:z.string().uuid(),action:z.unknown()});
export function scopedSet(identity:AgentIdentity,setId:string) {
  if (identity.setId && identity.setId!==setId) throw new HttpError(403,'set_outside_scope');
  return setId;
}
export async function readAgentSet(repo:AgentLibraryRepository,identity:AgentIdentity,setId:string) {
  const snapshot=await repo.read(identity.uid,scopedSet(identity,setId));
  if (!snapshot) throw new HttpError(404,'set_not_found');
  return {snapshot,revision:agentSetRevision(snapshot)};
}
export async function applyAgentMutation(repo:AgentLibraryRepository,identity:AgentIdentity,setId:string,value:unknown) {
  const input=mutationEnvelope.parse(value);
  return repo.mutate(identity.uid,scopedSet(identity,setId),input.expectedRevision,input.operationId,input.action,snapshot=>{
    try { return mutateAgentSet(snapshot,input.action); }
    catch (reason) { const error=new HttpError(400,'invalid_content');error.message=reason instanceof Error?reason.message:'內容格式錯誤';throw error; }
  });
}
export async function createScopedSet(repo:AgentLibraryRepository,identity:AgentIdentity,setName:string) {
  const id=identity.setId ?? crypto.randomUUID();
  const snapshot=createAgentSet(id,setName);
  await repo.create(identity.uid,snapshot);
  return {snapshot,revision:agentSetRevision(snapshot)};
}
export async function readGenerationBrief(repo:AgentLibraryRepository,identity:AgentIdentity,setId:string,kind:GeneratedQuestionKind,difficulty:QuestionDifficulty,senseIds?:string[]) {
  const {snapshot,revision}=await readAgentSet(repo,identity,setId);
  const brief=agentGenerationBrief(snapshot,kind,difficulty,senseIds);
  const prompt=questionPrompt(kind,brief.sources,difficulty);
  return {...brief,setId,revision,rules:prompt.instructions,specification:prompt.input,outputSchema:jsonSchema(questionOutput(kind))};
}
