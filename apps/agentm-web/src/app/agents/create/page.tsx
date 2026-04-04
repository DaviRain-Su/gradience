"use client";

import React, { useState } from "react";
import { SmartConfig } from "@/components/json-render";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Sparkles, Settings } from "lucide-react";
import Link from "next/link";

export default function CreateAgentPage() {
  const [mode, setMode] = useState<"traditional" | "smart">("smart");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "monitor",
    chain: "solana",
    enabled: true,
  });

  const handleTraditionalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      console.log("Creating agent:", formData);
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert("Agent created successfully!");
    } catch (error) {
      console.error("Failed to create agent:", error);
      alert("Creation failed, please try again");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSmartComplete = async (config: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      console.log("Creating agent from smart config:", config);
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert("Agent created successfully!");
    } catch (error) {
      console.error("Failed to create agent:", error);
      alert("Creation failed, please try again");
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
