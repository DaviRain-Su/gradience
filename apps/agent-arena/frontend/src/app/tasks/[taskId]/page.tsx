import { TaskDetail } from '../../../components/task-detail';

interface TaskDetailPageProps {
    params: Promise<{ taskId: string }>;
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
    const resolved = await params;
    const taskId = Number(resolved.taskId);
    if (!Number.isInteger(taskId) || taskId < 0) {
        return (
            <main className="mx-auto max-w-3xl p-6">
                <h1 className="text-xl font-semibold">Invalid task id</h1>
            </main>
        );
    }
    return <TaskDetail taskId={taskId} />;
}
