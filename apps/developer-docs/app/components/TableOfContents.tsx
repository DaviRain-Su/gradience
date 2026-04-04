'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface Heading {
    id: string;
    text: string;
    level: number;
}

export function TableOfContents() {
    const [headings, setHeadings] = useState<Heading[]>([]);
    const [activeId, setActiveId] = useState('');
    const pathname = usePathname();

    useEffect(() => {
        const main = document.querySelector('main');
        if (!main) return;

        const els = main.querySelectorAll('h2, h3');
        const items: Heading[] = [];
        els.forEach((el) => {
            if (!el.id) {
                el.id = el.textContent?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') ?? '';
            }
            items.push({
                id: el.id,
                text: el.textContent ?? '',
                level: el.tagName === 'H2' ? 2 : 3,
            });
        });
        setHeadings(items);
    }, [pathname]);

    useEffect(() => {
        if (headings.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id);
                        break;
                    }
                }
            },
            { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
        );

        headings.forEach(({ id }) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [headings]);

    if (headings.length === 0) return null;

    return (
        <aside className="hidden xl:block w-56 shrink-0 fixed right-0 top-16 bottom-0 overflow-y-auto p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                On this page
            </p>
            <ul className="space-y-1">
                {headings.map((h) => (
                    <li key={h.id}>
                        <a
                            href={`#${h.id}`}
                            className={`block text-xs py-1 transition-colors ${
                                h.level === 3 ? 'pl-3' : ''
                            } ${
                                activeId === h.id
                                    ? 'text-indigo-400'
                                    : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {h.text}
                        </a>
                    </li>
                ))}
            </ul>
        </aside>
    );
}
