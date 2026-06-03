import type { AnthropicMessagesRequest, OpenAIChatRequest, OpenAIMessage, OpenAITool } from "./types.js";
import type { TranslationFallback } from "@one-proxy/shared";
import { logger } from "../logger.js";

export function translateAnthropicToOpenAI(req: AnthropicMessagesRequest, fallback: TranslationFallback): OpenAIChatRequest {
  const messages: OpenAIMessage[] = [];

  if (req.system) {
    if (typeof req.system === "string") {
      messages.push({ role: "system", content: req.system });
    } else if (Array.isArray(req.system)) {
      const text = req.system.filter(b => b.type === "text").map(b => b.text || "").join("");
      if (text) messages.push({ role: "system", content: text });
    }
  }

  for (const msg of req.messages) {
    if (msg.role === "user" && Array.isArray(msg.content)) {
      const toolResults = msg.content.filter(b => b.type === "tool_result");
      if (toolResults.length > 0) {
        for (const tr of toolResults) {
          messages.push({
            role: "tool",
            tool_call_id: tr.tool_use_id || "",
            content: typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content || ""),
          });
        }
        continue;
      }

      const hasImages = msg.content.some(b => b.type === "image");
      if (hasImages) {
        const parts: any[] = [];
        for (const block of msg.content) {
          if (block.type === "text") {
            parts.push({ type: "text", text: block.text || "" });
          } else if (block.type === "image" && block.source) {
            const dataUrl = `data:${block.source.media_type || "image/png"};base64,${block.source.data || ""}`;
            parts.push({ type: "image_url", image_url: { url: dataUrl } });
          }
        }
        messages.push({ role: "user", content: parts });
        continue;
      }

      const text = msg.content.filter(b => b.type === "text").map(b => b.text || "").join("");
      messages.push({ role: "user", content: text });
      continue;
    }

    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      const textParts: string[] = [];
      const toolCalls: any[] = [];

      for (const block of msg.content) {
        if (block.type === "text") {
          textParts.push(block.text || "");
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id || "",
            type: "function",
            function: {
              name: block.name || "",
              arguments: JSON.stringify(block.input || {}),
            },
          });
        } else if (block.type === "thinking") {
          if (fallback === "drop") {
            logger.warn("Dropping thinking block in Anthropic→OpenAI translation");
          }
        }
      }

      const msgObj: OpenAIMessage = {
        role: "assistant",
        content: textParts.join("") || null,
      };
      if (toolCalls.length > 0) {
        msgObj.tool_calls = toolCalls;
      }
      messages.push(msgObj);
      continue;
    }

    messages.push({
      role: msg.role,
      content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
    });
  }

  const tools: OpenAITool[] | undefined = req.tools?.map(t => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema || { type: "object", properties: {} },
    },
  }));

  const result: OpenAIChatRequest = {
    model: req.model,
    messages,
    max_tokens: req.max_tokens,
  };

  if (tools && tools.length > 0) result.tools = tools;
  if (req.temperature !== undefined) result.temperature = req.temperature;
  if (req.top_p !== undefined) result.top_p = req.top_p;
  if (req.stream !== undefined) result.stream = req.stream;

  if (req.thinking) {
    if (fallback === "drop") {
      logger.warn("Dropping thinking config in Anthropic→OpenAI translation");
    }
  }

  return result;
}

export function translateOpenAIResponseToAnthropic(response: any, model: string): any {
  const content: any[] = [];

  const choice = response.choices?.[0];
  if (choice?.message?.content) {
    content.push({ type: "text", text: choice.message.content });
  }

  if (choice?.message?.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      content.push({
        type: "tool_use",
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments || "{}"),
      });
    }
  }

  return {
    id: response.id || "msg_proxy",
    type: "message",
    role: "assistant",
    model: model,
    content,
    stop_reason: mapFinishReason(choice?.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: response.usage?.prompt_tokens || 0,
      output_tokens: response.usage?.completion_tokens || 0,
    },
  };
}

function mapFinishReason(reason: string | null): string {
  switch (reason) {
    case "stop": return "end_turn";
    case "length": return "max_tokens";
    case "tool_calls": return "tool_use";
    default: return "end_turn";
  }
}
