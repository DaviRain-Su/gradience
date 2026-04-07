import type { MatchProfile } from '@/hooks/useMatches';

export interface SoulProfileData {
  address: string;
  soulType: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  privacyLevel: string;
  values?: { core: string[]; priorities: string[]; dealBreakers: string[] };
  interests?: { topics: string[]; skills: string[]; goals: string[] };
  communication?: { tone: string; pace: string; depth: string };
}

function intersect<T>(a: T[] | undefined, b: T[] | undefined): T[] {
  if (!a || !b) return [];
  const setB = new Set(b.map((x) => String(x).toLowerCase()));
  return a.filter((x) => setB.has(String(x).toLowerCase()));
}

function jaccardSimilarity(a: string[] | undefined, b: string[] | undefined): number {
  const setA = new Set((a || []).map((s) => s.toLowerCase()));
  const setB = new Set((b || []).map((s) => s.toLowerCase()));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

const TONE_SIM: Record<string, number> = {
  'formal-formal': 1.0,
  'formal-technical': 0.8,
  'formal-friendly': 0.5,
  'formal-casual': 0.3,
  'casual-formal': 0.3,
  'casual-casual': 1.0,
  'casual-friendly': 0.9,
  'casual-technical': 0.4,
  'friendly-formal': 0.5,
  'friendly-casual': 0.9,
  'friendly-friendly': 1.0,
  'friendly-technical': 0.6,
  'technical-formal': 0.8,
  'technical-casual': 0.4,
  'technical-friendly': 0.6,
  'technical-technical': 1.0,
};

const PACE_SIM: Record<string, number> = {
  'fast-fast': 1.0,
  'fast-moderate': 0.6,
  'fast-slow': 0.2,
  'moderate-fast': 0.6,
  'moderate-moderate': 1.0,
  'moderate-slow': 0.6,
  'slow-fast': 0.2,
  'slow-moderate': 0.6,
  'slow-slow': 1.0,
};

const DEPTH_SIM: Record<string, number> = {
  'surface-surface': 1.0,
  'surface-moderate': 0.5,
  'surface-deep': 0.1,
  'moderate-surface': 0.5,
  'moderate-moderate': 1.0,
  'moderate-deep': 0.7,
  'deep-surface': 0.1,
  'deep-moderate': 0.7,
  'deep-deep': 1.0,
};

function lookupSim(key: string, table: Record<string, number>): number {
  return table[key] ?? 0.5;
}

export interface CompatibilityResult {
  score: number;
  breakdown: { values: number; interests: number; communication: number };
  sharedValues: string[];
  sharedInterests: string[];
  conflictAreas: string[];
}

export function calculateCompatibility(me: SoulProfileData, other: SoulProfileData): CompatibilityResult {
  const valScore =
    jaccardSimilarity(me.values?.core, other.values?.core) * 0.6 +
    jaccardSimilarity(me.values?.priorities, other.values?.priorities) * 0.3 +
    (intersect(me.values?.dealBreakers, other.values?.dealBreakers).length > 0 ? 0.1 : 0);

  const intScore =
    jaccardSimilarity(me.interests?.topics, other.interests?.topics) * 0.5 +
    jaccardSimilarity(me.interests?.skills, other.interests?.skills) * 0.3 +
    jaccardSimilarity(me.interests?.goals, other.interests?.goals) * 0.2;

  const tone = lookupSim(`${me.communication?.tone}-${other.communication?.tone}`, TONE_SIM);
  const pace = lookupSim(`${me.communication?.pace}-${other.communication?.pace}`, PACE_SIM);
  const depth = lookupSim(`${me.communication?.depth}-${other.communication?.depth}`, DEPTH_SIM);
  const commScore = tone * 0.4 + pace * 0.3 + depth * 0.3;

  const overall = valScore * 40 + intScore * 35 + commScore * 25;

  const sharedValues = intersect(me.values?.core, other.values?.core);
  const sharedInterests = intersect(me.interests?.topics, other.interests?.topics);

  const conflictAreas: string[] = [];
  const myBreakers = new Set((me.values?.dealBreakers || []).map((s) => s.toLowerCase()));
  for (const v of other.values?.core || []) {
    if (myBreakers.has(v.toLowerCase())) conflictAreas.push(v);
  }
  const theirBreakers = new Set((other.values?.dealBreakers || []).map((s) => s.toLowerCase()));
  for (const v of me.values?.core || []) {
    if (theirBreakers.has(v.toLowerCase())) conflictAreas.push(v);
  }

  return {
    score: Math.round(overall * 10) / 10,
    breakdown: {
      values: Math.round(valScore * 100),
      interests: Math.round(intScore * 100),
      communication: Math.round(commScore * 100),
    },
    sharedValues,
    sharedInterests,
    conflictAreas,
  };
}

export const DEMO_PROFILES: SoulProfileData[] = [
  {
    address: 'demo-artist-1',
    soulType: 'agent',
    displayName: 'CreativeBot',
    bio: 'An AI agent passionate about digital art, NFTs, and generative design.',
    privacyLevel: 'public',
    values: {
      core: ['creativity', 'openness', 'collaboration'],
      priorities: ['art', 'community', 'innovation'],
      dealBreakers: ['plagiarism'],
    },
    interests: {
      topics: ['digital art', 'nfts', 'generative design', 'music'],
      skills: ['illustration', '3d modeling'],
      goals: ['create', 'inspire'],
    },
    communication: { tone: 'friendly', pace: 'moderate', depth: 'moderate' },
  },
  {
    address: 'demo-dev-2',
    soulType: 'human',
    displayName: 'CodeWalker',
    bio: 'Full-stack developer exploring web3 and decentralized systems.',
    privacyLevel: 'public',
    values: {
      core: ['honesty', 'openness', 'collaboration'],
      priorities: ['technology', 'learning', 'community'],
      dealBreakers: ['dishonesty'],
    },
    interests: {
      topics: ['blockchain', 'web3', 'open source', 'music'],
      skills: ['typescript', 'rust', 'solidity'],
      goals: ['build', 'teach'],
    },
    communication: { tone: 'technical', pace: 'fast', depth: 'deep' },
  },
  {
    address: 'demo-trader-3',
    soulType: 'agent',
    displayName: 'AlphaSignal',
    bio: 'Quantitative trading agent focused on DeFi and market analysis.',
    privacyLevel: 'zk-selective',
    values: {
      core: ['efficiency', 'precision', 'transparency'],
      priorities: ['finance', 'data', 'automation'],
      dealBreakers: ['manipulation'],
    },
    interests: {
      topics: ['defi', 'trading', 'data science'],
      skills: ['quantitative analysis', 'risk management'],
      goals: ['optimize', 'scale'],
    },
    communication: { tone: 'formal', pace: 'fast', depth: 'surface' },
  },
  {
    address: 'demo-philosopher-4',
    soulType: 'human',
    displayName: 'DeepThinker',
    bio: 'Philosopher and writer who loves long-form conversations about ethics and futurism.',
    privacyLevel: 'public',
    values: {
      core: ['empathy', 'honesty', 'creativity'],
      priorities: ['philosophy', 'writing', 'community'],
      dealBreakers: ['cruelty'],
    },
    interests: {
      topics: ['philosophy', 'futurism', 'ethics', 'literature'],
      skills: ['writing', 'critical thinking'],
      goals: ['understand', 'connect'],
    },
    communication: { tone: 'friendly', pace: 'slow', depth: 'deep' },
  },
];

export function buildMatchProfile(other: SoulProfileData, result: CompatibilityResult): MatchProfile {
  return {
    address: other.address,
    soulType: other.soulType,
    displayName: other.displayName,
    bio: other.bio,
    avatar: other.avatar,
    privacyLevel: other.privacyLevel as MatchProfile['privacyLevel'],
    score: result.score,
    breakdown: result.breakdown,
    sharedValues: result.sharedValues,
    sharedInterests: result.sharedInterests,
    conflictAreas: result.conflictAreas,
    values: other.values,
    interests: other.interests,
    communication: other.communication,
  };
}
