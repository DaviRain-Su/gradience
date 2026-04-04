import { ProfileForm } from '@/components/profile/ProfileForm';
import type { AgentProfile, ProfileDraft } from '@/types';

export function ProfileEditView({
    profile,
    submitting,
    onSubmit,
    onCancel,
}: {
    profile: AgentProfile;
    submitting: boolean;
    onSubmit: (draft: ProfileDraft) => Promise<void>;
    onCancel: () => void;
}) {
    return (
        <ProfileForm
            initialProfile={profile}
            submitting={submitting}
            onSubmit={onSubmit}
            onCancel={onCancel}
        />
    );
}
