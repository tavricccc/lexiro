import type { AiSession, AiTurnOptions } from "@/src/types/ai";
import { endpoint, modelPreset, outputLimit } from "./catalog";

export function buildRequest(
  session: AiSession,
  prompt: string,
  options: AiTurnOptions,
) {
  const { settings, context, history, cursor } = session;
  const { protocol, model, apiKey } = settings;
  const schema = session.structuredOutput ? options.schema : undefined;
  const json = session.structuredOutput && options.responseFormat !== "text";
  const max = Math.min(
    options.maxOutputTokens ?? outputLimit(settings),
    outputLimit(settings),
  );
  const messages = [...history, { role: "user", content: prompt }];
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  let url = endpoint(settings);
  let body: Record<string, unknown>;
  const known = modelPreset(settings);
  if (protocol === "responses") {
    headers.Authorization = `Bearer ${apiKey}`;
    body = {
      model,
      stream: session.stream,
      store: true,
      instructions: context,
      ...(cursor ? { previous_response_id: cursor } : {}),
      input: cursor ? [{ role: "user", content: prompt }] : messages,
      max_output_tokens: max,
      ...(json
        ? {
            text: {
              format: schema
                ? {
                    type: "json_schema",
                    name: "lexiro_result",
                    strict: true,
                    schema,
                  }
                : { type: "json_object" },
            },
          }
        : {}),
      ...(known?.cache === "openai"
        ? {
              reasoning: { effort: known.reasoningEffort ?? "low" },
            prompt_cache_options: {
              mode: session.cache ? "implicit" : "explicit",
              ttl: "30m",
            },
          }
        : {}),
    };
  } else if (protocol === "messages") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
    body = {
      model,
      stream: session.stream,
      max_tokens: max,
      messages,
      system: [
        {
          type: "text",
          text: context || "Return the requested result.",
          ...(session.cache && known?.cache === "anthropic"
            ? { cache_control: { type: "ephemeral", ttl: "5m" } }
            : {}),
        },
      ],
      ...(schema
        ? { output_config: { format: { type: "json_schema", schema } } }
        : {}),
    };
  } else if (protocol === "interactions") {
    headers["x-goog-api-key"] = apiKey;
    body = {
      model,
      stream: session.stream,
      store: true,
      system_instruction: context,
      ...(cursor ? { previous_interaction_id: cursor } : {}),
      input: cursor
        ? prompt
        : messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            content: [{ type: "text", text: m.content }],
          })),
      generation_config: {
        max_output_tokens: max,
        ...(known?.id === "gemini-3.8-flash" ? { thinking_level: "low" } : {}),
      },
      ...(json
        ? {
            response_format: {
              type: "text",
              mime_type: "application/json",
              ...(schema ? { schema } : {}),
            },
          }
        : {}),
    };
  } else if (protocol === "generateContent") {
    headers["x-goog-api-key"] = apiKey;
    // A user-specified full method URL is never rewritten.
    if (
      !settings.baseUrl.includes("GenerateContent") &&
      !settings.baseUrl.includes("generateContent") &&
      !session.stream
    )
      url = url.replace(":streamGenerateContent?alt=sse", ":generateContent");
    body = {
      systemInstruction: { parts: [{ text: context }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        maxOutputTokens: max,
        ...(json
          ? {
              responseMimeType: "application/json",
              ...(schema ? { responseJsonSchema: schema } : {}),
            }
          : {}),
      },
    };
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
    body = {
      model,
      messages: [
        ...(context ? [{ role: "system", content: context }] : []),
        ...messages,
      ],
      stream: session.stream,
      max_tokens: max,
      ...(json
        ? {
            response_format: schema
              ? {
                  type: "json_schema",
                  json_schema: { name: "lexiro_result", strict: true, schema },
                }
              : { type: "json_object" },
          }
        : {}),
    };
  }
  return { body, headers, url };
}
