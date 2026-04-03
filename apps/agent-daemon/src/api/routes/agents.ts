import type { FastifyInstance } from 'fastify';
import type { ProcessManager, AgentConfig } from '../../agents/process-manager.js';
import { DaemonError } from '../../utils/errors.js';

export function registerAgentRoutes(app: FastifyInstance, processManager: ProcessManager): void {
    app.get('/api/v1/agents', async () => {
        return { agents: processManager.list() };
    });

    app.post<{ Body: AgentConfig }>('/api/v1/agents', async (request, reply) => {
        try {
            const config = processManager.register(request.body);
            reply.code(201);
            return config;
        } catch (err) {
            if (err instanceof DaemonError) {
                reply.code(err.statusCode).send({ error: err.code, message: err.message });
                return;
            }
            throw err;
        }
    });

    app.post<{ Params: { id: string } }>('/api/v1/agents/:id/start', async (request, reply) => {
        try {
            const pid = await processManager.start(request.params.id);
            return { success: true, pid };
        } catch (err) {
            if (err instanceof DaemonError) {
                reply.code(err.statusCode).send({ error: err.code, message: err.message });
                return;
            }
            throw err;
        }
    });

    app.post<{ Params: { id: string } }>('/api/v1/agents/:id/stop', async (request, reply) => {
        try {
            await processManager.stop(request.params.id);
            return { success: true };
        } catch (err) {
            if (err instanceof DaemonError) {
                reply.code(err.statusCode).send({ error: err.code, message: err.message });
                return;
            }
            throw err;
        }
    });
}
