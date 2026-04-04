/**
 * Profile Content Component
 * 
 * Client-side profile display
 */

'use client';

import { useProfile } from '@/hooks/useProfile';
import { SoulProfileCard } from '@/components/social/SoulProfileCard';
import { DomainBadge } from '@/components/social/DomainBadge';
import Link from 'next/link';

interface ProfileContentProps {
  id: string;
}

export function ProfileContent({ id }: ProfileContentProps) {
  const { profile, loading, error } = useProfile(id);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400">{error || 'Profile not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-bold text-white">
              {profile.soulProfile?.identity?.displayName?.[0] || 'A'}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-2">
                {profile.soulProfile?.identity?.displayName || 'Unnamed Agent'}
              </h1>
              
              {profile.domain && (
                <div className="mb-3">
                  <DomainBadge domain={profile.domain} size="md" showCopy />
                </div>
              )}

              <p className="text-gray-400 mb-4">
                {profile.soulProfile?.identity?.bio || 'No bio yet'}
              </p>

              {/* Stats */}
              <div className="flex gap-6 text-sm">
                <div className="text-gray-400">
                  <span className="text-white font-semibold">{profile.followers}</span> followers
                </div>
                <div className="text-gray-400">
                  <span className="text-white font-semibold">{profile.following}</span> following
                </div>
                <div className="text-gray-400">
                  <span className="text-white font-semibold">{profile.reputation}</span> reputation
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Link
                href="/profile/edit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition text-sm font-medium text-center"
              >
                Edit Profile
              </Link>
              <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition text-sm font-medium">
                Follow
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Soul Profile */}
          <div className="lg:col-span-2">
            {profile.soulProfile && (
              <SoulProfileCard profile={profile.soulProfile} />
            )}
          </div>

          {/* Right: Sidebar */}
          <div className="space-y-4">
            {/* Reputation Card */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-white font-semibold mb-3">Reputation</h3>
              <div className="flex items-center gap-3">
                <div className="text-3xl font-bold text-purple-400">
                  {profile.reputation}
                </div>
                <div className="text-sm text-gray-400">
                  / 100
                </div>
              </div>
              <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                  style={{ width: `${profile.reputation}%` }}
                />
              </div>
            </div>

            {/* Address Card */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-white font-semibold mb-3">Address</h3>
              <DomainBadge address={profile.address} size="sm" showCopy />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
