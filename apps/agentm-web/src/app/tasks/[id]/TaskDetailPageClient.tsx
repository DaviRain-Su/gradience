'use client';

import { useRouter } from 'next/navigation';
import { TaskDetailView } from '@/components/task/TaskDetailView';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';

const c = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
};

const styles = {
    container: {
        minHeight: '100vh',
        background: c.bg,
        padding: '24px',
    },
    content: {
        maxWidth: '900px',
        margin: '0 auto',
    },
};

interface Props {
    taskId: number;
}

export default function TaskDetailPageClient({ taskId }: Props) {
    const router = useRouter();
    const { walletAddress } = useDaemonConnection();

    if (Number.isNaN(taskId)) {
        return (
            <div style={styles.container}>
                <div style={styles.content}>
                    <div
                        style={{
                            padding: '40px',
                            textAlign: 'center',
                            background: c.surface,
                            borderRadius: '16px',
                            border: `1.5px solid ${c.ink}`,
                        }}
                    >
                        Invalid task ID
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.content}>
                <TaskDetailView taskId={taskId} walletAddress={walletAddress} onBack={() => router.push('/tasks')} />
            </div>
        </div>
    );
}
