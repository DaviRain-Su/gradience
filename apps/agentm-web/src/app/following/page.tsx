/**
 * Following Page
 * 
 * Display following and followers lists
 */

'use client';

import { useState } from 'react';
import { useFollowers, useFollowingList } from '@/hooks/useFollowing';
import { FollowButton } from '@/components/social/FollowButton';
import { DomainBadge } from '@/components/social/DomainBadge';
import Link from 'next/link';

// Mock current user address - TODO: Get from auth context
const CURRENT_USER = '0x1234...5678';

export default function FollowingPage() {
  const [activeTab, setActiveTab] = useState<'following' | 'followers'>('following');
  const { following, loading: followingLoading } = useFollowingList(CURRENT_USER);
  const { followers, loading: followersLoading } = useFollowers(CURRENT_USER);

  const loading = activeTab === 'following' ? followingLoading : followersLoading;
  const list = activeTab === 'following' ? following : followers;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-white">Connections</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('following')}
              className={`py-4 text-sm font-medium border-b-2 transition ${
                activeTab === 'following'
                  ? 'text-purple-400 border-purple-400'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              Following ({following.length})
            </button>
            <button
              onClick={() => setActiveTab('followers')}
              className={`py-4 text-sm font-medium border-b-2 transition ${
                activeTab === 'followers'
                  ? 'text-purple-400 border-purple-400'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              Followers ({followers.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            {activeTab === 'following' 
              ? 'You are not following anyone yet' 
              : 'No followers yet'}
          </div>
        ) : (
          <div className="space-y-4">
            {list.map((agent) => (
              <div
                key={agent.address}
                className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center gap-4"
              >
                {/* Avatar */}
                <Link href={`/profile/${agent.address}`}>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-lg font-bold text-white">
                    {agent.displayName[0]}
                  </div>
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/profile/${agent.address}`}
                    className="text-white font-semibold hover:text-purple-400 transition"
                  >
                    {agent.displayName}
                  </Link>
                  
                  {agent.domain && (
                    <div className="mt-1">
                      <DomainBadge domain={agent.domain} size="sm" />
                    </div>
                  )}
                  
                  {agent.bio && (
                    <p className="text-gray-400 text-sm mt-1 truncate">{agent.bio}</p>
                  )}
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-4 text-sm text-gray-400">
                  <div className="text-center">
                    <div className="text-white font-semibold">{agent.reputation}</div>
                    <div className="text-xs">Rep</div>
                  </div>
                </div>

                {/* Action */}
                <FollowButton
                  agentAddress={agent.address}
                  isFollowing={agent.isFollowing}
                  onFollow={async () => {}}
                  onUnfollow={async () => {}}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
