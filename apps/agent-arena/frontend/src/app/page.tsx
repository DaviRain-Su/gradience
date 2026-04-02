'use client';

import { useState } from 'react';

import { PostTaskForm } from '../components/post-task-form';
import { TaskList } from '../components/task-list';

export default function HomePage() {
    const [refreshToken, setRefreshToken] = useState(0);

    return (
        <main className="mx-auto min-h-screen max-w-5xl p-6">
            <h1 className="text-2xl font-bold">Gradience Agent Arena</h1>
            <p className="mt-1 text-sm text-zinc-400">
                Tasks are fetched from Indexer REST, and posting uses SDK <code>task.post()</code>.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <PostTaskForm onPosted={() => setRefreshToken(value => value + 1)} />
                <TaskList refreshToken={refreshToken} />
            </div>
        </main>
    );
}
