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

/**
 * Agent 创建页面
 * 支持传统表单模式和智能配置模式
 */
export default function CreateAgentPage() {
  const [mode, setMode] = useState<"traditional" | "smart">("smart");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 传统表单状态
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "monitor",
    chain: "solana",
    enabled: true,
  });

  // 处理传统表单提交
  const handleTraditionalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // TODO: 调用后端 API 创建 Agent
      console.log("Creating agent:", formData);
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert("Agent 创建成功!");
    } catch (error) {
      console.error("Failed to create agent:", error);
      alert("创建失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理智能配置完成
  const handleSmartComplete = async (config: Record<string, unknown>) => {
    setIsSubmitting(true);
    
    try {
      // TODO: 调用后端 API 创建 Agent
      console.log("Creating agent from smart config:", config);
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert("Agent 创建成功!");
    } catch (error) {
      console.error("Failed to create agent:", error);
      alert("创建失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* 头部导航 */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/agents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">创建 Agent</h1>
      </div>

      {/* 模式切换 */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={mode === "smart" ? "default" : "outline"}
          onClick={() => setMode("smart")}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          智能配置
        </Button>
        <Button
          variant={mode === "traditional" ? "default" : "outline"}
          onClick={() => setMode("traditional")}
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          传统配置
        </Button>
      </div>

      {/* 智能配置模式 */}
      {mode === "smart" && (
        <Card>
          <CardHeader>
            <CardTitle>智能配置</CardTitle>
            <CardDescription>
              用自然语言描述你的 Agent 需求，AI 将自动生成配置界面
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SmartConfig
              onComplete={handleSmartComplete}
              onCancel={() => setMode("traditional")}
            />
          </CardContent>
        </Card>
      )}

      {/* 传统配置模式 */}
      {mode === "traditional" && (
        <Card>
          <CardHeader>
            <CardTitle>传统配置</CardTitle>
            <CardDescription>
              手动填写 Agent 配置信息
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTraditionalSubmit} className="space-y-6">
              {/* 基本信息 */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Agent 名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如：ETH 价格监控"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">描述</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="描述这个 Agent 的功能..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Agent 类型</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monitor">监控</SelectItem>
                        <SelectItem value="alert">提醒</SelectItem>
                        <SelectItem value="trade">交易</SelectItem>
                        <SelectItem value="custom">自定义</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>区块链</Label>
                    <Select
                      value={formData.chain}
                      onValueChange={(value) => setFormData({ ...formData, chain: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solana">Solana</SelectItem>
                        <SelectItem value="ethereum">Ethereum</SelectItem>
                        <SelectItem value="bitcoin">Bitcoin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                  <Label>立即启用</Label>
                </div>
              </div>

              {/* 提交按钮 */}
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "创建中..." : "创建 Agent"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setMode("smart")}>
                  切换到智能配置
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
