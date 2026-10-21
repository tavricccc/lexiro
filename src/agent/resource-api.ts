import { z } from "zod";
import { readBody, HttpError } from "../http";
import type { AgentEnv, AgentIdentity, AgentLibraryRepository } from "./types";
import {
  applyAgentMutation,
  readAgentResource,
  readAgentBatch,
} from "./operations";
import { compactReceipt, projectReceipt } from "./query";
import { urlInstructions } from "./instructions";

function parameters(url: URL): Record<string, unknown> {
  const value: Record<string, unknown> = {};
  for (const name of [
    "q",
    "questionType",
    "kind",
    "cursor",
    "folderId",
    "severity",
    "view",
  ])
    if (url.searchParams.has(name)) value[name] = url.searchParams.get(name);
  for (const name of ["from", "to", "limit", "difficulty"])
    if (url.searchParams.has(name))
      value[name] = Number(url.searchParams.get(name));
  for (const name of ["includeExamples", "includePassage", "includePrompt"])
    if (url.searchParams.has(name))
      value[name] =
        z.enum(["true", "false"]).parse(url.searchParams.get(name)) === "true";
  for (const [name, parameter] of [
    ["wordKeys", "wordKey"],
    ["senseIds", "senseId"],
    ["fields", "fields"],
  ])
    if (url.searchParams.has(parameter))
      value[name] = url.searchParams
        .getAll(parameter)
        .flatMap((value) => value.split(","));
  return value;
}
export function presentMutation(
  result: Record<string, unknown>,
  fields?: string[],
  actionType?: string,
) {
  const compact = compactReceipt(result, actionType),
    selected = fields ? projectReceipt(result, fields, actionType) : compact;
  return JSON.stringify(selected).length <= 32000
    ? selected
    : { ...compact, responseLimited: true };
}
export async function handleAgentAccess(
  request: Request,
  env: AgentEnv,
  repo: AgentLibraryRepository,
  identity: AgentIdentity,
  id: string,
  tail: string,
) {
  const url = new URL(request.url),
    options = parameters(url),
    setId = identity.setId!;
  const read = async (
    resource: string,
    extra: Record<string, unknown> = {},
  ) => {
    const result = await readAgentResource(repo, identity, {
      ...options,
      ...extra,
      resource,
      setId,
    });
    if (JSON.stringify(result).length > 32000)
      throw new HttpError(
        400,
        "response_too_large_use_fields_or_smaller_range",
      );
    return Response.json(result);
  };
  if (!tail && request.method === "GET") {
    const summary = await readAgentResource(repo, identity, {
      resource: "set",
      setId,
    });
    const instructions = urlInstructions(env.AGENT_PUBLIC_URL, id);
    if (request.headers.get("accept")?.includes("application/json"))
      return Response.json({ ...summary, instructions });
    return new Response(
      `# Lexiro vocabulary set access\n\n${JSON.stringify(summary)}\n\n${instructions}`,
      { headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
  if (tail === "/query" && request.method === "POST")
    return Response.json(
      await readAgentBatch(
        repo,
        identity,
        JSON.parse(await readBody(request, 1000000)),
      ),
    );
  if (request.method === "GET") {
    if (tail === "/prompt") return read("prompt");
    if (tail === "/brief") return read("brief");
    if (tail === "/folders") return read("folders");
    if (tail === "/words") return read("words");
    if (tail === "/questions") return read("questions");
    const word = /^\/words\/([^/]+)$/.exec(tail);
    if (word) return read("word", { wordKey: decodeURIComponent(word[1]) });
    const question =
      /^\/questions\/([^/]+)(?:\/(children|passage)(?:\/([^/]+))?)?$/.exec(
        tail,
      );
    if (question)
      return read(
        question[2] === "children" && !question[3] ? "questions" : "question",
        {
          questionId: decodeURIComponent(question[1]),
          ...(question[3] ? { childId: decodeURIComponent(question[3]) } : {}),
          ...(question[2] === "passage" ? { includePassage: true } : {}),
        },
      );
    const operation = /^\/operations\/([0-9a-f-]{36})(\/diagnostics)?$/.exec(
      tail,
    );
    if (operation)
      return read(operation[2] ? "diagnostics" : "operation", {
        operationId: operation[1],
      });
    throw new HttpError(404, "not_found");
  }
  if (tail === "/folders") throw new HttpError(405, "method_not_allowed");
  const bodyText = await readBody(request, 1000000);
  const raw =
    request.method === "DELETE" && !bodyText ? {} : JSON.parse(bodyText);
  const body = z.record(z.string(), z.unknown()).parse(raw),
    { expectedRevision, operationId, responseFields, ...data } = body;
  const fields =
    responseFields === undefined
      ? undefined
      : z.array(z.string()).max(20).parse(responseFields);
  let action: unknown;
  if (!tail && request.method === "PATCH")
    action = z.strictObject({ action: z.unknown() }).parse(data).action;
  else if (!tail && request.method === "DELETE")
    action = { type: "delete_set" };
  else if (tail === "/words" && request.method === "POST")
    action = { type: "put_words", words: data.words };
  else if (tail === "/questions" && request.method === "POST")
    action = {
      type: "put_questions",
      questions: data.questions,
      mode: data.mode ?? "partial",
    };
  else if (tail === "/generated-questions" && request.method === "POST")
    action = { type: "generated_questions", ...data };
  else {
    const word = /^\/words\/([^/]+)(?:\/senses(?:\/([^/]+))?)?$/.exec(tail);
    const question = /^\/questions\/([^/]+)(?:\/children\/([^/]+))?$/.exec(
      tail,
    );
    if (word) {
      const wordKey = decodeURIComponent(word[1]),
        senseId = word[2] ? decodeURIComponent(word[2]) : undefined;
      if (
        tail.includes("/senses") &&
        ((request.method === "POST" && !senseId) ||
          (senseId && ["PATCH", "DELETE"].includes(request.method)))
      )
        action = {
          type: "edit_sense",
          wordKey,
          senseId,
          action:
            request.method === "POST"
              ? "add"
              : request.method === "DELETE"
                ? "delete"
                : "update",
          patch: data.patch ?? data,
        };
      else if (request.method === "DELETE")
        action = { type: "delete_words", wordKeys: [wordKey] };
      else if (request.method === "PATCH")
        action = { type: "edit_word", wordKey, patch: data.patch ?? data };
    } else if (question) {
      const questionId = decodeURIComponent(question[1]);
      if (request.method === "DELETE" && !question[2])
        action = { type: "delete_questions", questionIds: [questionId] };
      else if (request.method === "PATCH")
        action = {
          type: "edit_question",
          questionId,
          ...(question[2] ? { childId: decodeURIComponent(question[2]) } : {}),
          patch: data.patch ?? data,
        };
    }
  }
  if (!action) throw new HttpError(405, "method_not_allowed");
  const result = await applyAgentMutation(
    repo,
    identity,
    setId,
    { expectedRevision, operationId, action },
    "mcp",
  );
  return Response.json(
    presentMutation(
      result as unknown as Record<string, unknown>,
      fields,
      (action as { type: string }).type,
    ),
  );
}
