/**
 * json-render 主入口
 * 导出所有 json-render 相关模块
 */

// 类型
export type {
  AgentmComponentType,
  AgentmComponentProps,
  AgentmActions,
  SpecGenerationContext,
  SpecGenerationResult,
  RenderConfig,
  AgentmSpec,
} from "./types";

// 组件库和注册表
export {
  agentmCatalog,
  componentTypeList,
  actionTypeList,
  getComponentDescription,
  getComponentSchema,
  validateAgentmSpec,
} from "./catalog";

export {
  agentmRegistry,
  componentMap,
} from "./registry";

// 工具函数
export {
  jsonRenderUtils,
  generateCatalogDescription,
  generateSpecTemplate,
  generateExampleSpec,
  extractFieldsFromSpec,
  getSpecSummary,
  createRenderContext,
} from "./utils";

// 导出渲染组件
export {
  JsonRender,
  JsonRenderSkeleton,
  JsonRenderError,
} from "./JsonRender";

// 导出智能配置组件
export {
  SmartConfig,
} from "./SmartConfig";

// 导出基础类型
export type { Spec } from "@json-render/core";

// 版本信息
export const VERSION = "0.1.0";
