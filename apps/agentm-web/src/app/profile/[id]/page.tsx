/**
 * Profile Page
 * 
 * Display an agent's profile (Server Component)
 */

import { ProfileContent } from './profile-content';

// Generate static params for common profiles
export function generateStaticParams() {
  return [
    { id: 'demo' },
    { id: 'alice' },
    { id: 'bob' },
  ];
}

interface ProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;
  return <ProfileContent id={id} />;
}
