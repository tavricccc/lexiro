// Local wrangler entry: accepts the fixed tokens local-user-a and local-user-b.
import { createWorker } from "../src/index";
import { AuthenticationError } from "../src/auth";

export default createWorker({
  verify: async (request) => {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!["local-user-a", "local-user-b"].includes(token ?? "")) throw new AuthenticationError();
    return { uid: token!, email: `${token}@example.invalid`, emailVerified: true, authTime: Math.floor(Date.now() / 1000) };
  },
});
export { GameRoom } from "../src/rooms/game-room";
