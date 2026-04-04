/**
 * Spec Generator
 * 使用 AI API 生成 json-render Spec
 */

import { getPrompt } from "./prompts";
import { validateAgentmSpec } from "@/components/json-render";
import type { Spec } from "@json-render/core";

export interface GenerateSpecOptions {
  /** 用户输入的描述 */
  prompt: string;
  /** 生成上下文 */
  context: {
    type: "agent-config" | "dashboard" | "playground";
    userId?: string;
  };
  /** 是否使用流式响应 */
  stream?: boolean;
}

export interface GenerateSpecResult {
  /** 生成的 Spec */
  spec: Spec;
  /** 是否来自缓存 */
  cached?: boolean;
  /** 生成耗时 (ms) */
  duration?: number;
}

// 简单的内存缓存
const specCache = new Map<string, { spec: Spec; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * 生成缓存键
 */
export function generateCacheKey(prompt: string, type: string): string {
  return `${type}:${prompt.trim().toLowerCase()}`;
}

/**
 * 从缓存获取 Spec
 */
function getCachedSpec(cacheKey: string): Spec | null {
  const cached = specCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.spec;
  }
  specCache.delete(cacheKey);
  return null;
}

/**
 * 保存 Spec 到缓存
 */
function setCachedSpec(cacheKey: string, spec: Spec): void {
  specCache.set(cacheKey, { spec, timestamp: Date.now() });
}

/**
 * 解析 AI 响应为 Spec
 */
function parseSpecResponse(response: string): Spec {
  // 尝试提取 JSON 部分
  let jsonStr = response.trim();
  
  // 移除 markdown 代码块
  if (jsonStr.startsWith("```json")) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.slice(0, -3);
  }
  
  jsonStr = jsonStr.trim();
  
  try {
    const spec = JSON.parse(jsonStr) as Spec;
    return spec;
  } catch (error) {
    throw new Error(`Failed to parse AI response as JSON: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * 使用 OpenAI API 生成 Spec
 */
async function generateWithOpenAI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a UI designer that generates JSON specifications for web components. Always respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

/**
 * 使用 Anthropic API 生成 Spec
 */
async function generateWithAnthropic(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 4000,
      messages: [
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.content[0]?.text || "";
}

/**
 * 生成 Spec
 */
export async function generateSpec(options: GenerateSpecOptions): Promise<GenerateSpecResult> {
  const startTime = Date.now();
  const { prompt, context } = options;
  
  // 检查缓存
  const cacheKey = generateCacheKey(prompt, context.type);
  const cachedSpec = getCachedSpec(cacheKey);
  
  if (cachedSpec) {
    return {
      spec: cachedSpec,
      cached: true,
      duration: Date.now() - startTime,
    };
  }

  // 获取 API Key
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  
  if (!openaiKey && !anthropicKey) {
    throw new Error("No AI API key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.");
  }

  // 构建 prompt
  const fullPrompt = getPrompt(context.type, {
    userDescription: prompt,
    userQuery: prompt,
  });

  // 调用 AI API
  let response: string;
  try {
    if (openaiKey) {
      response = await generateWithOpenAI(fullPrompt, openaiKey);
    } else if (anthropicKey) {
      response = await generateWithAnthropic(fullPrompt, anthropicKey!);
    } else {
      throw new Error("No AI API available");
    }
  } catch (error) {
    console.error("AI API call failed:", error);
    throw new Error(`AI generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  // 解析响应
  let spec: Spec;
  try {
    spec = parseSpecResponse(response);
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    console.error("Raw response:", response);
    throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  // 验证 Spec
  const validation = validateAgentmSpec(spec);
  if (!validation.valid) {
    console.error("Spec validation failed:", validation.errors);
    throw new Error(`Generated spec is invalid: ${validation.errors.join(", ")}`);
  }

  // 缓存结果
  setCachedSpec(cacheKey, spec);

  return {
    spec,
    cached: false,
    duration: Date.now() - startTime,
  };
}

/**
 * 流式生成 Spec
 * 返回一个异步生成器，逐步返回 Spec 的部分内容
 */
export async function* generateSpecStream(options: GenerateSpecOptions): AsyncGenerator<
  { type: "chunk"; content: string } | { type: "complete"; spec: Spec } | { type: "error"; error: string }
> {
  const { prompt, context } = options;
  
  // 获取 API Key
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiKey) {
    yield { type: "error", error: "OpenAI API key not configured" };
    return;
  }

  // 构建 prompt
  const fullPrompt = getPrompt(context.type, {
    userDescription: prompt,
    userQuery: prompt,
  });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a UI designer that generates JSON specifications for web components. Always respond with valid JSON only." },
          { role: "user", content: fullPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      yield { type: "error", error: `OpenAI API error: ${response.status} ${error}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", error: "No response body" };
      return;
    }

    let fullContent = "";
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content || "";
            if (content) {
              fullContent += content;
              yield { type: "chunk", content };
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }

    // 解析完整的 Spec
    try {
      const spec = parseSpecResponse(fullContent);
      const validation = validateAgentmSpec(spec);
      if (validation.valid) {
        yield { type: "complete", spec };
      } else {
        yield { type: "error", error: `Invalid spec: ${validation.errors.join(", ")}` };
      }
    } catch (error) {
      yield { type: "error", error: `Failed to parse spec: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  } catch (error) {
    yield { type: "error", error: `Stream error: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

export default {
  generateSpec,
  generateSpecStream,
};
