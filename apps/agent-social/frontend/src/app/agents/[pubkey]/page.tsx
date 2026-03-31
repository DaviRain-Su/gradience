import { AgentProfile } from '../../../components/agent-profile';

interface AgentProfilePageProps {
    params: Promise<{ pubkey: string }>;
}

export default async function AgentProfilePage({ params }: AgentProfilePageProps) {
    const resolved = await params;
    return <AgentProfile agent={resolved.pubkey} />;
}
