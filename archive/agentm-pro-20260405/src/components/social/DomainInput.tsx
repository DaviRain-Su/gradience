'use client';

import { useState } from 'react';

export function DomainInput({
    linkedDomain,
    onLink,
    onUnlink,
    linking = false,
    error,
}: {
    linkedDomain: string | null;
    onLink: (domain: string) => Promise<void> | void;
    onUnlink: () => void;
    linking?: boolean;
    error?: string | null;
}) {
    const [value, setValue] = useState(linkedDomain ?? '');

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <input
                    data-testid="domain-input"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder="alice.sol or name.eth"
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm"
                />
                <button
                    data-testid="domain-link-button"
                    onClick={async () => onLink(value)}
                    disabled={value.trim() === '' || linking}
                    className="px-3 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:bg-indigo-900 text-sm"
                >
                    {linking ? 'Checking...' : linkedDomain ? 'Update' : 'Link'}
                </button>
                {linkedDomain && (
                    <button
                        data-testid="domain-unlink-button"
                        onClick={() => {
                            setValue('');
                            onUnlink();
                        }}
                        className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm"
                    >
                        Unlink
                    </button>
                )}
            </div>
            <p className="text-xs text-gray-500">
                Need a domain? Register via{' '}
                <a
                    data-testid="domain-registration-cta"
                    href="https://sns.id/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300"
                >
                    SNS/ENS providers
                </a>
                .
            </p>
            {error && (
                <p data-testid="domain-link-error" className="text-xs text-red-400">
                    {error}
                </p>
            )}
        </div>
    );
}
