import WebSocket from "ws";

const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error("OPENAI_API_KEY is required for the deployment transport probe");
const endpoint = new URL(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}/responses`);
endpoint.protocol = "wss:";
await new Promise((resolve, reject) => {
  const socket = new WebSocket(endpoint, { headers: { Authorization: `Bearer ${key}` }, handshakeTimeout: 15_000 });
  socket.once("open", () => { console.log(JSON.stringify({ transport: "websocket", handshake: "accepted", generatedTokens: 0 })); socket.close(1000); resolve(); });
  socket.once("error", () => reject(new Error("Provider WebSocket handshake failed; production was not changed")));
});
