/**
 * SmartConfig 组件
 * Agent 智能配置界面 - 自然语言生成配置表单
 */

"use client";

import React, { useState, useCallback } from "react";
import { JsonRender, JsonRenderSkeleton, JsonRenderError } from "./JsonRender";
import { generateExampleSpec } from "./utils";
import type { Spec } from "@json-render/core";

interface SmartConfigProps {
  /** 初始提示词 */
  initialPrompt?: string;
  /** 配置完成回调 */
  onComplete?: (config: Record<string, unknown>) => void;
  /** 取消回调 */
  onCancel?: () => void;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * SmartConfig 组件
 * 使用自然语言生成 Agent 配置界面
 */
export function SmartConfig({
  initialPrompt = "",
  onComplete,
  onCancel,
  className = "",
}: SmartConfigProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [mode, setMode] = useState<"input" | "preview">("input");

  // 生成 Spec
  const generateSpec = useCallback(async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/generate-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          context: { type: "agent-config" },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setSpec(data.spec);
      setMode("preview");
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [prompt]);

  // 使用示例
  const loadExample = useCallback((example: "token-monitor" | "price-alert" | "simple-form") => {
    const examples: Record<string, string> = {
      "token-monitor": "创建一个代币价格监控 Agent，当 SOL 价格低于 100 USDC 时发送通知",
      "price-alert": "设置价格提醒，当 ETH 上涨超过 5% 时通知我",
      "simple-form": "创建一个简单的联系表单，包含姓名、邮箱和消息",
    };
    setPrompt(examples[example]);
  }, []);

  // 处理表单变化
  const handleFormChange = useCallback((field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // 提交配置
  const handleSubmit = useCallback(() => {
    onComplete?.(formData);
  }, [formData, onComplete]);

  // 返回输入模式
  const handleBack = useCallback(() => {
    setMode("input");
    setSpec(null);
    setFormData({});
  }, []);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 模式切换标签 */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setMode("input")}
          className={`px-4 py-2 font-medium ${
            mode === "input"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground"
          }`}
        >
          智能配置
        </button>
        <button
          onClick={() => setMode("preview")}
          disabled={!spec}
          className={`px-4 py-2 font-medium ${
            mode === "preview"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground"
          } ${!spec ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          预览配置
        </button>
      </div>

      {mode === "input" ? (
        <div className="space-y-4">
          {/* 提示词输入 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              描述你的 Agent 需求
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：创建一个监控 ETH 价格的 Agent，当价格低于 2000 美元时发送邮件通知..."
              className="w-full min-h-[120px] p-3 border rounded-md resize-y"
              disabled={loading}
            />
          </div>

          {/* 示例按钮 */}
          <div>
            <label className="block text-sm font-medium mb-2">快速示例</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => loadExample("token-monitor")}
                className="px-3 py-1 text-sm bg-muted rounded-full hover:bg-muted/80"
                disabled={loading}
              >
                代币监控
              </button>
              <button
                onClick={() => loadExample("price-alert")}
                className="px-3 py-1 text-sm bg-muted rounded-full hover:bg-muted/80"
                disabled={loading}
              >
                价格提醒
              </button>
              <button
                onClick={() => loadExample("simple-form")}
                className="px-3 py-1 text-sm bg-muted rounded-full hover:bg-muted/80"
                disabled={loading}
              >
                简单表单
              </button>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <button
              onClick={generateSpec}
              disabled={!prompt.trim() || loading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "生成中..." : "生成配置界面"}
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 border rounded-md hover:bg-muted"
              >
                取消
              </button>
            )}
          </div>

          {/* 加载状态 */}
          {loading && (
            <div className="p-4 border rounded-lg">
              <JsonRenderSkeleton />
            </div>
          )}

          {/* 错误状态 */}
          {error && (
            <JsonRenderError
              error={error}
              onRetry={generateSpec}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* 预览模式 */}
          {spec && (
            <>
              <div className="p-4 border rounded-lg bg-card">
                <JsonRender
                  spec={spec}
                  initialData={formData}
                  onChange={handleFormChange}
                />
              </div>

              {/* 表单数据预览 */}
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">配置数据</h4>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(formData, null, 2)}
                </pre>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  确认配置
                </button>
                <button
                  onClick={handleBack}
                  className="px-4 py-2 border rounded-md hover:bg-muted"
                >
                  返回修改
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default SmartConfig;
