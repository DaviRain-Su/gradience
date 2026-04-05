/**
 * P2P Soul Handshake Protocol - FSM Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HandshakeFSM } from '../fsm.js';
import { DisclosureLevel } from '../types.js';

describe('HandshakeFSM', () => {
  let fsm: HandshakeFSM;
  
  beforeEach(() => {
    fsm = new HandshakeFSM('test-session', 'did:alice');
  });
  
  describe('Initial State', () => {
    it('should start in IDLE state', () => {
      expect(fsm.getState()).toBe('IDLE');
    });
    
    it('should have correct session ID', () => {
      expect(fsm.getSessionId()).toBe('test-session');
    });
    
    it('should not be active initially', () => {
      expect(fsm.isActive()).toBe(false);
    });
  });
  
  describe('Discovery', () => {
    it('should transition to DISCOVERING on discover()', async () => {
      await fsm.discover({ seeking: 'collaboration' });
      expect(fsm.getState()).toBe('DISCOVERING');
    });
    
    it('should be active after discover', async () => {
      await fsm.discover({});
      expect(fsm.isActive()).toBe(true);
    });
  });
  
  describe('Invite Handling', () => {
    it('should transition to INVITED on receiveInvite', async () => {
      const invite = {
        version: '1.0.0',
        messageId: 'msg-1',
        correlationId: 'corr-1',
        timestamp: Date.now(),
        sender: { did: 'did:bob', publicKey: 'key' },
        messageType: 'INVITE' as const,
        payload: {
          targetDid: 'did:alice',
          publicProfile: {
            did: 'did:bob',
            reputationScore: 80,
            activeCategories: ['DeFi'],
            seeking: 'collaboration',
          },
          initialDisclosure: DisclosureLevel.LEVEL_1_ANONYMOUS,
          ephemeralPublicKey: 'key',
          reputationProof: { programId: 'prog', accountAddress: 'addr', signature: 'sig' },
        },
        signature: 'sig',
      };
      
      await fsm.receiveInvite(invite);
      expect(fsm.getState()).toBe('INVITED');
    });
    
    it('should transition to HANDSHAKING on acceptInvite', async () => {
      const invite = {
        version: '1.0.0',
        messageId: 'msg-1',
        correlationId: 'corr-1',
        timestamp: Date.now(),
        sender: { did: 'did:bob', publicKey: 'key' },
        messageType: 'INVITE' as const,
        payload: {
          targetDid: 'did:alice',
          publicProfile: {
            did: 'did:bob',
            reputationScore: 80,
            activeCategories: ['DeFi'],
            seeking: 'collaboration',
          },
          initialDisclosure: DisclosureLevel.LEVEL_1_ANONYMOUS,
          ephemeralPublicKey: 'key',
          reputationProof: { programId: 'prog', accountAddress: 'addr', signature: 'sig' },
        },
        signature: 'sig',
      };
      
      await fsm.receiveInvite(invite);
      await fsm.acceptInvite(DisclosureLevel.LEVEL_1_ANONYMOUS);
      
      expect(fsm.getState()).toBe('HANDSHAKING');
    });
    
    it('should transition to FAILED on rejectInvite', async () => {
      const invite = {
        version: '1.0.0',
        messageId: 'msg-1',
        correlationId: 'corr-1',
        timestamp: Date.now(),
        sender: { did: 'did:bob', publicKey: 'key' },
        messageType: 'INVITE' as const,
        payload: {
          targetDid: 'did:alice',
          publicProfile: {
            did: 'did:bob',
            reputationScore: 80,
            activeCategories: ['DeFi'],
            seeking: 'collaboration',
          },
          initialDisclosure: DisclosureLevel.LEVEL_1_ANONYMOUS,
          ephemeralPublicKey: 'key',
          reputationProof: { programId: 'prog', accountAddress: 'addr', signature: 'sig' },
        },
        signature: 'sig',
      };
      
      await fsm.receiveInvite(invite);
      await fsm.rejectInvite();
      
      expect(fsm.getState()).toBe('FAILED');
      expect(fsm.hasFailed()).toBe(true);
    });
  });
  
  describe('Handshake', () => {
    beforeEach(async () => {
      const invite = {
        version: '1.0.0',
        messageId: 'msg-1',
        correlationId: 'corr-1',
        timestamp: Date.now(),
        sender: { did: 'did:bob', publicKey: 'key' },
        messageType: 'INVITE' as const,
        payload: {
          targetDid: 'did:alice',
          publicProfile: {
            did: 'did:bob',
            reputationScore: 80,
            activeCategories: ['DeFi'],
            seeking: 'collaboration',
          },
          initialDisclosure: DisclosureLevel.LEVEL_1_ANONYMOUS,
          ephemeralPublicKey: 'key',
          reputationProof: { programId: 'prog', accountAddress: 'addr', signature: 'sig' },
        },
        signature: 'sig',
      };
      
      await fsm.receiveInvite(invite);
      await fsm.acceptInvite(DisclosureLevel.LEVEL_1_ANONYMOUS);
    });
    
    it('should stay in HANDSHAKING after disclose with need_more_info', async () => {
      await fsm.disclose(DisclosureLevel.LEVEL_1_ANONYMOUS, 'need_more_info');
      expect(fsm.getState()).toBe('HANDSHAKING');
    });
    
    it('should transition to FAILED if local passes', async () => {
      await fsm.disclose(DisclosureLevel.LEVEL_1_ANONYMOUS, 'pass');
      expect(fsm.getState()).toBe('FAILED');
    });
    
    it('should transition to MATCHED on confirmMatch', async () => {
      await fsm.confirmMatch();
      expect(fsm.getState()).toBe('MATCHED');
      expect(fsm.isMatched()).toBe(true);
    });
    
    it('should transition to FAILED on rejectMatch', async () => {
      await fsm.rejectMatch('Not interested');
      expect(fsm.getState()).toBe('FAILED');
    });
  });
  
  describe('State Management', () => {
    it('should track current disclosure level', async () => {
      expect(fsm.getCurrentLevel()).toBe(DisclosureLevel.LEVEL_0_PUBLIC);
      
      const invite = {
        version: '1.0.0',
        messageId: 'msg-1',
        correlationId: 'corr-1',
        timestamp: Date.now(),
        sender: { did: 'did:bob', publicKey: 'key' },
        messageType: 'INVITE' as const,
        payload: {
          targetDid: 'did:alice',
          publicProfile: {
            did: 'did:bob',
            reputationScore: 80,
            activeCategories: ['DeFi'],
            seeking: 'collaboration',
          },
          initialDisclosure: DisclosureLevel.LEVEL_1_ANONYMOUS,
          ephemeralPublicKey: 'key',
          reputationProof: { programId: 'prog', accountAddress: 'addr', signature: 'sig' },
        },
        signature: 'sig',
      };
      
      await fsm.receiveInvite(invite);
      await fsm.acceptInvite(DisclosureLevel.LEVEL_2_VAGUE);
      
      expect(fsm.getCurrentLevel()).toBe(DisclosureLevel.LEVEL_2_VAGUE);
    });
    
    it('should store and retrieve shared secret', () => {
      const secret = new Uint8Array(32).fill(1);
      fsm.setSharedSecret(secret);
      
      expect(fsm.getSharedSecret()).toEqual(secret);
    });
    
    it('should store and retrieve ephemeral key pair', async () => {
      const keyPair = {
        publicKey: new Uint8Array(32).fill(1),
        privateKey: new Uint8Array(32).fill(2),
      };
      
      fsm.setEphemeralKeyPair(keyPair);
      
      expect(fsm.getEphemeralKeyPair()).toEqual(keyPair);
    });
  });
  
  describe('Events', () => {
    it('should emit state_changed event', async () => {
      const states: string[] = [];
      
      fsm.on('state_changed', (event) => {
        states.push(`${event.from}->${event.to}`);
      });
      
      await fsm.discover({});
      
      expect(states).toContain('IDLE->DISCOVERING');
    });
    
    it('should emit matched event', async () => {
      let matched = false;
      
      fsm.on('matched', () => {
        matched = true;
      });
      
      const invite = {
        version: '1.0.0',
        messageId: 'msg-1',
        correlationId: 'corr-1',
        timestamp: Date.now(),
        sender: { did: 'did:bob', publicKey: 'key' },
        messageType: 'INVITE' as const,
        payload: {
          targetDid: 'did:alice',
          publicProfile: {
            did: 'did:bob',
            reputationScore: 80,
            activeCategories: ['DeFi'],
            seeking: 'collaboration',
          },
          initialDisclosure: DisclosureLevel.LEVEL_1_ANONYMOUS,
          ephemeralPublicKey: 'key',
          reputationProof: { programId: 'prog', accountAddress: 'addr', signature: 'sig' },
        },
        signature: 'sig',
      };
      
      await fsm.receiveInvite(invite);
      await fsm.acceptInvite(DisclosureLevel.LEVEL_1_ANONYMOUS);
      await fsm.confirmMatch();
      
      expect(matched).toBe(true);
    });
  });
  
  describe('Invalid Transitions', () => {
    it('should throw on invalid transition', async () => {
      await expect(fsm.disclose(DisclosureLevel.LEVEL_1_ANONYMOUS, 'interested'))
        .rejects.toThrow('Invalid transition');
    });
    
    it('should throw on confirmMatch from IDLE', async () => {
      await expect(fsm.confirmMatch())
        .rejects.toThrow('Invalid transition');
    });
  });
});
