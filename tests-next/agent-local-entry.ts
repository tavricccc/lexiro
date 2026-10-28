import { createAgentWorker } from "../src/agent/index";
import { createAgentSet } from "@lexiro/agent-contract";
import type { AgentEnv } from "../src/agent/types";
import { D1AgentLibrary } from "../src/agent/library-repository";
import { AuthenticationError } from "../src/auth";
const worker = createAgentWorker({
  verify: async request => {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!["local-user-a", "local-user-b"].includes(token ?? "")) throw new AuthenticationError();
    return { uid: token!, email: `${token}@example.invalid`, emailVerified: true, authTime: Math.floor(Date.now() / 1000) };
  },
});
export default {
  async fetch(request: Request, env: AgentEnv, context: Parameters<typeof worker.fetch>[2]) {
    if (new URL(request.url).pathname === "/__local/seed" && request.method === "POST") {
      const repo = new D1AgentLibrary(env);
      for (const [uid,id,name] of [
        ["local-user-a","11111111-1111-4111-8111-111111111111","本機測試單字集"],
        ["local-user-a","22222222-2222-4222-8222-222222222222","不可修改的另一集"],
        ["local-user-b","33333333-3333-4333-8333-333333333333","另一位使用者"],
      ]) if (!(await repo.read(uid,id))) await repo.create(uid, createAgentSet(id,name));
      return Response.json({ seeded: true });
    }
    return worker.fetch(request, env, context);
  },
};
