/**
 * Lovable AI Gateway adapter — Claude-compatible response shape.
 *
 * Replaces direct Anthropic API calls. Returns responses in the same
 * `{content: [{type:"text", text}]}` / `{content: [{type:"tool_use", input}]}`
 * shape that the rest of the codebase already parses, so call sites only
 * need to swap the fetch.
 *
 * Default model: google/gemini-2.5-pro (top quality for marketing copy).
 */

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-pro";

export type AIMessage = { role: "system" | "user" | "assistant"; content: string };

export type AIToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, any>;
};

export type AIResponseBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; name: string; input: any };

export type AIResponse = {
  content: AIResponseBlock[];
};

function getApiKey(): string {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  return key;
}

async function postGateway(body: Record<string, any>): Promise<Response> {
  return await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Plain text completion.
 * Returns Claude-shaped response: { content: [{type:"text", text}] }
 */
export async function callAI(opts: {
  system?: string;
  prompt?: string;
  messages?: AIMessage[];
  max_tokens?: number;
  model?: string;
  response_format?: { type: "json_object" | "text" };
}): Promise<AIResponse> {
  const messages: AIMessage[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  if (opts.messages) {
    messages.push(...opts.messages);
  } else if (opts.prompt) {
    messages.push({ role: "user", content: opts.prompt });
  }

  const body: Record<string, any> = {
    model: opts.model || DEFAULT_MODEL,
    messages,
    max_tokens: opts.max_tokens || 2048,
  };
  if (opts.response_format) body.response_format = opts.response_format;

  const res = await postGateway(body);

  if (!res.ok) {
    const errText = await res.text();
    console.error("Lovable AI error:", res.status, errText);
    const err: any = new Error(`Lovable AI error: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";

  return { content: [{ type: "text", text }] };
}

/**
 * Structured output via tool calling.
 * Returns Claude-shaped response: { content: [{type:"tool_use", name, input}] }
 */
export async function callAIWithTool(opts: {
  system?: string;
  prompt?: string;
  messages?: AIMessage[];
  tool: AIToolDef;
  max_tokens?: number;
  model?: string;
}): Promise<AIResponse> {
  const messages: AIMessage[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  if (opts.messages) {
    messages.push(...opts.messages);
  } else if (opts.prompt) {
    messages.push({ role: "user", content: opts.prompt });
  }

  const res = await postGateway({
    model: opts.model || DEFAULT_MODEL,
    messages,
    max_tokens: opts.max_tokens || 4096,
    tools: [
      {
        type: "function",
        function: {
          name: opts.tool.name,
          description: opts.tool.description,
          parameters: opts.tool.input_schema,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: opts.tool.name } },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Lovable AI error:", res.status, errText);
    const err: any = new Error(`Lovable AI error: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    const finishReason = data.choices?.[0]?.finish_reason;
    const textContent = data.choices?.[0]?.message?.content || "";
    console.error("No tool_call in response. finish_reason:", finishReason, "content:", textContent);
    const err: any = new Error(
      `AI did not return structured output (finish_reason: ${finishReason || "unknown"}). ` +
      `This often happens when the model is overloaded or response was filtered. Try again.`
    );
    err.code = "NO_TOOL_CALL";
    err.finishReason = finishReason;
    throw err;
  }

  let input: any = {};
  try {
    input = JSON.parse(toolCall.function.arguments || "{}");
  } catch (e) {
    console.error("Failed to parse tool arguments:", toolCall.function.arguments);
    throw new Error("Invalid JSON in tool arguments");
  }

  return {
    content: [{ type: "tool_use", name: toolCall.function.name, input }],
  };
}
