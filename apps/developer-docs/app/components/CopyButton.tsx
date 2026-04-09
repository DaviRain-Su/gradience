'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Copy code"
        >
            {copied ? (
                <>
                    <Check className="w-3.5 h-3.5 text-green-400" /> Copied!
                </>
            ) : (
                <>
                    <Copy className="w-3.5 h-3.5" /> Copy
                </>
            )}
        </button>
    );
}
