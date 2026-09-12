import type { AiProtocol, AiTurnResult, AiUsage } from "@/src/types/ai";
import { isRecord } from "../schema";

const record = (v: unknown): Record<string, unknown> => (isRecord(v) ? v : {});
const array = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const string = (v: unknown) => (typeof v === "string" ? v : "");
const number = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
export const emptyReply = (): AiTurnResult => ({
  text: "",
  usage: {},
  complete: false,
  stopReason: "unknown",
});
export function usageOf(protocol: AiProtocol, value: unknown): AiUsage {
  const u = record(value);
  const details = record(u.input_tokens_details ?? u.prompt_tokens_details);
  if (protocol === "generateContent")
    return {
      inputTokens: number(u.promptTokenCount),
      outputTokens:
        number(u.candidatesTokenCount) === undefined
          ? undefined
          : Number(u.candidatesTokenCount) +
            (number(u.thoughtsTokenCount) ?? 0),
      cacheReadTokens: number(u.cachedContentTokenCount),
    };
  if (protocol === "interactions")
    return {
      inputTokens: number(u.total_input_tokens),
      outputTokens:
        number(u.total_output_tokens) === undefined
          ? undefined
          : Number(u.total_output_tokens) +
            (number(u.total_thought_tokens) ?? 0),
      cacheReadTokens: number(u.total_cached_tokens),
    };
  if (protocol === "messages") {
    const base = number(u.input_tokens),
      read = number(u.cache_read_input_tokens),
      write = number(u.cache_creation_input_tokens);
    return {
      inputTokens:
        base === undefined ? undefined : base + (read ?? 0) + (write ?? 0),
      outputTokens: number(u.output_tokens),
      cacheReadTokens: read,
      cacheWriteTokens: write,
    };
  }
  return {
    inputTokens: number(u.input_tokens ?? u.prompt_tokens),
    outputTokens: number(u.output_tokens ?? u.completion_tokens),
    cacheReadTokens: number(details.cached_tokens),
    cacheWriteTokens: number(details.cache_write_tokens),
  };
}
export function mergeUsage(a: AiUsage, b: AiUsage): AiUsage {
  const result = { ...a };
  for (const key of Object.keys(b) as (keyof AiUsage)[])
    if (b[key] !== undefined) result[key] = b[key];
  return result;
}
export function addUsage(a: AiUsage, b: AiUsage): AiUsage {
  const result = { ...a };
  for (const key of Object.keys(b) as (keyof AiUsage)[])
    if (b[key] !== undefined) result[key] = (a[key] ?? 0) + b[key]!;
  return result;
}
function stop(value: unknown): AiTurnResult["stopReason"] {
  if (
    ["length", "max_tokens", "MAX_TOKENS", "max_output_tokens"].includes(
      String(value),
    )
  )
    return "truncated";
  if (
    [
      "refusal",
      "content_filter",
      "SAFETY",
      "RECITATION",
      "PROHIBITED_CONTENT",
      "BLOCKLIST",
    ].includes(String(value))
  )
    return "blocked";
  return ["stop", "end_turn", "stop_sequence", "STOP", "completed"].includes(
    String(value),
  )
    ? "complete"
    : "unknown";
}
function textBlocks(value: unknown): string {
  return array(value)
    .map((block) => {
      const b = record(block);
      if (b.type === "thinking" || b.type === "thought" || b.thought === true)
        return "";
      return string(b.text) || textBlocks(b.content);
    })
    .join("");
}
export function readReply(
  protocol: AiProtocol,
  data: Record<string, unknown>,
): AiTurnResult {
  const reply = emptyReply();
  reply.id = string(data.id) || undefined;
  reply.usage = usageOf(protocol, data.usage ?? data.usageMetadata);
  if (protocol === "responses") {
    reply.text = string(data.output_text) || textBlocks(data.output);
    reply.stopReason = stop(
      data.status === "incomplete"
        ? record(data.incomplete_details).reason
        : data.status,
    );
    if (
      array(data.output).some((o) =>
        array(record(o).content).some((c) => record(c).type === "refusal"),
      )
    )
      reply.stopReason = "blocked";
    reply.complete = ["completed", "incomplete"].includes(string(data.status));
  } else if (protocol === "interactions") {
    reply.text =
      string(data.output_text) ||
      textBlocks(data.outputs) ||
      array(data.steps)
        .filter((s) => record(s).type === "model_output")
        .map((s) => textBlocks(record(s).content))
        .join("");
    reply.stopReason =
      data.status === "incomplete"
        ? "truncated"
        : stop(data.stop_reason ?? data.status);
    reply.complete = ["completed", "incomplete"].includes(string(data.status));
  } else if (protocol === "messages") {
    reply.text = textBlocks(data.content);
    reply.stopReason = stop(data.stop_reason);
    reply.complete = Boolean(data.stop_reason);
  } else if (protocol === "generateContent") {
    const c = record(array(data.candidates)[0]);
    reply.text = textBlocks(record(c.content).parts);
    reply.stopReason = stop(c.finishReason);
    reply.complete = Boolean(c.finishReason);
    if (record(data.promptFeedback).blockReason) {
      reply.stopReason = "blocked";
      reply.complete = true;
    }
  } else {
    const c = record(array(data.choices)[0]),
      m = record(c.message);
    reply.text = string(m.content) || textBlocks(m.content);
    reply.stopReason = m.refusal ? "blocked" : stop(c.finish_reason);
    reply.complete = Boolean(c.finish_reason);
  }
  return reply;
}
/** Mutates one in-flight reply; only terminal events may finish it. */
export function consumeEvent(
  protocol: AiProtocol,
  data: Record<string, unknown>,
  reply: AiTurnResult,
) {
  const type = string(data.type ?? data.event_type);
  reply.usage = mergeUsage(
    reply.usage,
    usageOf(protocol, data.usage ?? data.usageMetadata),
  );
  if (protocol === "responses") {
    const r = record(data.response);
    if (r.id) reply.id = string(r.id);
    if (type === "response.output_text.delta") reply.text += string(data.delta);
    if (type === "response.refusal.delta") reply.stopReason = "blocked";
    if (["response.completed", "response.incomplete"].includes(type)) {
      const final = readReply(protocol, r);
      Object.assign(reply, {
        ...final,
        text: final.text || reply.text,
        usage: mergeUsage(reply.usage, final.usage),
        stopReason:
          reply.stopReason === "blocked" ? "blocked" : final.stopReason,
      });
    }
  } else if (protocol === "interactions") {
    const interaction = record(data.interaction),
      delta = record(data.delta);
    if (interaction.id) reply.id = string(interaction.id);
    if (type === "step.start" && record(data.step).type === "model_output")
      reply.text += textBlocks(record(data.step).content);
    if (type === "step.delta" && delta.type === "text")
      reply.text += string(delta.text);
    if (["interaction.completed", "interaction.incomplete"].includes(type)) {
      const final = readReply(protocol, interaction);
      Object.assign(reply, {
        ...final,
        text: final.text || reply.text,
        usage: mergeUsage(reply.usage, final.usage),
      });
    }
  } else if (protocol === "messages") {
    if (type === "message_start") {
      const m = record(data.message);
      reply.id = string(m.id);
      reply.usage = mergeUsage(reply.usage, usageOf(protocol, m.usage));
    }
    if (type === "content_block_delta")
      reply.text += string(record(data.delta).text);
    if (type === "message_delta")
      reply.stopReason = stop(record(data.delta).stop_reason);
    if (type === "message_stop") reply.complete = true;
  } else if (protocol === "generateContent") {
    const chunk = readReply(protocol, data);
    reply.text += chunk.text;
    if (chunk.complete) {
      reply.complete = true;
      reply.stopReason = chunk.stopReason;
    }
  } else {
    const choice = record(array(data.choices)[0]),
      delta = record(choice.delta);
    reply.text += string(delta.content);
    if (delta.refusal) reply.stopReason = "blocked";
    if (choice.finish_reason) {
      reply.complete = true;
      if (reply.stopReason !== "blocked")
        reply.stopReason = stop(choice.finish_reason);
    }
  }
}
