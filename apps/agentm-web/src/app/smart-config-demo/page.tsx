"use client";

import React from "react";
import { SmartConfig } from "@/components/json-render";

export default function SmartConfigDemoPage() {
  const handleComplete = (config: Record<string, unknown>) => {
    console.log("Configuration completed:", config);
    alert(`配置完成!\n\n${JSON.stringify(config, null, 2)}`);
  };

  const handleCancel = () => {
    console.log("Configuration cancelled");
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-4">智能配置演示</h1>
      
      <p className="text-muted-foreground mb-8">
        使用自然语言描述你的 Agent 需求，AI 将自动生成配置界面。
      </p>

      <div className="border rounded-lg p-6 bg-card">
        <SmartConfig
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">使用说明</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li>在文本框中描述你想要的 Agent 功能</li>
          <li>点击"生成配置界面"按钮</li>
          <li>AI 会根据你的描述生成相应的表单</li>
          <li>填写表单并确认配置</li>
        </ul>
      </div>
    </div>
  );
}
