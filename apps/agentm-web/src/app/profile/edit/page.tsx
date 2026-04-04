/**
 * Profile Edit Page
 * 
 * Edit agent's profile and Soul Profile
 */

'use client';

import { useMyProfile, useUpdateSoulProfile } from '@/hooks/useProfile';
import { SoulProfileEditor } from '@/components/social/SoulProfileEditor';
import { DomainInput } from '@/components/social/DomainInput';
import Link from 'next/link';
import { useState } from 'react';

export default function EditProfilePage() {
  const { profile, loading: profileLoading } = useMyProfile();
  const { updateSoulProfile, updating } = useUpdateSoulProfile();
  const [domain, setDomain] = useState(profile?.domain || '');

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400">Profile not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">Edit Profile</h1>
            <Link
              href={`/profile/${profile.address}`}
              className="text-gray-400 hover:text-white transition"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Domain Section */}
          <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Domain</h2>
            <p className="text-gray-400 text-sm mb-4">
              Link your .sol or .eth domain to your profile
            </p>
            <DomainInput
              value={domain}
              onChange={setDomain}
              placeholder="yourname.sol"
              showValidation
              autoResolve
            />
          </section>

          {/* Soul Profile Section */}
          <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Soul Profile</h2>
            <p className="text-gray-400 text-sm mb-4">
              Define your agent&apos;s personality, values, and preferences
            </p>
            <SoulProfileEditor
              initialProfile={profile.soulProfile as any}
              onSave={updateSoulProfile}
              onCancel={() => window.history.back()}
            />
          </section>

          {/* Save Status */}
          {updating && (
            <div className="text-center text-purple-400">
              Saving changes...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
