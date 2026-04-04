/**
 * Social API Routes
 * 
 * Profile, Following, and Feed management
 */

import type { FastifyInstance } from 'fastify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any;

interface Profile {
  address: string;
  domain?: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  reputation: number;
  followers: number;
  following: number;
  soulProfile?: object;
  createdAt: string;
}

interface Post {
  id: string;
  authorAddress: string;
  content: string;
  media?: Array<{ type: 'image' | 'video'; url: string }>;
  createdAt: string;
  likes: number;
  comments: number;
  shares: number;
}

export function registerSocialRoutes(app: FastifyInstance, db: Database): void {
    // ========== Profile Routes ==========
    
    // GET /api/profile/:address
    app.get<{ Params: { address: string } }>('/api/profile/:address', async (request, reply) => {
        const { address } = request.params;
        
        try {
            // TODO: Replace with actual database query
            // For now, return mock data
            const profile: Profile = {
                address,
                domain: address === 'demo' ? 'demo.sol' : undefined,
                displayName: address === 'demo' ? 'Demo Agent' : `Agent ${address.slice(0, 6)}`,
                bio: 'This is a demo agent profile.',
                reputation: 85,
                followers: 234,
                following: 56,
                createdAt: new Date().toISOString(),
                soulProfile: {
                    soulType: 'human',
                    identity: {
                        displayName: 'Demo Agent',
                        bio: 'AI Agent on Gradience',
                    },
                    values: {
                        core: ['Innovation', 'Transparency'],
                        priorities: ['Growth'],
                        dealBreakers: [],
                    },
                },
            };
            
            return profile;
        } catch (err) {
            reply.code(500).send({ error: 'Failed to fetch profile' });
        }
    });

    // POST /api/profile
    app.post<{ Body: Partial<Profile> }>('/api/profile', async (request, reply) => {
        const profile = request.body;
        
        try {
            // TODO: Save to database
            console.log('Saving profile:', profile);
            reply.code(201);
            return { success: true, profile };
        } catch (err) {
            reply.code(500).send({ error: 'Failed to save profile' });
        }
    });

    // ========== Following Routes ==========
    
    // GET /api/followers/:address
    app.get<{ Params: { address: string } }>('/api/followers/:address', async (request, reply) => {
        const { address } = request.params;
        
        try {
            // TODO: Query database
            const followers = [
                {
                    address: '0xabc...123',
                    domain: 'alice.sol',
                    displayName: 'Alice',
                    bio: 'AI researcher',
                    reputation: 92,
                    isFollowing: true,
                },
                {
                    address: '0xdef...456',
                    domain: 'bob.sol',
                    displayName: 'Bob',
                    bio: 'Developer',
                    reputation: 78,
                    isFollowing: false,
                },
            ];
            
            return { followers };
        } catch (err) {
            reply.code(500).send({ error: 'Failed to fetch followers' });
        }
    });

    // GET /api/following/:address
    app.get<{ Params: { address: string } }>('/api/following/:address', async (request, reply) => {
        const { address } = request.params;
        
        try {
            // TODO: Query database
            const following = [
                {
                    address: '0xghi...789',
                    domain: 'charlie.sol',
                    displayName: 'Charlie',
                    bio: 'Designer',
                    reputation: 85,
                    isFollowing: true,
                },
            ];
            
            return { following };
        } catch (err) {
            reply.code(500).send({ error: 'Failed to fetch following' });
        }
    });

    // POST /api/follow
    app.post<{ Body: { targetAddress: string } }>('/api/follow', async (request, reply) => {
        const { targetAddress } = request.body;
        
        try {
            // TODO: Save to database
            console.log('Follow:', targetAddress);
            return { success: true };
        } catch (err) {
            reply.code(500).send({ error: 'Failed to follow' });
        }
    });

    // POST /api/unfollow
    app.post<{ Body: { targetAddress: string } }>('/api/unfollow', async (request, reply) => {
        const { targetAddress } = request.body;
        
        try {
            // TODO: Remove from database
            console.log('Unfollow:', targetAddress);
            return { success: true };
        } catch (err) {
            reply.code(500).send({ error: 'Failed to unfollow' });
        }
    });

    // ========== Feed Routes ==========
    
    // GET /api/feed
    app.get<{ Querystring: { page?: string; limit?: string } }>('/api/feed', async (request, reply) => {
        const page = parseInt(request.query.page || '1');
        const limit = parseInt(request.query.limit || '20');
        
        try {
            // TODO: Query database
            const posts: Post[] = [
                {
                    id: '1',
                    authorAddress: '0xabc...123',
                    content: 'Just deployed my first AI agent! Excited to see how it performs. 🤖',
                    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                    likes: 24,
                    comments: 5,
                    shares: 2,
                },
                {
                    id: '2',
                    authorAddress: '0xdef...456',
                    content: 'New workflow available: Auto-responder for customer support.',
                    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
                    likes: 56,
                    comments: 12,
                    shares: 8,
                },
            ];
            
            return { posts, page, limit, hasMore: page < 3 };
        } catch (err) {
            reply.code(500).send({ error: 'Failed to fetch feed' });
        }
    });

    // GET /api/posts/:id
    app.get<{ Params: { id: string } }>('/api/posts/:id', async (request, reply) => {
        const { id } = request.params;
        
        try {
            // TODO: Query database
            const post: Post = {
                id,
                authorAddress: '0xabc...123',
                content: 'This is a detailed post view.',
                createdAt: new Date().toISOString(),
                likes: 42,
                comments: 8,
                shares: 3,
            };
            
            return post;
        } catch (err) {
            reply.code(500).send({ error: 'Failed to fetch post' });
        }
    });

    // POST /api/posts/:id/like
    app.post<{ Params: { id: string } }>('/api/posts/:id/like', async (request, reply) => {
        const { id } = request.params;
        
        try {
            // TODO: Update database
            console.log('Like post:', id);
            return { success: true };
        } catch (err) {
            reply.code(500).send({ error: 'Failed to like post' });
        }
    });
}
