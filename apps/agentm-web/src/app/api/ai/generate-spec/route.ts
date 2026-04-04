/**
 * AI Spec Generation API Route
 * POST /api/ai/generate-spec
 */

import { NextRequest, NextResponse } from "next/server";
import { generateSpec, generateSpecStream } from "@/lib/ai/spec-generator";
import { z } from "zod";

// 请求体验证 schema
const requestSchema = z.object({
  prompt: z.string().min(1).max(5000),
  context: z.object({
    type: z.enum(["agent-config", "dashboard", "playground"]),
    userId: z.string().optional(),
  }),
  stream: z.boolean().optional().default(false),
});

export type GenerateSpecRequest = z.infer<typeof requestSchema>;

export interface GenerateSpecResponse {
  spec?: Record<string, unknown>;
  cached?: boolean;
  duration?: number;
  error?: string;
}

/**
 * POST handler for spec generation
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // 解析请求体
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // 验证请求
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Validation error: ${validation.error.message}` },
        { status: 400 }
      );
    }

    const { prompt, context, stream } = validation.data;

    // 流式响应
    if (stream) {
      const encoder = new TextEncoder();
      const streamGenerator = generateSpecStream({ prompt, context });

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamGenerator) {
              const data = JSON.stringify(chunk);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));

              if (chunk.type === "complete" || chunk.type === "error") {
                controller.close();
                break;
              }
            }
          } catch (error) {
            const errorData = JSON.stringify({
              type: "error",
              error: error instanceof Error ? error.message : "Stream error",
            });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // 非流式响应
    const result = await generateSpec({ prompt, context });

    return NextResponse.json({
      spec: result.spec as Record<string, unknown>,
      cached: result.cached,
      duration: result.duration,
    } satisfies GenerateSpecResponse);

  } catch (error) {
    console.error("Spec generation error:", error);

    // 根据错误类型返回不同的状态码
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (errorMessage.includes("API key")) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 503 }
      );
    }

    if (errorMessage.includes("rate limit")) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET handler for health check
 */
export async function GET(): Promise<Response> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  return NextResponse.json({
    status: "ok",
    aiConfigured: !!(openaiKey || anthropicKey),
    providers: {
      openai: !!openaiKey,
      anthropic: !!anthropicKey,
    },
  });
}
