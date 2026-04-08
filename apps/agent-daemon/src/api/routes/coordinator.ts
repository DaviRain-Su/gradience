/**
 * Multi-Agent Task Coordinator API Routes - GRA-230
 * 
 * REST API for coordinating multi-agent tasks.
 */

import type { FastifyInstance } from 'fastify';
import { logger } from '../../utils/logger.js';
import type {
  CoordinatorTask,
  CreateCoordinatorTaskRequest,
  AssignAgentRequest,
  SubmitDeliverableRequest,
  EvaluateSubtaskRequest,
  AgentRecommendation,
} from '../../shared/coordinator-types.js';
import {
  validateCreateTaskRequest,
  generateTaskId,
  generateSubtaskId,
} from '../../shared/coordinator-types.js';

// In-memory store (replace with database in production)
const tasks = new Map<string, CoordinatorTask>();

function getUserId(request: any): string {
  return request.walletAddress || request.owsKeyId || request.authType || 'anonymous';
}

export function registerCoordinatorRoutes(app: FastifyInstance): void {
  // -------------------------------------------------------------------------
  // Create Task
  // -------------------------------------------------------------------------

  app.post<{
    Body: CreateCoordinatorTaskRequest;
  }>('/api/v1/coordinator/tasks', async (request, reply) => {
    try {
      const body = request.body;

      if (!validateCreateTaskRequest(body)) {
        return reply.code(400).send({ error: 'Invalid task request' });
      }

      const taskId = generateTaskId();
      const now = Date.now();

      const task: CoordinatorTask = {
        id: taskId,
        title: body.title,
        description: body.description,
        owner: getUserId(request),
        status: 'pending_agents',
        budget: {
          total: body.budget.total,
          allocated: '0',
          spent: '0',
          token: body.budget.token,
        },
        timeline: {
          createdAt: now,
          deadline: body.deadline,
        },
        subtasks: body.subtasks.map((sub, index) => ({
          id: generateSubtaskId(taskId, index),
          taskId,
          title: sub.title,
          description: sub.description,
          status: 'pending',
          dependencies: sub.dependencies || [],
          budget: {
            allocated: sub.budget,
            spent: '0',
          },
          timeline: {
            createdAt: now,
          },
          deliverables: [],
        })),
        agents: [],
        messages: [
          {
            id: `msg_${now}`,
            taskId,
            from: 'system',
            fromName: 'System',
            content: `Task "${body.title}" created. Waiting for agents to join.`,
            type: 'system',
            timestamp: now,
          },
        ],
        metadata: {
          priority: body.metadata?.priority || 'medium',
          visibility: body.metadata?.visibility || 'public',
          category: body.metadata?.category,
          tags: body.metadata?.tags || [],
        },
      };

      tasks.set(taskId, task);

      logger.info({ taskId, title: task.title }, 'Coordinator task created');

      return reply.code(201).send(task);
    } catch (err: any) {
      logger.error({ err }, 'Failed to create coordinator task');
      return reply.code(500).send({ error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // Get Task
  // -------------------------------------------------------------------------

  app.get<{
    Params: { taskId: string };
  }>('/api/v1/coordinator/tasks/:taskId', async (request, reply) => {
    try {
      const { taskId } = request.params;
      const task = tasks.get(taskId);

      if (!task) {
        return reply.code(404).send({ error: 'Task not found' });
      }

      return task;
    } catch (err: any) {
      logger.error({ err, taskId: request.params.taskId }, 'Failed to get task');
      return reply.code(500).send({ error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // List Tasks
  // -------------------------------------------------------------------------

  app.get<{
    Querystring: {
      status?: string;
      owner?: string;
      limit?: number;
      offset?: number;
    };
  }>('/api/v1/coordinator/tasks', async (request, reply) => {
    try {
      const { status, owner, limit = 20, offset = 0 } = request.query;

      let result = Array.from(tasks.values());

      if (status) {
        result = result.filter((t) => t.status === status);
      }

      if (owner) {
        result = result.filter((t) => t.owner === owner);
      }

      const total = result.length;
      result = result.slice(offset, offset + limit);

      return {
        tasks: result,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    } catch (err: any) {
      logger.error({ err }, 'Failed to list tasks');
      return reply.code(500).send({ error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // Assign Agent
  // -------------------------------------------------------------------------

  app.post<{
    Params: { taskId: string };
    Body: AssignAgentRequest;
  }>('/api/v1/coordinator/tasks/:taskId/assign', async (request, reply) => {
    try {
      const { taskId } = request.params;
      const body = request.body;

      const task = tasks.get(taskId);
      if (!task) {
        return reply.code(404).send({ error: 'Task not found' });
      }

      // Check if agent already assigned
      const existingAgent = task.agents.find((a) => a.agentId === body.agentId);
      if (existingAgent) {
        return reply.code(400).send({ error: 'Agent already assigned to this task' });
      }

      // Add agent
      const agentAssignment = {
        agentId: body.agentId,
        agentName: `Agent ${body.agentId.slice(0, 8)}`, // TODO: Get real name
        role: body.role,
        assignedSubtasks: body.subtaskIds || [],
        joinedAt: Date.now(),
        status: 'active' as const,
      };

      task.agents.push(agentAssignment);

      // Assign subtasks if specified
      if (body.subtaskIds) {
        for (const subtaskId of body.subtaskIds) {
          const subtask = task.subtasks.find((s) => s.id === subtaskId);
          if (subtask && subtask.status === 'pending') {
            subtask.status = 'assigned';
            subtask.assignee = body.agentId;
            subtask.timeline.assignedAt = Date.now();
          }
        }
      }

      // Add system message
      task.messages.push({
        id: `msg_${Date.now()}`,
        taskId,
        from: 'system',
        fromName: 'System',
        content: `${agentAssignment.agentName} joined as ${body.role}`,
        type: 'system',
        timestamp: Date.now(),
      });

      // Update task status if first agent
      if (task.status === 'pending_agents' && task.agents.length > 0) {
        task.status = 'in_progress';
        task.timeline.startedAt = Date.now();
      }

      logger.info({ taskId, agentId: body.agentId, role: body.role }, 'Agent assigned to task');

      return agentAssignment;
    } catch (err: any) {
      logger.error({ err, taskId: request.params.taskId }, 'Failed to assign agent');
      return reply.code(500).send({ error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // Submit Deliverable
  // -------------------------------------------------------------------------

  app.post<{
    Params: { taskId: string };
    Body: SubmitDeliverableRequest;
  }>('/api/v1/coordinator/tasks/:taskId/deliverables', async (request, reply) => {
    try {
      const { taskId } = request.params;
      const body = request.body;

      const task = tasks.get(taskId);
      if (!task) {
        return reply.code(404).send({ error: 'Task not found' });
      }

      const subtask = task.subtasks.find((s) => s.id === body.subtaskId);
      if (!subtask) {
        return reply.code(404).send({ error: 'Subtask not found' });
      }

      const deliverable = {
        id: `del_${Date.now()}`,
        type: body.type,
        title: body.title,
        url: body.url,
        submittedAt: Date.now(),
        submittedBy: getUserId(request),
      };

      subtask.deliverables.push(deliverable);
      subtask.status = 'submitted';
      subtask.timeline.submittedAt = Date.now();

      // Add message
      task.messages.push({
        id: `msg_${Date.now()}`,
        taskId,
        subtaskId: body.subtaskId,
        from: 'current-user',
        fromName: 'Agent', // TODO: Get real name
        content: `Submitted deliverable: ${body.title}`,
        type: 'milestone',
        timestamp: Date.now(),
      });

      logger.info({ taskId, subtaskId: body.subtaskId, deliverableId: deliverable.id }, 'Deliverable submitted');

      return deliverable;
    } catch (err: any) {
      logger.error({ err, taskId: request.params.taskId }, 'Failed to submit deliverable');
      return reply.code(500).send({ error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // Evaluate Subtask
  // -------------------------------------------------------------------------

  app.post<{
    Params: { taskId: string };
    Body: EvaluateSubtaskRequest;
  }>('/api/v1/coordinator/tasks/:taskId/evaluate', async (request, reply) => {
    try {
      const { taskId } = request.params;
      const body = request.body;

      const task = tasks.get(taskId);
      if (!task) {
        return reply.code(404).send({ error: 'Task not found' });
      }

      const subtask = task.subtasks.find((s) => s.id === body.subtaskId);
      if (!subtask) {
        return reply.code(404).send({ error: 'Subtask not found' });
      }

      subtask.evaluation = {
        score: body.score,
        feedback: body.feedback,
        evaluatedAt: Date.now(),
      };

      subtask.status = body.score >= 70 ? 'approved' : 'rejected';
      subtask.timeline.completedAt = Date.now();

      // Update budget spent
      task.budget.spent = (BigInt(task.budget.spent) + BigInt(subtask.budget.allocated)).toString();

      // Check if all subtasks completed
      const allCompleted = task.subtasks.every(
        (s) => s.status === 'approved' || s.status === 'rejected'
      );

      if (allCompleted) {
        task.status = 'reviewing';
      }

      // Add message
      task.messages.push({
        id: `msg_${Date.now()}`,
        taskId,
        subtaskId: body.subtaskId,
        from: 'system',
        fromName: 'System',
        content: `Subtask evaluated: ${body.score}/100 - ${body.score >= 70 ? 'Approved' : 'Rejected'}`,
        type: 'milestone',
        timestamp: Date.now(),
      });

      logger.info({ taskId, subtaskId: body.subtaskId, score: body.score }, 'Subtask evaluated');

      return subtask;
    } catch (err: any) {
      logger.error({ err, taskId: request.params.taskId }, 'Failed to evaluate subtask');
      return reply.code(500).send({ error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // Get Agent Recommendations
  // -------------------------------------------------------------------------

  app.get<{
    Params: { taskId: string };
  }>('/api/v1/coordinator/tasks/:taskId/recommendations', async (request, reply) => {
    try {
      const { taskId } = request.params;
      const task = tasks.get(taskId);

      if (!task) {
        return reply.code(404).send({ error: 'Task not found' });
      }

      // TODO: Integrate with soul-engine for real recommendations
      // For now, return mock recommendations
      const recommendations: AgentRecommendation[] = [
        {
          agentId: 'agent_1',
          agentName: 'CodeMaster',
          relevanceScore: 95,
          skills: ['Rust', 'Solana', 'Smart Contracts'],
          matchReason: 'Strong match for blockchain development tasks',
          availability: 'available',
          estimatedCost: '500 USDC',
        },
        {
          agentId: 'agent_2',
          agentName: 'DesignPro',
          relevanceScore: 88,
          skills: ['UI/UX', 'Figma', 'React'],
          matchReason: 'Expert in frontend design',
          availability: 'available',
          estimatedCost: '400 USDC',
        },
        {
          agentId: 'agent_3',
          agentName: 'TestBot',
          relevanceScore: 82,
          skills: ['QA', 'Automation', 'Playwright'],
          matchReason: 'Specialized in testing and QA',
          availability: 'busy',
          estimatedCost: '300 USDC',
        },
      ];

      return { recommendations };
    } catch (err: any) {
      logger.error({ err, taskId: request.params.taskId }, 'Failed to get recommendations');
      return reply.code(500).send({ error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // Send Message
  // -------------------------------------------------------------------------

  app.post<{
    Params: { taskId: string };
    Body: {
      content: string;
      subtaskId?: string;
      mentions?: string[];
    };
  }>('/api/v1/coordinator/tasks/:taskId/messages', async (request, reply) => {
    try {
      const { taskId } = request.params;
      const { content, subtaskId, mentions } = request.body;

      const task = tasks.get(taskId);
      if (!task) {
        return reply.code(404).send({ error: 'Task not found' });
      }

      const message = {
        id: `msg_${Date.now()}`,
        taskId,
        subtaskId,
        from: 'current-user',
        fromName: getUserId(request),
        content,
        type: 'text' as const,
        timestamp: Date.now(),
        mentions,
      };

      task.messages.push(message);

      return message;
    } catch (err: any) {
      logger.error({ err, taskId: request.params.taskId }, 'Failed to send message');
      return reply.code(500).send({ error: err.message });
    }
  });

  logger.info('Multi-Agent Task Coordinator API routes registered: /api/v1/coordinator/*');
}
