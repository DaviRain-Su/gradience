import { useCallback } from 'react';
import { useConnection } from './ConnectionContext';

// Types for API responses
export interface AgentProfile {
    id: string;
    name: string;
    role: string;
    bio: string;
    avatar?: string;
    reputation?: {
        score: number;
        completedTasks: number;
        winRate: number;
    };
}

export interface Task {
    task_id: string;
    poster: string;
    category: string;
    description: string;
    reward_lamports: number;
    deadline: number;
    state: 'Open' | 'InProgress' | 'Judging' | 'Settled' | 'Cancelled';
    submissions_count: number;
}

export interface SocialPost {
    id: string;
    author: string;
    authorDomain: string | null;
    content: string;
    tags: string[];
    likes: number;
    reposts: number;
    createdAt: number;
}

export interface ChatMessage {
    id: string;
    agentId: string | 'user';
    text: string;
    timestamp: string;
}

// Generic API hook
export function useApi() {
    const { daemonUrl, isConnected } = useConnection();

    const fetchApi = useCallback(async <T,>(
        endpoint: string,
        options?: RequestInit
    ): Promise<T | null> => {
        if (!daemonUrl || !isConnected) {
            console.warn('Not connected to daemon');
            return null;
        }

        try {
            const response = await fetch(`${daemonUrl}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options?.headers,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json() as T;
        } catch (error) {
            console.error('API error:', error);
            return null;
        }
    }, [daemonUrl, isConnected]);

    return { fetchApi };
}

// Agents API
export function useAgentsApi() {
    const { fetchApi } = useApi();

    const discoverAgents = useCallback(async (query?: string) => {
        const endpoint = query
            ? `/discover/agents?query=${encodeURIComponent(query)}`
            : '/discover/agents';
        return fetchApi<AgentProfile[]>(endpoint);
    }, [fetchApi]);

    const getAgentProfile = useCallback(async (agentId: string) => {
        return fetchApi<AgentProfile>(`/api/agents/${agentId}/profile`);
    }, [fetchApi]);

    return { discoverAgents, getAgentProfile };
}

// Tasks API
export function useTasksApi() {
    const { fetchApi } = useApi();

    const getTasks = useCallback(async () => {
        return fetchApi<Task[]>('/api/tasks');
    }, [fetchApi]);

    const getTask = useCallback(async (taskId: string) => {
        return fetchApi<Task>(`/api/tasks/${taskId}`);
    }, [fetchApi]);

    const applyForTask = useCallback(async (taskId: string) => {
        return fetchApi<void>(`/api/tasks/${taskId}/apply`, {
            method: 'POST',
        });
    }, [fetchApi]);

    const createTask = useCallback(async (task: Omit<Task, 'task_id' | 'submissions_count'>) => {
        return fetchApi<Task>('/api/tasks', {
            method: 'POST',
            body: JSON.stringify(task),
        });
    }, [fetchApi]);

    return { getTasks, getTask, applyForTask, createTask };
}

// Social/Feed API
export function useSocialApi() {
    const { fetchApi } = useApi();

    const getFeed = useCallback(async (type: 'global' | 'following' = 'global') => {
        return fetchApi<SocialPost[]>(`/api/social/feed/${type}`);
    }, [fetchApi]);

    const createPost = useCallback(async (content: string, tags: string[] = []) => {
        return fetchApi<SocialPost>('/api/social/posts', {
            method: 'POST',
            body: JSON.stringify({ content, tags }),
        });
    }, [fetchApi]);

    const likePost = useCallback(async (postId: string) => {
        return fetchApi<void>('/api/social/posts/like', {
            method: 'POST',
            body: JSON.stringify({ postId }),
        });
    }, [fetchApi]);

    return { getFeed, createPost, likePost };
}

// Chat API
export function useChatApi() {
    const { fetchApi } = useApi();

    const getMessages = useCallback(async (agentId: string) => {
        return fetchApi<ChatMessage[]>(`/a2a/messages?peer=${agentId}`);
    }, [fetchApi]);

    const sendMessage = useCallback(async (agentId: string, text: string) => {
        return fetchApi<void>('/a2a/send', {
            method: 'POST',
            body: JSON.stringify({ peer: agentId, message: text }),
        });
    }, [fetchApi]);

    return { getMessages, sendMessage };
}

// Me/Reputation API
export function useMeApi() {
    const { fetchApi } = useApi();

    const getMe = useCallback(async () => {
        return fetchApi<{ id: string; name: string; reputation: any }>('/me');
    }, [fetchApi]);

    const getReputation = useCallback(async () => {
        return fetchApi<{ score: number; completed: number; winRate: number }>('/me/reputation');
    }, [fetchApi]);

    const getMyTasks = useCallback(async () => {
        return fetchApi<Task[]>('/me/tasks');
    }, [fetchApi]);

    return { getMe, getReputation, getMyTasks };
}
