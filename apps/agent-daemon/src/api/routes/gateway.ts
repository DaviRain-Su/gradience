import type { FastifyInstance } from 'fastify';
import type { DefaultWorkflowExecutionGateway } from '../../gateway/gateway.js';
import { GatewayError } from '../../gateway/errors.js';

export function registerGatewayRoutes(
  app: FastifyInstance,
  gateway: DefaultWorkflowExecutionGateway
): void {
  app.get('/api/v1/gateway/purchases/:purchaseId', async (request, reply) => {
    try {
      const { purchaseId } = request.params as { purchaseId: string };
      const record = await gateway.getStatus(purchaseId);
      if (!record) {
        reply.code(404).send({ error: 'NOT_FOUND', message: 'Purchase not found' });
        return;
      }
      return record;
    } catch (err) {
      if (err instanceof GatewayError) {
        reply.code(400).send({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  });

  app.post('/api/v1/gateway/purchases/:purchaseId/retry', async (request, reply) => {
    try {
      const { purchaseId } = request.params as { purchaseId: string };
      const success = await gateway.retry(purchaseId);
      return { success };
    } catch (err) {
      if (err instanceof GatewayError) {
        reply.code(400).send({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  });
}
