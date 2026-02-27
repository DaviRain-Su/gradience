import { registerMonadTools } from "../src/tools/monad-tools.js";
import type { ToolDefinition, ToolRegistrar } from "../src/core/types.js";

type Payload = Record<string, unknown>;

function fail(message: string): never {
  throw new Error(`bridge smoke check failed: ${message}`);
}

function parsePayload(name: string, toolResult: unknown): Payload {
  if (!toolResult || typeof toolResult !== "object") {
    fail(`${name}: execute result must be an object`);
  }
  const value = toolResult as Record<string, unknown>;
  const content = value.content;
  if (!Array.isArray(content) || content.length === 0) {
    fail(`${name}: content must be non-empty array`);
  }
  const first = content[0];
  if (!first || typeof first !== "object" || (first as Record<string, unknown>).type !== "text") {
    fail(`${name}: first content item must be text`);
  }
  const text = (first as Record<string, unknown>).text;
  if (typeof text !== "string") {
    fail(`${name}: text payload must be string`);
  }
  try {
    const payload = JSON.parse(text);
    if (!payload || typeof payload !== "object") {
      fail(`${name}: parsed payload must be object`);
    }
    return payload as Payload;
  } catch {
    fail(`${name}: payload text must be valid JSON`);
  }
}

function assertOk(name: string, payload: Payload): void {
  if (payload.status !== "ok") {
    fail(`${name}: expected status=ok`);
  }
  if (payload.code !== 0) {
    fail(`${name}: expected code=0`);
  }
}

function getResult(name: string, payload: Payload): Payload {
  const result = payload.result;
  if (!result || typeof result !== "object") {
    fail(`${name}: result must be object`);
  }
  return result as Payload;
}

async function main(): Promise<void> {
  process.env.MONAD_USE_ZIG_CORE = "1";
  process.env.MONAD_REQUIRE_ZIG_CORE = "1";

  const tools = new Map<string, ToolDefinition>();
  const registrar: ToolRegistrar = {
    registerTool(definition) {
      tools.set(definition.name, definition);
    },
  };

  registerMonadTools(registrar);

  const monadVersion = tools.get("monad_version");
  const monadSchema = tools.get("monad_schema");
  const lifiQuote = tools.get("monad_lifi_getQuote");
  if (!monadVersion || !monadSchema || !lifiQuote) {
    fail("required bridge tools are not registered");
  }

  const versionPayload = parsePayload("monad_version", await monadVersion.execute("smoke-version", { long: true }));
  assertOk("monad_version", versionPayload);
  const versionResult = getResult("monad_version", versionPayload);
  if (typeof versionResult.version !== "string") {
    fail("monad_version: result.version must be string");
  }

  const schemaPayload = parsePayload("monad_schema", await monadSchema.execute("smoke-schema", {}));
  assertOk("monad_schema", schemaPayload);
  const schemaResult = getResult("monad_schema", schemaPayload);
  const toolsOrActions = Array.isArray(schemaResult.tools)
    ? schemaResult.tools
    : Array.isArray(schemaResult.actions)
      ? schemaResult.actions
      : null;
  if (!toolsOrActions) {
    fail("monad_schema: result.tools or result.actions must be array");
  }
  if (toolsOrActions.length === 0) {
    fail("monad_schema: schema array must be non-empty");
  }

  const quotePayload = parsePayload(
    "monad_lifi_getQuote",
    await lifiQuote.execute("smoke-lifi-quote", {
      fromChain: 1,
      toChain: 8453,
      fromToken: "0x1111111111111111111111111111111111111111",
      toToken: "0x2222222222222222222222222222222222222222",
      fromAmount: "1000000",
      fromAddress: "0x3333333333333333333333333333333333333333",
    }),
  );
  assertOk("monad_lifi_getQuote", quotePayload);
  const quoteResult = getResult("monad_lifi_getQuote", quotePayload);
  const quote = quoteResult.quote;
  if (!quote || typeof quote !== "object") {
    fail("monad_lifi_getQuote: result.quote must be object");
  }
  const quoteObj = quote as Payload;
  if (quoteObj.tool !== "lifi" || quoteObj.source !== "lifi") {
    fail("monad_lifi_getQuote: quote tool/source must be lifi");
  }

  console.log("bridge smoke checks passed");
}

await main();
