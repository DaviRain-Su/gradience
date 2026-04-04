// Mock module for @gradiences/sdk
// This is a temporary mock to allow the build to succeed

export interface AgentConfig {
    name: string;
    capabilities: string[];
}

export class AgentSDK {
    constructor(config: AgentConfig) {}
    
    async connect(): Promise<boolean> {
        return true;
    }
    
    async disconnect(): Promise<void> {}
}

export function createAgent(config: AgentConfig): AgentSDK {
    return new AgentSDK(config);
}
