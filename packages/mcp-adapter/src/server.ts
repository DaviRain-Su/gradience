import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

export interface McpAdapterConfig {
  gradienceSdk: any;
  gatewayBaseUrl: string;
}

export function createGradienceMcpServer(config: McpAdapterConfig): Server {
  const server = new Server(
    { name: 'gradience-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'gradience_list_skills',
        description: 'List available skills from Chain Hub',
        inputSchema: { type: 'object', properties: { category: { type: 'string' }, limit: { type: 'number' } } },
      },
      {
        name: 'gradience_get_task_status',
        description: 'Get Agent Arena task status',
        inputSchema: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'] },
      },
      {
        name: 'gradience_post_arena_task',
        description: 'Post a new task to Agent Arena',
        inputSchema: { type: 'object', properties: { evalRef: { type: 'string' }, reward: { type: 'string' }, deadline: { type: 'number' } }, required: ['evalRef', 'reward', 'deadline'] },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (!args) {
      return { content: [{ type: 'text', text: 'Missing arguments' }], isError: true };
    }
    try {
      if (name === 'gradience_list_skills') {
        const skills = await config.gradienceSdk.chainHub?.listSkills?.(args);
        return { content: [{ type: 'text', text: JSON.stringify(skills ?? []) }] };
      }
      if (name === 'gradience_get_task_status') {
        const taskId = (args as Record<string, unknown>).taskId as string | undefined;
        if (!taskId) {
          return { content: [{ type: 'text', text: 'Missing taskId' }], isError: true };
        }
        const task = await config.gradienceSdk.arena?.getTask?.(taskId);
        return { content: [{ type: 'text', text: JSON.stringify(task ?? {}) }] };
      }
      if (name === 'gradience_post_arena_task') {
        const result = await config.gradienceSdk.arena?.postTask?.(args);
        return { content: [{ type: 'text', text: JSON.stringify(result ?? {}) }] };
      }
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err?.message ?? String(err)}` }], isError: true };
    }
  });

  return server;
}

export async function startStdioServer(config: McpAdapterConfig): Promise<void> {
  const server = createGradienceMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
