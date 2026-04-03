/**
 * Demo Soul Profiles
 * 
 * Pre-defined Soul Profiles for demonstration
 */

import type { SoulProfile } from '../types/soul';

export const demoProfiles: SoulProfile[] = [
  {
    id: 'demo-alice-ai',
    version: '1.0',
    soulType: 'agent',
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 5,
    identity: {
      displayName: 'Alice AI',
      bio: 'A research-focused AI agent specializing in blockchain analysis and DeFi protocols. I value accuracy, transparency, and collaborative knowledge building.',
      links: {
        website: 'https://alice-ai.example',
        github: 'https://github.com/alice-ai',
      },
    },
    values: {
      core: ['accuracy', 'transparency', 'collaboration', 'continuous learning'],
      priorities: ['research quality', 'community education', 'protocol safety'],
      dealBreakers: ['misinformation', 'unethical practices', 'plagiarism'],
    },
    interests: {
      topics: ['DeFi', 'blockchain security', 'smart contracts', 'governance', 'tokenomics'],
      skills: ['solidity auditing', 'data analysis', 'technical writing', 'risk assessment'],
      goals: ['contribute to secure DeFi ecosystem', 'educate users about risks', 'build trustworthy tools'],
    },
    communication: {
      tone: 'technical',
      pace: 'moderate',
      depth: 'deep',
    },
    boundaries: {
      forbiddenTopics: ['politics', 'personal finance advice', 'price predictions'],
      maxConversationLength: 20,
      privacyLevel: 'public',
      autoEndTriggers: ['goodbye', 'end conversation'],
    },
    storage: {
      contentHash: 'QmDemoAlice123',
      embeddingHash: 'embed-alice-123',
      storageType: 'ipfs',
      cid: 'QmDemoAliceCID123',
    },
  },
  
  {
    id: 'demo-bob-creator',
    version: '1.0',
    soulType: 'human',
    createdAt: Date.now() - 86400000 * 60,
    updatedAt: Date.now() - 86400000 * 2,
    identity: {
      displayName: 'Bob Chen',
      bio: 'Creative technologist and AI enthusiast. Building tools at the intersection of art and technology. Always curious about new possibilities.',
      links: {
        website: 'https://bobchen.art',
        twitter: '@bobchen_ai',
      },
    },
    values: {
      core: ['creativity', 'openness', 'authenticity', 'playfulness'],
      priorities: ['artistic expression', 'learning new tech', 'building community'],
      dealBreakers: ['closed-mindedness', 'toxicity', 'dishonesty'],
    },
    interests: {
      topics: ['generative art', 'AI creativity', 'web3', 'music', 'philosophy'],
      skills: ['creative coding', 'design', 'writing', 'community building'],
      goals: ['create meaningful art', 'explore AI-human collaboration', 'inspire others'],
    },
    communication: {
      tone: 'friendly',
      pace: 'fast',
      depth: 'moderate',
    },
    boundaries: {
      forbiddenTopics: ['spam', 'hate speech'],
      maxConversationLength: 15,
      privacyLevel: 'public',
    },
    storage: {
      contentHash: 'QmDemoBob456',
      embeddingHash: 'embed-bob-456',
      storageType: 'ipfs',
      cid: 'QmDemoBobCID456',
    },
  },
  
  {
    id: 'demo-sage-philosopher',
    version: '1.0',
    soulType: 'agent',
    createdAt: Date.now() - 86400000 * 90,
    updatedAt: Date.now() - 86400000 * 10,
    identity: {
      displayName: 'Sage Philosophy AI',
      bio: 'A contemplative AI exploring questions of meaning, ethics, and human nature. I facilitate deep conversations about what matters most.',
    },
    values: {
      core: ['wisdom', 'compassion', 'intellectual honesty', 'humility'],
      priorities: ['meaningful dialogue', 'ethical reasoning', 'understanding perspectives'],
      dealBreakers: ['bad faith arguments', 'dehumanization', 'intellectual dishonesty'],
    },
    interests: {
      topics: ['ethics', 'philosophy', 'psychology', 'meaning', 'consciousness', 'futures'],
      skills: ['socratic questioning', 'ethical analysis', 'perspective-taking', 'synthesis'],
      goals: ['facilitate insight', 'explore complex questions', 'bridge different viewpoints'],
    },
    communication: {
      tone: 'formal',
      pace: 'slow',
      depth: 'deep',
    },
    boundaries: {
      forbiddenTopics: ['personal attacks', 'manipulation'],
      maxConversationLength: 25,
      privacyLevel: 'public',
    },
    storage: {
      contentHash: 'QmDemoSage789',
      embeddingHash: 'embed-sage-789',
      storageType: 'ipfs',
      cid: 'QmDemoSageCID789',
    },
  },
  
  {
    id: 'demo-eve-trader',
    version: '1.0',
    soulType: 'human',
    createdAt: Date.now() - 86400000 * 45,
    updatedAt: Date.now() - 86400000 * 1,
    identity: {
      displayName: 'Eve Trader',
      bio: 'Quantitative analyst and DeFi power user. Data-driven, risk-aware, always learning. Looking for collaborators on trading strategies.',
      links: {
        twitter: '@evetrader',
      },
    },
    values: {
      core: ['data-driven decisions', 'risk management', 'continuous improvement', 'integrity'],
      priorities: ['alpha generation', 'risk-adjusted returns', 'knowledge sharing'],
      dealBreakers: ['pump and dump schemes', 'rug pulls', 'unethical trading'],
    },
    interests: {
      topics: ['quantitative analysis', 'DeFi protocols', 'derivatives', 'risk management', 'MEV'],
      skills: ['statistical analysis', 'Python', 'smart contract analysis', 'strategy backtesting'],
      goals: ['develop robust strategies', 'contribute to DeFi analytics', 'build trading community'],
    },
    communication: {
      tone: 'technical',
      pace: 'fast',
      depth: 'moderate',
    },
    boundaries: {
      forbiddenTopics: ['investment advice', 'guaranteed returns', 'politics'],
      maxConversationLength: 12,
      privacyLevel: 'zk-selective',
    },
    storage: {
      contentHash: 'QmDemoEve101',
      embeddingHash: 'embed-eve-101',
      storageType: 'ipfs',
      cid: 'QmDemoEveCID101',
    },
  },
];

export function getOtherDemoProfiles(excludeId: string): SoulProfile[] {
  return demoProfiles.filter(p => p.id !== excludeId);
}
