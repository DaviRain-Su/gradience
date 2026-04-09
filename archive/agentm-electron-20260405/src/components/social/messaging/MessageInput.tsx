/**
 * MessageInput Component
 *
 * Input field for composing and sending messages to agents.
 * Supports text input, sending with Enter, and payment integration.
 *
 * @module components/social/messaging/MessageInput
 */

import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '../../../renderer/hooks/useAppStore.ts';

export interface MessageInputProps {
    /** Recipient peer address */
    peerAddress: string;
    /** Optional callback when message is sent */
    onSend?: (message: string, paymentMicrolamports: number) => void;
    /** Optional default payment amount in microlamports */
    defaultPayment?: number;
    /** Placeholder text */
    placeholder?: string;
    /** Disable input */
    disabled?: boolean;
}

/**
 * MessageInput - Composable message input with payment support
 */
export function MessageInput({
    peerAddress,
    onSend,
    defaultPayment = 0,
    placeholder = 'Type a message...',
    disabled = false,
}: MessageInputProps) {
    const [message, setMessage] = useState('');
    const [paymentMicrolamports, setPaymentMicrolamports] = useState(defaultPayment);
    const [isSending, setIsSending] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const addMessage = useAppStore((s) => s.addMessage);

    // Auto-resize textarea
    const adjustTextareaHeight = useCallback(() => {
        const textarea = inputRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
        }
    }, []);

    const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        adjustTextareaHeight();
    };

    const handleSend = () => {
        const trimmed = message.trim();
        if (!trimmed || isSending || disabled) return;

        setIsSending(true);

        try {
            // Create and add message to store
            const newMessage = {
                id: crypto.randomUUID(),
                peerAddress,
                direction: 'outgoing' as const,
                topic: 'direct_message',
                message: trimmed,
                paymentMicrolamports,
                status: 'sent' as const,
                createdAt: Date.now(),
            };

            addMessage(newMessage);

            onSend?.(trimmed, paymentMicrolamports);

            // Reset input
            setMessage('');
            setPaymentMicrolamports(defaultPayment);
            setShowPayment(false);

            // Reset textarea height
            if (inputRef.current) {
                inputRef.current.style.height = 'auto';
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
    };

    const handlePaymentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        if (!isNaN(value) && value >= 0) {
            setPaymentMicrolamports(Math.floor(value * 1e6)); // Convert SOL to microlamports
        }
    };

    const hasContent = message.trim().length > 0;

    return (
        <div className="border-t border-gray-800 bg-gray-900 p-3">
            {/* Payment controls */}
            {showPayment && (
                <div className="mb-3 flex items-center gap-3 bg-gray-800/50 rounded-lg p-2">
                    <span className="text-xs text-gray-400">Payment:</span>
                    <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={paymentMicrolamports / 1e6}
                        onChange={handlePaymentChange}
                        className="w-24 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                        placeholder="SOL"
                    />
                    <span className="text-xs text-gray-500">SOL</span>
                    <button
                        onClick={() => setShowPayment(false)}
                        className="ml-auto text-xs text-gray-500 hover:text-gray-300"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Input row */}
            <div className="flex items-end gap-2">
                {/* Payment toggle */}
                <button
                    onClick={() => setShowPayment(!showPayment)}
                    className={`p-2 rounded-lg transition flex-shrink-0 ${
                        showPayment || paymentMicrolamports > 0
                            ? 'bg-blue-600/20 text-blue-400'
                            : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                    }`}
                    title="Attach payment"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </button>

                {/* Text input */}
                <div className="flex-1 relative">
                    <textarea
                        ref={inputRef}
                        value={message}
                        onChange={handleMessageChange}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={disabled || isSending}
                        rows={1}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none disabled:opacity-50"
                        style={{ minHeight: '40px', maxHeight: '120px' }}
                    />
                </div>

                {/* Send button */}
                <button
                    onClick={() => void handleSend()}
                    disabled={!hasContent || isSending || disabled}
                    className={`p-2.5 rounded-xl transition flex-shrink-0 ${
                        hasContent && !isSending
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    {isSending ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                        </svg>
                    )}
                </button>
            </div>

            {/* Hint */}
            <p className="text-xs text-gray-600 mt-1.5 ml-1">Press Enter to send, Shift+Enter for new line</p>
        </div>
    );
}

export default MessageInput;
