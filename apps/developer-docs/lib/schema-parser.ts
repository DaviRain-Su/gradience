/**
 * Schema Parser for Agent consumption
 *
 * Parses MDX frontmatter and extracts agent-readable content
 * including code blocks, API specs, and structured data.
 */

export interface DocSchema {
    title: string;
    description: string;
    section: string;
    tags: string[];
    codeBlocks: CodeBlock[];
    apiEndpoints: ApiEndpointSchema[];
    instructions: InstructionSchema[];
}

export interface CodeBlock {
    language: string;
    code: string;
    label?: string;
}

export interface ApiEndpointSchema {
    method: string;
    path: string;
    description: string;
    params: Record<string, string>;
    responseType: string;
}

export interface InstructionSchema {
    name: string;
    discriminator: number;
    accounts: string[];
    dataFields: Record<string, string>;
}

export function parseFrontmatter(content: string): {
    metadata: Record<string, string>;
    body: string;
} {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        return { metadata: {}, body: content };
    }

    const metadata: Record<string, string> = {};
    for (const line of match[1].split('\n')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            const value = line.slice(colonIndex + 1).trim();
            metadata[key] = value;
        }
    }

    return { metadata, body: match[2] };
}

export function extractCodeBlocks(markdown: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(markdown)) !== null) {
        blocks.push({
            language: match[1] ?? 'text',
            code: match[2].trim(),
        });
    }

    return blocks;
}

export function extractApiEndpoints(markdown: string): ApiEndpointSchema[] {
    const endpoints: ApiEndpointSchema[] = [];
    const regex = /###\s+`(GET|POST|PUT|DELETE)\s+([^`]+)`\s*\n\s*(.*)/g;
    let match;

    while ((match = regex.exec(markdown)) !== null) {
        endpoints.push({
            method: match[1],
            path: match[2],
            description: match[3].trim(),
            params: {},
            responseType: 'unknown',
        });
    }

    return endpoints;
}

export function buildDocSchema(content: string): DocSchema {
    const { metadata, body } = parseFrontmatter(content);

    return {
        title: metadata.title ?? '',
        description: metadata.description ?? '',
        section: metadata.section ?? '',
        tags: (metadata.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
        codeBlocks: extractCodeBlocks(body),
        apiEndpoints: extractApiEndpoints(body),
        instructions: [],
    };
}
