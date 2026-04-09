import type { FastifyInstance } from 'fastify';
import type { TaskQueue, TaskState } from '../../tasks/task-queue.js';
import { DaemonError } from '../../utils/errors.js';

export function registerTaskRoutes(app: FastifyInstance, taskQueue: TaskQueue): void {
    app.get<{ Querystring: { state?: string; limit?: string; offset?: string } }>('/api/v1/tasks', async (request) => {
        const { state, limit, offset } = request.query;
        const states = state ? (state.split(',') as TaskState[]) : undefined;
        const tasks = taskQueue.list(states, Number(limit) || 50, Number(offset) || 0);
        return { tasks, total: taskQueue.counts().total };
    });

    app.get<{ Params: { id: string } }>('/api/v1/tasks/:id', async (request, reply) => {
        const task = taskQueue.get(request.params.id);
        if (!task) {
            reply.code(404).send({ error: 'TASK_NOT_FOUND', message: 'Task not found' });
            return;
        }
        return task;
    });

    app.post<{ Params: { id: string } }>('/api/v1/tasks/:id/cancel', async (request, reply) => {
        try {
            taskQueue.cancel(request.params.id);
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
