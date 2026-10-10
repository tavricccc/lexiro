import { importPKCS8, SignJWT } from 'jose';
import { z } from 'zod';
import type { AgentEnv } from './types';
const accountSchema = z.object({ project_id:z.string(),client_email:z.string().email(),private_key:z.string() });
export function googleAccessToken(env: AgentEnv, fetcher: typeof fetch = fetch) {
  let cached: { token:string; expires:number } | undefined;
  let pending: Promise<string> | undefined;
  return async () => {
    if (cached && cached.expires>Date.now()) return cached.token;
    if (!pending) pending=(async()=>{
      const account=accountSchema.parse(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT));
      if (account.project_id!==env.FIREBASE_PROJECT_ID) throw new Error('Firebase service account 與專案不符');
      const assertion=await new SignJWT({scope:'https://www.googleapis.com/auth/datastore'}).setProtectedHeader({alg:'RS256'}).setIssuer(account.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(await importPKCS8(account.private_key,'RS256'));
      const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('Firebase 後端認證失敗');
      const result=z.object({access_token:z.string(),expires_in:z.number()}).parse(await response.json());
      cached={token:result.access_token,expires:Date.now()+(result.expires_in-60)*1000};
      return cached.token;
    })().finally(()=>{pending=undefined;});
    return pending;
  };
}
