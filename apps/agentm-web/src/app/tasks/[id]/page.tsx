import TaskDetailPageClient from './TaskDetailPageClient';

// Required for static export of dynamic routes
export function generateStaticParams() {
    return [{ id: '1' }, { id: '2' }, { id: '3' }];
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: PageProps) {
    const { id } = await params;
    const taskId = Number(id);
    return <TaskDetailPageClient taskId={taskId} />;
}
