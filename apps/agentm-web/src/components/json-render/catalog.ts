/**
 * AgentM 组件库定义 (Catalog)
 * 定义所有可用组件及其 props schema，用于 AI Spec 生成
 */

import { z } from "zod";
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import type { AgentmComponentType } from "./types";

// 基础 Props Schema
const classNameSchema = z.string().optional();

// Card Schema
const cardSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  variant: z.enum(["default", "metric", "alert", "outlined"]).default("default"),
  className: classNameSchema,
});

// Button Schema
const buttonSchema = z.object({
  label: z.string(),
  variant: z.enum(["default", "primary", "secondary", "danger", "ghost"]).default("default"),
  size: z.enum(["sm", "md", "lg"]).default("md"),
  disabled: z.boolean().default(false),
  action: z.string().optional(),
  className: classNameSchema,
});

// Input Schema
const inputSchema = z.object({
  label: z.string().optional(),
  type: z.enum(["text", "number", "email", "password", "address", "token"]).default("text"),
  placeholder: z.string().optional(),
  value: z.string().optional(),
  disabled: z.boolean().default(false),
  required: z.boolean().default(false),
  className: classNameSchema,
});

// Select Schema
const selectSchema = z.object({
  label: z.string().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })),
  value: z.string().optional(),
  placeholder: z.string().optional(),
  disabled: z.boolean().default(false),
  className: classNameSchema,
});

// Slider Schema
const sliderSchema = z.object({
  label: z.string().optional(),
  min: z.number(),
  max: z.number(),
  step: z.number().default(1),
  value: z.number().optional(),
  disabled: z.boolean().default(false),
  className: classNameSchema,
});

// Switch Schema
const switchSchema = z.object({
  label: z.string().optional(),
  checked: z.boolean().default(false),
  disabled: z.boolean().default(false),
  className: classNameSchema,
});

// Textarea Schema
const textareaSchema = z.object({
  label: z.string().optional(),
  placeholder: z.string().optional(),
  value: z.string().optional(),
  rows: z.number().default(3),
  disabled: z.boolean().default(false),
  className: classNameSchema,
});

// Label Schema
const labelSchema = z.object({
  text: z.string(),
  required: z.boolean().default(false),
  className: classNameSchema,
});

// TokenSelector Schema
const tokenSelectorSchema = z.object({
  label: z.string().optional(),
  chainId: z.number().optional(),
  value: z.string().optional(),
  placeholder: z.string().optional(),
  disabled: z.boolean().default(false),
  className: classNameSchema,
});

// PriceChart Schema
const priceChartSchema = z.object({
  token: z.string(),
  timeframe: z.enum(["1h", "24h", "7d", "30d", "1y"]).default("24h"),
  type: z.enum(["line", "candle", "area"]).default("line"),
  height: z.number().default(300),
  className: classNameSchema,
});

// MetricCard Schema
const metricCardSchema = z.object({
  label: z.string(),
  value: z.string(),
  change: z.number().optional(),
  trend: z.enum(["up", "down", "neutral"]).optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  className: classNameSchema,
});

// AddressInput Schema
const addressInputSchema = z.object({
  label: z.string().optional(),
  chain: z.enum(["solana", "ethereum", "bitcoin"]).default("solana"),
  value: z.string().optional(),
  placeholder: z.string().optional(),
  disabled: z.boolean().default(false),
  className: classNameSchema,
});

// AmountInput Schema
const amountInputSchema = z.object({
  label: z.string().optional(),
  token: z.string().optional(),
  value: z.string().optional(),
  max: z.string().optional(),
  disabled: z.boolean().default(false),
  className: classNameSchema,
});

// Grid Schema
const gridSchema = z.object({
  columns: z.number().default(2),
  gap: z.enum(["sm", "md", "lg"]).default("md"),
  className: classNameSchema,
});

// Stack Schema
const stackSchema = z.object({
  direction: z.enum(["vertical", "horizontal"]).default("vertical"),
  gap: z.enum(["sm", "md", "lg"]).default("md"),
  align: z.enum(["start", "center", "end", "stretch"]).default("stretch"),
  justify: z.enum(["start", "center", "end", "between", "around"]).default("start"),
  className: classNameSchema,
});

// Flex Schema
const flexSchema = z.object({
  direction: z.enum(["row", "column"]).default("row"),
  wrap: z.boolean().default(false),
  gap: z.enum(["sm", "md", "lg"]).default("md"),
  align: z.enum(["start", "center", "end", "stretch"]).default("stretch"),
  justify: z.enum(["start", "center", "end", "between", "around"]).default("start"),
  className: classNameSchema,
});

// 创建 AgentM Catalog - 使用 any 绕过类型检查
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const agentmCatalog = (defineCatalog as any)(schema, {
  components: {
    Card: { props: cardSchema, description: "容器卡片组件，用于分组相关内容" },
    Button: { props: buttonSchema, description: "按钮组件，用于触发操作" },
    Input: { props: inputSchema, description: "输入框组件，支持多种输入类型" },
    Select: { props: selectSchema, description: "下拉选择组件" },
    Slider: { props: sliderSchema, description: "滑块组件，用于选择数值范围" },
    Switch: { props: switchSchema, description: "开关组件，用于布尔值选择" },
    Textarea: { props: textareaSchema, description: "多行文本输入组件" },
    Label: { props: labelSchema, description: "标签组件，用于表单字段标注" },
    TokenSelector: { props: tokenSelectorSchema, description: "代币选择器，支持按链筛选" },
    PriceChart: { props: priceChartSchema, description: "价格图表组件，显示代币价格走势" },
    MetricCard: { props: metricCardSchema, description: "指标卡片，显示关键数据指标" },
    AddressInput: { props: addressInputSchema, description: "区块链地址输入框，支持地址验证" },
    AmountInput: { props: amountInputSchema, description: "金额输入框，支持代币单位显示" },
    Grid: { props: gridSchema, description: "网格布局组件" },
    Stack: { props: stackSchema, description: "堆叠布局组件" },
    Flex: { props: flexSchema, description: "弹性布局组件" },
  },
  actions: {
    submitConfig: { description: "提交 Agent 配置", params: z.object({ config: z.record(z.string(), z.unknown(), "config") }, "submitConfig params") },
    updateField: { description: "更新字段值", params: z.object({ field: z.string(), value: z.unknown() }, "updateField params") },
    refreshData: { description: "刷新数据", params: z.object({}, "refreshData params") },
    validateForm: { description: "验证表单", params: z.object({ fields: z.array(z.string()) }, "validateForm params") },
    navigate: { description: "页面导航", params: z.object({ to: z.string() }, "navigate params") },
  },
});

// 导出组件类型列表
export const componentTypeList: AgentmComponentType[] = [
  "Card", "Button", "Input", "Select", "Slider", "Switch", "Textarea", "Label",
  "TokenSelector", "PriceChart", "MetricCard", "AddressInput", "AmountInput",
  "Grid", "Stack", "Flex",
];

// 导出 Action 类型列表
export const actionTypeList = ["submitConfig", "updateField", "refreshData", "validateForm", "navigate"] as const;

// 获取组件描述
export function getComponentDescription(type: AgentmComponentType): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const components = (agentmCatalog.data as any)?.components;
  return components?.[type]?.description || "";
}

// 获取组件 schema
export function getComponentSchema(type: AgentmComponentType) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const components = (agentmCatalog.data as any)?.components;
  return components?.[type]?.props;
}

// 验证 Spec
export function validateAgentmSpec(spec: unknown): { valid: true } | { valid: false; errors: string[] } {
  if (!spec || typeof spec !== "object") return { valid: false, errors: ["Spec must be an object"] };
  const s = spec as Record<string, unknown>;
  if (!s.root || typeof s.root !== "string") return { valid: false, errors: ["Spec must have a 'root' string property"] };
  if (!s.elements || typeof s.elements !== "object") return { valid: false, errors: ["Spec must have an 'elements' object property"] };
  const elements = s.elements as Record<string, unknown>;
  const errors: string[] = [];
  if (!elements[s.root]) errors.push(`Root element '${s.root}' not found in elements`);
  for (const [id, element] of Object.entries(elements)) {
    if (!element || typeof element !== "object") { errors.push(`Element '${id}' must be an object`); continue; }
    const el = element as Record<string, unknown>;
    if (!el.type || typeof el.type !== "string") { errors.push(`Element '${id}' must have a 'type' property`); continue; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const catalogComponents = (agentmCatalog.data as any)?.components;
    if (!catalogComponents?.[el.type]) errors.push(`Element '${id}' has unknown type '${el.type}'. Available types: ${componentTypeList.join(", ")}`);
    if (el.props !== undefined && typeof el.props !== "object") errors.push(`Element '${id}' props must be an object`);
    if (el.children !== undefined) {
      if (!Array.isArray(el.children)) errors.push(`Element '${id}' children must be an array`);
      else for (const child of el.children) { if (typeof child !== "string") { errors.push(`Element '${id}' children must be element IDs (strings)`); break; } if (!elements[child]) errors.push(`Element '${id}' references unknown child '${child}'`); }
    }
  }
  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}
