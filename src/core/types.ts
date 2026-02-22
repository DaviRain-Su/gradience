export type ToolContent = { type: "text"; text: string };

export type ToolResult = {
  content: ToolContent[];
};

export type ToolDefinition<Params = Record<string, unknown>> = {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (toolCallId: string, params: Params) => Promise<ToolResult>;
};

export type ToolRegistrar = {
  registerTool: (tool: ToolDefinition) => void;
};

export function textResult(payload: unknown): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}
