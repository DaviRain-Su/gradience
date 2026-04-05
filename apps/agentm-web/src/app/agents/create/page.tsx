"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { SmartConfig } from "@/components/json-render";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@gradiences/ui";
import { ArrowLeft, Sparkles, Settings } from "lucide-react";
import Link from "next/link";
import { useDaemonApi } from "@/lib/connection/ConnectionContext";

export default function CreateAgentPage() {
  const router = useRouter();
  const { apiCall, isConnected } = useDaemonApi();
  const [mode, setMode] = useState<"traditional" | "smart">("smart");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "monitor",
    chain: "solana",
    enabled: true,
  });

  const createAgent = async (agentData: Record<string, unknown>): Promise<{ success: boolean; agent: { id: string }; local?: boolean }> => {
    setError(null);
    
    if (!isConnected) {
      // Save to localStorage as fallback
      const localAgents = JSON.parse(localStorage.getItem('local_agents') || '[]');
      const newAgent = {
        id: `local_${Date.now()}`,
        ...agentData,
        createdAt: new Date().toISOString(),
      };
      localAgents.push(newAgent);
      localStorage.setItem('local_agents', JSON.stringify(localAgents));
      return { success: true, agent: newAgent, local: true };
    }

    // Call daemon API
    const result = await apiCall<{ success: boolean; agent: { id: string } }>('/api/v1/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentData),
    });

    if (!result?.success) {
      throw new Error('Failed to create agent');
    }

    return { ...result, local: false };
  };

  const handleTraditionalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Agent name is required');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const result = await createAgent(formData);
      if (result.local) {
        // Show notice that it's saved locally
        router.push('/app?view=me&notice=agent_created_locally');
      } else {
        router.push('/app?view=me&notice=agent_created');
      }
    } catch (err) {
      console.error("Failed to create agent:", err);
      setError(err instanceof Error ? err.message : 'Creation failed, please try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSmartComplete = async (config: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      const result = await createAgent({
        ...config,
        type: (config.type as string) || 'custom',
        chain: (config.chain as string) || 'solana',
        enabled: true,
      });
      if (result.local) {
        router.push('/app?view=me&notice=agent_created_locally');
      } else {
        router.push('/app?view=me&notice=agent_created');
      }
    } catch (err) {
      console.error("Failed to create agent:", err);
      setError(err instanceof Error ? err.message : 'Creation failed, please try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/agents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Create Agent</h1>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <Button variant={mode === "smart" ? "default" : "outline"} onClick={() => setMode("smart")} className="gap-2">
          <Sparkles className="h-4 w-4" /> Smart Config
        </Button>
        <Button variant={mode === "traditional" ? "default" : "outline"} onClick={() => setMode("traditional")} className="gap-2">
          <Settings className="h-4 w-4" /> Manual Config
        </Button>
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          ⚠️ Daemon not connected. Agent will be saved locally only.
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Smart Mode */}
      {mode === "smart" && (
        <Card>
          <CardHeader>
            <CardTitle>Smart Configuration</CardTitle>
            <CardDescription>Describe your agent requirements in natural language. AI will generate the config UI automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            <SmartConfig onComplete={handleSmartComplete} onCancel={() => setMode("traditional")} />
          </CardContent>
        </Card>
      )}

      {/* Traditional Mode */}
      {mode === "traditional" && (
        <Card>
          <CardHeader>
            <CardTitle>Manual Configuration</CardTitle>
            <CardDescription>Fill in the agent configuration manually.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTraditionalSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Agent Name *</Label>
                  <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. ETH Price Monitor" required />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Describe what this agent does..." rows={3} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Agent Type</Label>
                    <Select value={formData.type} onValueChange={(value) => value && setFormData({ ...formData, type: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monitor">Monitor</SelectItem>
                        <SelectItem value="alert">Alert</SelectItem>
                        <SelectItem value="trade">Trade</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Blockchain</Label>
                    <Select value={formData.chain} onValueChange={(value) => value && setFormData({ ...formData, chain: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solana">Solana</SelectItem>
                        <SelectItem value="ethereum">Ethereum</SelectItem>
                        <SelectItem value="bitcoin">Bitcoin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch checked={formData.enabled} onCheckedChange={checked => setFormData({ ...formData, enabled: checked })} />
                  <Label>Enable immediately</Label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Agent"}</Button>
                <Button type="button" variant="outline" onClick={() => setMode("smart")}>Switch to Smart Config</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
