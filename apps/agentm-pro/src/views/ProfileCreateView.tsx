import { ProfileForm } from '@/components/profile/ProfileForm';
import type { ProfileDraft } from '@/types';

export function ProfileCreateView({
    submitting,
    onSubmit,
    onCancel,
}: {
    submitting: boolean;
    onSubmit: (draft: ProfileDraft) => Promise<void>;
    onCancel: () => void;
}) {
    return (
        <ProfileForm
            initialProfile={null}
            submitting={submitting}
            onSubmit={onSubmit}
            onCancel={onCancel}
        />
    );
}
