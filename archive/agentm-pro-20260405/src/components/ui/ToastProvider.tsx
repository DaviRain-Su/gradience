'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastMessage {
    id: string;
    tone: ToastTone;
    text: string;
}

interface ToastContextValue {
    pushToast: (tone: ToastTone, text: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [messages, setMessages] = useState<ToastMessage[]>([]);

    const pushToast = useCallback((tone: ToastTone, text: string) => {
        const id = crypto.randomUUID();
        setMessages((prev) => [...prev, { id, tone, text }]);
        setTimeout(() => {
            setMessages((prev) => prev.filter((item) => item.id !== id));
        }, 3500);
    }, []);

    const value = useMemo<ToastContextValue>(() => ({ pushToast }), [pushToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div
                data-testid="toast-container"
                className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
            >
                {messages.map((message) => (
                    <div
                        key={message.id}
                        data-testid="toast-message"
                        data-tone={message.tone}
                        className={`min-w-60 max-w-80 px-3 py-2 rounded-lg border text-sm shadow-lg pointer-events-auto ${
                            message.tone === 'success'
                                ? 'bg-emerald-950 border-emerald-700 text-emerald-200'
                                : message.tone === 'error'
                                  ? 'bg-red-950 border-red-700 text-red-200'
                                  : 'bg-gray-900 border-gray-700 text-gray-200'
                        }`}
                    >
                        {message.text}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return {
        info: (text: string) => context.pushToast('info', text),
        success: (text: string) => context.pushToast('success', text),
        error: (text: string) => context.pushToast('error', text),
    };
}
