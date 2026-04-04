/**
 * json-render 工具函数
 * 提供 Spec 生成、验证、转换等辅助功能
 */

import type { Spec } from "@json-render/core";
import type {
  AgentmComponentType,
  AgentmComponentProps,
  SpecGenerationContext,
  SpecGenerationResult,
  RenderConfig,
} from "./types";
import {
  agentmCatalog,
  componentTypeList,
  actionTypeList,
  validateAgentmSpec,
} from "./catalog";

// 生成 AI 提示词中使用的组件目录描述
export function generateCatalogDescription(): string {
  const lines: string[] = [];

  lines.push("## Available Components\n");

  // 基础组件
  lines.push("### Basic Components");
  const basicComponents = [
    "Card",
    "Button",
    "Input",
    "Select",
    "Slider",
    "Switch",
    "Textarea",
    "Label",
  ];
  const catalogData = agentmCatalog.data as {
    components?: Record<string, { description?: string }>;
    actions?: Record<string, { description?: string }>;
  };
  for (const type of basicComponents) {
    const component = catalogData?.components?.[type];
    if (component) {
      lines.push(`- **${type}**: ${component.description}`);
    }
  }

  // AgentM 自定义组件
  lines.push("\n### AgentM Custom Components");
  const customComponents = [
    "TokenSelector",
    "PriceChart",
    "MetricCard",
    "AddressInput",
    "AmountInput",
  ];
  for (const type of customComponents) {
    const component = catalogData?.components?.[type];
    if (component) {
      lines.push(`- **${type}**: ${component.description}`);
    }
  }

  // 布局组件
  lines.push("\n### Layout Components");
  const layoutComponents = ["Grid", "Stack", "Flex"];
  for (const type of layoutComponents) {
    const component = catalogData?.components?.[type];
    if (component) {
      lines.push(`- **${type}**: ${component.description}`);
    }
  }

  // Actions
  lines.push("\n## Available Actions");
  for (const [action, config] of Object.entries(catalogData?.actions || {})) {
    lines.push(`- **${action}**: ${config.description}`);
  }

  return lines.join("\n");
}

// 生成 Spec 模板
export function generateSpecTemplate(
  type: SpecGenerationContext["type"]
): Spec {
  const baseId = `root-${Date.now()}`;

  switch (type) {
    case "agent-config":
      return {
        root: baseId,
        elements: {
          [baseId]: {
            type: "Card",
            props: {
              title: "Agent Configuration",
              description: "Configure your agent settings",
            },
            children: [],
          },
        },
      };

    case "dashboard":
      return {
        root: baseId,
        elements: {
          [baseId]: {
            type: "Grid",
            props: { columns: 2, gap: "md" },
            children: [],
          },
        },
      };

    case "playground":
      return {
        root: baseId,
        elements: {
          [baseId]: {
            type: "Stack",
            props: { direction: "vertical", gap: "md" },
            children: [],
          },
        },
      };

    default:
      return {
        root: baseId,
        elements: {
          [baseId]: {
            type: "Card",
            props: { title: "Untitled" },
            children: [],
          },
        },
      };
  }
}

// 生成示例 Spec
export function generateExampleSpec(
  example: "token-monitor" | "price-alert" | "simple-form"
): Spec {
  switch (example) {
    case "token-monitor":
      return {
        root: "main-card",
        elements: {
          "main-card": {
            type: "Card",
            props: {
              title: "Token Monitor",
              description: "Monitor token price and receive alerts",
            },
            children: ["form-stack"],
          },
          "form-stack": {
            type: "Stack",
            props: { direction: "vertical", gap: "md" },
            children: ["token-selector", "price-chart", "alert-section"],
          },
          "token-selector": {
            type: "TokenSelector",
            props: {
              label: "Select Token",
              chainId: 101,
            },
          },
          "price-chart": {
            type: "PriceChart",
            props: {
              token: "SOL",
              timeframe: "24h",
              type: "line",
            },
          },
          "alert-section": {
            type: "Card",
            props: {
              title: "Alert Settings",
              variant: "outlined",
            },
            children: ["alert-inputs"],
          },
          "alert-inputs": {
            type: "Grid",
            props: { columns: 2, gap: "md" },
            children: ["price-input", "email-input"],
          },
          "price-input": {
            type: "Input",
            props: {
              label: "Alert Price",
              type: "number",
              placeholder: "Enter price threshold",
            },
          },
          "email-input": {
            type: "Input",
            props: {
              label: "Notification Email",
              type: "text",
              placeholder: "your@email.com",
            },
          },
        },
      };

    case "price-alert":
      return {
        root: "alert-card",
        elements: {
          "alert-card": {
            type: "Card",
            props: {
              title: "Price Alert",
              description: "Get notified when price reaches your target",
            },
            children: ["alert-form"],
          },
          "alert-form": {
            type: "Stack",
            props: { direction: "vertical", gap: "lg" },
            children: ["token-row", "condition-row", "action-row"],
          },
          "token-row": {
            type: "TokenSelector",
            props: {
              label: "Token to Monitor",
            },
          },
          "condition-row": {
            type: "Grid",
            props: { columns: 2, gap: "md" },
            children: ["condition-select", "target-price"],
          },
          "condition-select": {
            type: "Select",
            props: {
              label: "Condition",
              options: [
                { label: "Above", value: "above" },
                { label: "Below", value: "below" },
              ],
            },
          },
          "target-price": {
            type: "Input",
            props: {
              label: "Target Price (USD)",
              type: "number",
              placeholder: "0.00",
            },
          },
          "action-row": {
            type: "Flex",
            props: {
              direction: "row",
              gap: "md",
              justify: "end",
            },
            children: ["cancel-btn", "save-btn"],
          },
          "cancel-btn": {
            type: "Button",
            props: {
              label: "Cancel",
              variant: "ghost",
              action: "navigate",
            },
          },
          "save-btn": {
            type: "Button",
            props: {
              label: "Save Alert",
              variant: "primary",
              action: "submitConfig",
            },
          },
        },
      };

    case "simple-form":
      return {
        root: "form-card",
        elements: {
          "form-card": {
            type: "Card",
            props: {
              title: "Simple Form",
            },
            children: ["form-stack"],
          },
          "form-stack": {
            type: "Stack",
            props: { direction: "vertical", gap: "md" },
            children: ["name-input", "email-input", "message-textarea", "submit-btn"],
          },
          "name-input": {
            type: "Input",
            props: {
              label: "Name",
              type: "text",
              placeholder: "Enter your name",
              required: true,
            },
          },
          "email-input": {
            type: "Input",
            props: {
              label: "Email",
              type: "email",
              placeholder: "your@email.com",
              required: true,
            },
          },
          "message-textarea": {
            type: "Textarea",
            props: {
              label: "Message",
              placeholder: "Enter your message...",
              rows: 4,
            },
          },
          "submit-btn": {
            type: "Button",
            props: {
              label: "Submit",
              variant: "primary",
              action: "submitConfig",
            },
          },
        },
      };

    default:
      return generateSpecTemplate("agent-config");
  }
}

// 提取 Spec 中的所有字段
export function extractFieldsFromSpec(
  spec: Spec
): Array<{ id: string; type: AgentmComponentType; label?: string }> {
  const fields: Array<{ id: string; type: AgentmComponentType; label?: string }> = [];

  for (const [id, element] of Object.entries(spec.elements)) {
    // 只提取表单相关组件
    const formComponents: AgentmComponentType[] = [
      "Input",
      "Select",
      "Slider",
      "Switch",
      "Textarea",
      "TokenSelector",
      "AddressInput",
      "AmountInput",
    ];

    if (formComponents.includes(element.type as AgentmComponentType)) {
      const props = element.props as Record<string, unknown>;
      fields.push({
        id,
        type: element.type as AgentmComponentType,
        label: props?.label as string | undefined,
      });
    }
  }

  return fields;
}

// 获取 Spec 的摘要信息
export function getSpecSummary(spec: Spec): {
  totalElements: number;
  componentTypes: AgentmComponentType[];
  depth: number;
} {
  const componentTypes = new Set<AgentmComponentType>();

  for (const element of Object.values(spec.elements)) {
    componentTypes.add(element.type as AgentmComponentType);
  }

  // 计算树深度
  function calculateDepth(elementId: string, visited = new Set<string>()): number {
    if (visited.has(elementId)) return 0; // 防止循环
    visited.add(elementId);

    const element = spec.elements[elementId];
    if (!element?.children || element.children.length === 0) {
      return 1;
    }

    const childDepths = element.children.map((childId) =>
      calculateDepth(childId, new Set(visited))
    );
    return 1 + Math.max(...childDepths);
  }

  return {
    totalElements: Object.keys(spec.elements).length,
    componentTypes: Array.from(componentTypes),
    depth: calculateDepth(spec.root),
  };
}

// 创建渲染上下文
export function createRenderContext(
  config: RenderConfig = {}
): {
  theme: NonNullable<RenderConfig["theme"]>;
  size: NonNullable<RenderConfig["size"]>;
  readOnly: boolean;
} {
  return {
    theme: config.theme || "light",
    size: config.size || "default",
    readOnly: config.readOnly || false,
  };
}

// 导出所有工具
export const jsonRenderUtils = {
  generateCatalogDescription,
  generateSpecTemplate,
  generateExampleSpec,
  extractFieldsFromSpec,
  getSpecSummary,
  createRenderContext,
  validateSpec: validateAgentmSpec,
  componentTypeList,
  actionTypeList,
};

export default jsonRenderUtils;
