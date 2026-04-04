"use client";

import React, { useState } from "react";
import { JsonRender, JsonRenderSkeleton, JsonRenderError, generateExampleSpec } from "@/components/json-render";
import type { Spec } from "@json-render/core";

export default function JsonRenderDemoPage() {
  const [selectedExample, setSelectedExample] = useState<"token-monitor" | "price-alert" | "simple-form">("token-monitor");
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<Error | null>(null);

  const spec = generateExampleSpec(selectedExample);

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    console.log(`Field changed: ${field} =`, value);
  };

  const handleAction = async (action: string, params: unknown) => {
    console.log(`Action triggered: ${action}`, params);
    alert(`Action: ${action}\nParams: ${JSON.stringify(params, null, 2)}`);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">JsonRender 演示</h1>

      {/* 示例选择器 */}
      <div className="mb-8">
        <label className="block text-sm font-medium mb-2">选择示例:</label>
        <div className="flex gap-2">
          {(["token-monitor", "price-alert", "simple-form"] as const).map((example) => (
            <button
              key={example}
              onClick={() => {
                setSelectedExample(example);
                setFormData({});
                setError(null);
              }}
              className={`px-4 py-2 rounded-md ${
                selectedExample === example
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {example === "token-monitor" && "代币监控"}
              {example === "price-alert" && "价格提醒"}
              {example === "simple-form" && "简单表单"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 渲染区域 */}
        <div>
          <h2 className="text-xl font-semibold mb-4">渲染结果</h2>
          <div className="border rounded-lg p-6 bg-card">
            {error ? (
              <JsonRenderError error={error} onRetry={() => setError(null)} />
            ) : (
              <JsonRender
                spec={spec}
                initialData={formData}
                onChange={handleChange}
                onAction={handleAction}
                onError={setError}
              />
            )}
          </div>
        </div>

        {/* 数据预览 */}
        <div>
          <h2 className="text-xl font-semibold mb-4">表单数据</h2>
          <div className="border rounded-lg p-4 bg-muted">
            <pre className="text-sm overflow-auto">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </div>

          <h2 className="text-xl font-semibold mt-8 mb-4">Spec 预览</h2>
          <div className="border rounded-lg p-4 bg-muted max-h-96 overflow-auto">
            <pre className="text-xs">
              {JSON.stringify(spec, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      {/* 说明 */}
      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">说明</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li>此页面演示 json-render 的基本功能</li>
          <li>选择不同示例查看不同的 UI 布局</li>
          <li>表单数据会实时显示在右侧</li>
          <li>点击按钮会触发 action 并显示 alert</li>
        </ul>
      </div>
    </div>
  );
}
