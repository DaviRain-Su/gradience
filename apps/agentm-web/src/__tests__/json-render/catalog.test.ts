/**
 * Catalog 单元测试
 */

import { describe, it, expect } from "vitest";
import {
  agentmCatalog,
  componentTypeList,
  actionTypeList,
  getComponentDescription,
  getComponentSchema,
  validateAgentmSpec,
} from "@/components/json-render/catalog";

describe("AgentM Catalog", () => {
  describe("组件列表", () => {
    it("应该包含所有基础组件", () => {
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
      for (const component of basicComponents) {
        expect(componentTypeList).toContain(component);
      }
    });

    it("应该包含所有自定义组件", () => {
      const customComponents = [
        "TokenSelector",
        "PriceChart",
        "MetricCard",
        "AddressInput",
        "AmountInput",
      ];
      for (const component of customComponents) {
        expect(componentTypeList).toContain(component);
      }
    });

    it("应该包含所有布局组件", () => {
      const layoutComponents = ["Grid", "Stack", "Flex"];
      for (const component of layoutComponents) {
        expect(componentTypeList).toContain(component);
      }
    });
  });

  describe("Action 列表", () => {
    it("应该包含所有 actions", () => {
      const expectedActions = [
        "submitConfig",
        "updateField",
        "refreshData",
        "validateForm",
        "navigate",
      ];
      for (const action of expectedActions) {
        expect(actionTypeList).toContain(action);
      }
    });
  });

  describe("getComponentDescription", () => {
    it("应该返回组件描述", () => {
      const desc = getComponentDescription("Card");
      expect(desc).toBeTruthy();
      expect(typeof desc).toBe("string");
    });

    it("未知组件应该返回空字符串", () => {
      const desc = getComponentDescription("UnknownComponent" as any);
      expect(desc).toBe("");
    });
  });

  describe("getComponentSchema", () => {
    it("应该返回组件 schema", () => {
      const schema = getComponentSchema("Button");
      expect(schema).toBeDefined();
    });

    it("未知组件应该返回 undefined", () => {
      const schema = getComponentSchema("UnknownComponent" as any);
      expect(schema).toBeUndefined();
    });
  });

  describe("validateAgentmSpec", () => {
    it("应该验证有效的 Spec", () => {
      const validSpec = {
        root: "main",
        elements: {
          main: {
            type: "Card",
            props: { title: "Test" },
            children: ["button"],
          },
          button: {
            type: "Button",
            props: { label: "Click me" },
          },
        },
      };
      const result = validateAgentmSpec(validSpec);
      expect(result.valid).toBe(true);
    });

    it("应该拒绝无效的 Spec (缺少 root)", () => {
      const invalidSpec = {
        elements: {},
      };
      const result = validateAgentmSpec(invalidSpec);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain("Spec must have a 'root' string property");
      }
    });

    it("应该拒绝无效的 Spec (root 不存在)", () => {
      const invalidSpec = {
        root: "nonexistent",
        elements: {},
      };
      const result = validateAgentmSpec(invalidSpec);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors[0]).toContain("Root element 'nonexistent' not found");
      }
    });

    it("应该拒绝无效的组件类型", () => {
      const invalidSpec = {
        root: "main",
        elements: {
          main: {
            type: "UnknownComponent",
            props: {},
          },
        },
      };
      const result = validateAgentmSpec(invalidSpec);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors[0]).toContain("unknown type");
      }
    });

    it("应该拒绝非对象 Spec", () => {
      const result = validateAgentmSpec(null);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain("Spec must be an object");
      }
    });
  });
});
