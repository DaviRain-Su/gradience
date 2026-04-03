import { Hono } from 'hono';
import type { AgentReputationResponse, AgentProfileApi, ReputationApi } from '../types';

export function createAgentsRouter(
    reputation: Map<string, ReputationApi>,
    profiles: Map<string, AgentProfileApi>
) {
    const router = new Hono();

    // GET /api/agents/:pubkey/reputation
    router.get('/:pubkey/reputation', (c) => {
        const pubkey = c.req.param('pubkey');
        const rep = reputation.get(pubkey);

        if (!rep) {
            return c.json({ error: 'Agent not found' }, 404);
        }

        const response: AgentReputationResponse = {
            agent: rep.agent,
            global_avg_score: rep.global_avg_score,
            global_win_rate: rep.global_win_rate,
            global_completed: rep.global_completed,
            global_total_applied: rep.global_total_applied,
            total_earned: rep.total_earned,
            updated_slot: rep.updated_slot,
            avg_score: rep.global_avg_score,
            completed: rep.global_completed,
            total_applied: rep.global_total_applied,
            win_rate: rep.global_win_rate,
        };

        return c.json(response);
    });

    // GET /api/agents/:pubkey/profile
    router.get('/:pubkey/profile', (c) => {
        const pubkey = c.req.param('pubkey');
        const profile = profiles.get(pubkey);
        if (!profile) {
            return c.json({ error: 'Profile not found' }, 404);
        }
        return c.json(profile);
    });

    // PUT /api/agents/:pubkey/profile
    router.put('/:pubkey/profile', async (c) => {
        const pubkey = c.req.param('pubkey');
        const body = await c.req.json<Partial<AgentProfileApi>>();
        const now = Math.floor(Date.now() / 1000);

        const existing = profiles.get(pubkey);
        const updated: AgentProfileApi = {
            agent: pubkey,
            display_name: body.display_name ?? existing?.display_name ?? '',
            bio: body.bio ?? existing?.bio ?? '',
            links: body.links ?? existing?.links ?? {},
            onchain_ref: body.onchain_ref ?? existing?.onchain_ref ?? null,
            publish_mode: (body.publish_mode as AgentProfileApi['publish_mode']) ?? existing?.publish_mode ?? 'manual',
            updated_at: now,
        };

        profiles.set(pubkey, updated);
        return c.json({ ok: true });
    });

    return router;
}
