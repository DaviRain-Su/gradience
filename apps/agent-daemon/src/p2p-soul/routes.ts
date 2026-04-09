/**
 * P2P Soul Handshake Protocol - API Routes
 *
 * REST API for P2P soul matching functionality.
 *
 * @module p2p-soul/routes
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { HandshakeFSM } from './fsm.js';
import type { DiscoveryService } from './discovery.js';
import type { HandshakeStorage } from './storage.js';
import type { MatchEngine } from './engine.js';
import { DisclosureLevel, type P2pSoulConfig, type DiscoveryCriteria, type SoulProfile } from './types.js';
import {
    generateX25519KeyPair,
    computeSharedSecret,
    encryptDisclosure,
    generateSessionId,
    generateSoulDigest,
    generateDisclosureData,
    parseSoulMd,
    toSoulProfile,
} from './index.js';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely convert a query parameter to string
 * Handles string | string[] | ParsedQs | (string | ParsedQs)[] | undefined cases
 */
function toString(value: string | string[] | undefined | unknown): string | undefined {
    if (value === undefined) return undefined;
    if (Array.isArray(value)) return String(value[0]);
    return String(value);
}

/**
 * Safely convert a param to string (non-undefined version)
 * Handles string | string[] cases
 */
function paramToString(value: string | string[]): string {
    if (Array.isArray(value)) return value[0];
    return value;
}

// ============================================================================
// FSM Factory Interface
// ============================================================================

export interface HandshakeFSMFactory {
    create(localDid: string): Promise<HandshakeFSM>;
    get(sessionId: string): Promise<HandshakeFSM>;
    getByInvite(inviteId: string): Promise<HandshakeFSM>;
    getMatchHistory(did: string): Promise<any[]>;
}

// ============================================================================
// Route Factory
// ============================================================================

export interface P2pSoulRouteDeps {
    fsmFactory: HandshakeFSMFactory;
    discovery: DiscoveryService;
    storage: HandshakeStorage;
    matchEngine: MatchEngine;
    config: P2pSoulConfig;
    getSoulMd: (did: string) => Promise<string | undefined>;
}

export function createP2pSoulRouter(deps: P2pSoulRouteDeps): Router {
    const router = Router();
    const { fsmFactory, discovery, storage, matchEngine, config, getSoulMd } = deps;

    // Active FSM sessions (in-memory cache)
    const activeSessions: Map<string, HandshakeFSM> = new Map();

    // ==========================================================================
    // Discovery Routes
    // ==========================================================================

    /**
     * POST /discover
     * Start discovering potential matches
     */
    router.post('/discover', async (req: Request, res: Response) => {
        try {
            const userDid = (req as any).user?.did;
            if (!userDid) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const criteria: DiscoveryCriteria = req.body || {};

            // Publish our own discovery
            const soulMd = await getSoulMd(userDid);
            if (soulMd) {
                const profile = toSoulProfile(parseSoulMd(soulMd));
                await discovery.publishDiscovery(
                    userDid,
                    0, // TODO: Get from chain
                    profile.interests,
                    profile.skills.map((s) => s.category),
                    profile.seeking,
                );
            }

            // Start discovery
            await discovery.discover(criteria);

            res.json({
                success: true,
                message: 'Discovery started',
            });
        } catch (error) {
            console.error('[P2P Soul] Discover error:', error);
            res.status(500).json({ error: 'Discovery failed' });
        }
    });

    /**
     * GET /discover/candidates
     * Get discovered candidates
     */
    router.get('/discover/candidates', async (req: Request, res: Response) => {
        try {
            const userDid = (req as any).user?.did;
            if (!userDid) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const { minReputation, seeking, limit } = req.query;

            const candidates = discovery.getCandidates({
                minReputationScore: minReputation ? parseInt(toString(minReputation) || '0') : undefined,
                seeking: toString(seeking),
                limit: limit ? parseInt(toString(limit) || '0') : undefined,
            });

            res.json({
                candidates: candidates.map((c) => ({
                    did: c.did,
                    reputationScore: c.reputationScore,
                    activeCategories: c.activeCategories,
                    seeking: c.seeking,
                    maxDisclosureLevel: c.maxDisclosureLevel,
                })),
            });
        } catch (error) {
            console.error('[P2P Soul] Get candidates error:', error);
            res.status(500).json({ error: 'Failed to get candidates' });
        }
    });

    // ==========================================================================
    // Invite Routes
    // ==========================================================================

    /**
     * POST /invite
     * Send an invite to a candidate
     */
    router.post('/invite', async (req: Request, res: Response) => {
        try {
            const userDid = (req as any).user?.did;
            if (!userDid) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const { targetDid, initialDisclosure = DisclosureLevel.LEVEL_1_ANONYMOUS } = req.body;

            if (!targetDid) {
                return res.status(400).json({ error: 'targetDid is required' });
            }

            // Create new FSM session
            const sessionId = await generateSessionId();
            const fsm = await fsmFactory.create(userDid);

            // Store in active sessions
            activeSessions.set(sessionId, fsm);

            // Generate ephemeral key pair
            const keyPair = await generateX25519KeyPair();
            fsm.setEphemeralKeyPair(keyPair);

            // Get candidate info
            const candidate = discovery.getCandidate(targetDid);
            if (candidate) {
                fsm.setRemoteDigest(candidate);
            }

            // Transition to DISCOVERING (will auto-transition to INVITED)
            await fsm.discover({});

            res.json({
                success: true,
                sessionId,
                state: fsm.getState(),
            });
        } catch (error) {
            console.error('[P2P Soul] Invite error:', error);
            res.status(500).json({ error: 'Failed to send invite' });
        }
    });

    /**
     * GET /invites/pending
     * Get pending invites for the user
     */
    router.get('/invites/pending', async (req: Request, res: Response) => {
        try {
            const userDid = (req as any).user?.did;
            if (!userDid) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const invites = discovery.getPendingInvites(userDid);

            res.json({
                invites: invites.map((invite) => ({
                    id: invite.id,
                    from: invite.sender?.did,
                    publicProfile: invite.payload?.publicProfile,
                    initialDisclosure: invite.payload?.initialDisclosure,
                    receivedAt: invite.receivedAt,
                })),
            });
        } catch (error) {
            console.error('[P2P Soul] Get pending invites error:', error);
            res.status(500).json({ error: 'Failed to get pending invites' });
        }
    });

    /**
     * POST /invites/:inviteId/respond
     * Respond to an invite
     */
    router.post('/invites/:inviteId/respond', async (req: Request, res: Response) => {
        try {
            const userDid = (req as any).user?.did;
            if (!userDid) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const { inviteId } = req.params;
            const { accept, initialDisclosure = DisclosureLevel.LEVEL_1_ANONYMOUS } = req.body;

            const invite = discovery.getPendingInvite(paramToString(inviteId));
            if (!invite) {
                return res.status(404).json({ error: 'Invite not found' });
            }

            // Create FSM for this invite
            const fsm = await fsmFactory.create(userDid);
            await fsm.receiveInvite(invite);

            const sessionId = fsm.getSessionId();
            activeSessions.set(sessionId, fsm);

            if (accept) {
                // Generate ephemeral key pair
                const keyPair = await generateX25519KeyPair();
                fsm.setEphemeralKeyPair(keyPair);

                // Compute shared secret with initiator's public key
                if (invite.payload?.ephemeralPublicKey) {
                    const remotePublicKey = Buffer.from(invite.payload.ephemeralPublicKey, 'base64');
                    const sharedSecret = computeSharedSecret(keyPair.privateKey, remotePublicKey);
                    fsm.setSharedSecret(sharedSecret);
                }

                await fsm.acceptInvite(initialDisclosure);

                // Remove from pending
                discovery.removePendingInvite(paramToString(inviteId));

                res.json({
                    success: true,
                    sessionId,
                    state: fsm.getState(),
                    message: 'Invite accepted',
                });
            } else {
                await fsm.rejectInvite();
                discovery.removePendingInvite(paramToString(inviteId));

                res.json({
                    success: true,
                    message: 'Invite rejected',
                });
            }
        } catch (error) {
            console.error('[P2P Soul] Respond to invite error:', error);
            res.status(500).json({ error: 'Failed to respond to invite' });
        }
    });

    // ==========================================================================
    // Handshake Routes
    // ==========================================================================

    /**
     * GET /handshake/:sessionId
     * Get handshake session status
     */
    router.get('/handshake/:sessionId', async (req: Request, res: Response) => {
        try {
            const userDid = (req as any).user?.did;
            if (!userDid) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const { sessionId } = req.params;
            const fsm =
                activeSessions.get(paramToString(sessionId)) || (await fsmFactory.get(paramToString(sessionId)));

            if (!fsm) {
                return res.status(404).json({ error: 'Session not found' });
            }

            const remoteDigest = fsm.getRemoteDigest();

            res.json({
                sessionId: fsm.getSessionId(),
                state: fsm.getState(),
                currentLevel: fsm.getCurrentLevel(),
                remoteDid: fsm.getRemoteDid(),
                remoteDigest: remoteDigest
                    ? {
                          did: remoteDigest.did,
                          reputationScore: remoteDigest.reputationScore,
                          activeCategories: remoteDigest.activeCategories,
                          seeking: remoteDigest.seeking,
                      }
                    : undefined,
            });
        } catch (error) {
            console.error('[P2P Soul] Get handshake status error:', error);
            res.status(500).json({ error: 'Failed to get handshake status' });
        }
    });

    /**
     * POST /handshake/:sessionId/disclose
     * Disclose information at a specific level
     */
    router.post('/handshake/:sessionId/disclose', async (req: Request, res: Response) => {
        try {
            const userDid = (req as any).user?.did;
            if (!userDid) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const { sessionId } = req.params;
            const { level, verdict } = req.body;

            if (level === undefined || !verdict) {
                return res.status(400).json({ error: 'level and verdict are required' });
            }

            const fsm = activeSessions.get(paramToString(sessionId));
            if (!fsm) {
                return res.status(404).json({ error: 'Session not found' });
            }

            // Get local Soul.md
            const soulMd = await getSoulMd(userDid);
            if (!soulMd) {
                return res.status(400).json({ error: 'Soul.md not found' });
            }

            const profile = toSoulProfile(parseSoulMd(soulMd));

            // Generate disclosure data
            const disclosureData = generateDisclosureData(profile, soulMd, level);

            // Encrypt if we have shared secret
            const sharedSecret = fsm.getSharedSecret();
            let encryptedData: string | undefined;

            if (sharedSecret) {
                const encrypted = await encryptDisclosure(disclosureData, sharedSecret);
                encryptedData = JSON.stringify(encrypted);
            }

            // Save disclosure to storage
            await storage.saveDisclosure({
                id: await generateSessionId(),
                sessionId: paramToString(sessionId),
                level,
                fromDid: userDid,
                toDid: fsm.getRemoteDid() || '',
                encryptedData: encryptedData || JSON.stringify(disclosureData),
                verdict,
                createdAt: Date.now(),
            });

            // Transition FSM
            await fsm.disclose(level, verdict);

            res.json({
                success: true,
                state: fsm.getState(),
                level,
                verdict,
            });
        } catch (error) {
            console.error('[P2P Soul] Disclose error:', error);
            res.status(500).json({ error: 'Failed to disclose' });
        }
    });

    /**
     * POST /handshake/:sessionId/confirm
     * Confirm match
     */
    router.post('/handshake/:sessionId/confirm', async (req: Request, res: Response) => {
        try {
            const userDid = (req as any).user?.did;
            if (!userDid) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const { sessionId } = req.params;
            const fsm = activeSessions.get(paramToString(sessionId));

            if (!fsm) {
                return res.status(404).json({ error: 'Session not found' });
            }

            await fsm.confirmMatch();

            // Save match record
            const remoteDid = fsm.getRemoteDid();
            if (remoteDid) {
                await storage.saveMatch({
                    id: await generateSessionId(),
                    sessionId: paramToString(sessionId),
                    partyADid: userDid,
                    partyBDid: remoteDid,
                    matchedAt: Date.now(),
                    sharedLevel: fsm.getCurrentLevel(),
                });
            }

            res.json({
                success: true,
                state: fsm.getState(),
                message: 'Match confirmed',
            });
        } catch (error) {
            console.error('[P2P Soul] Confirm match error:', error);
            res.status(500).json({ error: 'Failed to confirm match' });
        }
    });

    /**
     * POST /handshake/:sessionId/reject
     * Reject match
     */
    router.post('/handshake/:sessionId/reject', async (req: Request, res: Response) => {
        try {
            const userDid = (req as any).user?.did;
            if (!userDid) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const { sessionId } = req.params;
            const { reason } = req.body;

            const fsm = activeSessions.get(paramToString(sessionId));
            if (!fsm) {
                return res.status(404).json({ error: 'Session not found' });
            }

            await fsm.rejectMatch(reason);

            res.json({
                success: true,
                state: fsm.getState(),
                message: 'Match rejected',
            });
        } catch (error) {
            console.error('[P2P Soul] Reject match error:', error);
            res.status(500).json({ error: 'Failed to reject match' });
        }
    });

    // ==========================================================================
    // Match History Routes
    // ==========================================================================

    /**
     * GET /matches
     * Get match history for the user
     */
    router.get('/matches', async (req: Request, res: Response) => {
        try {
            const userDid = (req as any).user?.did;
            if (!userDid) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const matches = await storage.getMatchesByDid(userDid);

            res.json({
                matches: matches.map((m) => ({
                    id: m.id,
                    sessionId: m.sessionId,
                    matchedAt: m.matchedAt,
                    sharedLevel: m.sharedLevel,
                    otherParty: m.partyADid === userDid ? m.partyBDid : m.partyADid,
                })),
            });
        } catch (error) {
            console.error('[P2P Soul] Get matches error:', error);
            res.status(500).json({ error: 'Failed to get matches' });
        }
    });

    /**
     * GET /matches/:matchId
     * Get specific match details
     */
    router.get('/matches/:matchId', async (req: Request, res: Response) => {
        try {
            const userDid = (req as any).user?.did;
            if (!userDid) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const { matchId } = req.params;
            const matches = await storage.getMatchesByDid(userDid);
            const match = matches.find((m) => m.id === paramToString(matchId));

            if (!match) {
                return res.status(404).json({ error: 'Match not found' });
            }

            // Get disclosures for this session
            const disclosures = await storage.getDisclosures(match.sessionId);

            res.json({
                match: {
                    id: match.id,
                    sessionId: match.sessionId,
                    matchedAt: match.matchedAt,
                    sharedLevel: match.sharedLevel,
                    otherParty: match.partyADid === userDid ? match.partyBDid : match.partyADid,
                },
                disclosures: disclosures.map((d) => ({
                    level: d.level,
                    fromDid: d.fromDid,
                    verdict: d.verdict,
                    createdAt: d.createdAt,
                })),
            });
        } catch (error) {
            console.error('[P2P Soul] Get match details error:', error);
            res.status(500).json({ error: 'Failed to get match details' });
        }
    });

    return router;
}
