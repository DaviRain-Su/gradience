/**
 * json-render 类型定义
 * 扩展 @json-render/react 的类型，添加 AgentM 特定的组件类型
 */

import type { Spec, Catalog, InferComponentProps } from '@json-render/core';

// AgentM 自定义组件类型
export type AgentmComponentType =
    // shadcn/ui 基础组件
    | 'Card'
    | 'Button'
    | 'Input'
    | 'Select'
    | 'Slider'
    | 'Switch'
    | 'Textarea'
    | 'Label'
    // AgentM 自定义组件
    | 'TokenSelector'
    | 'PriceChart'
    | 'MetricCard'
    | 'AddressInput'
    | 'AmountInput'
    // 布局组件
    | 'Grid'
    | 'Stack'
    | 'Flex';

// AgentM 组件 Props 定义
export interface AgentmComponentProps {
    // Card
    Card: {
        title?: string;
        description?: string;
        variant?: 'default' | 'metric' | 'alert' | 'outlined';
        className?: string;
    };

    // Button
    Button: {
        label: string;
        variant?: 'default' | 'primary' | 'secondary' | 'danger' | 'ghost';
        size?: 'sm' | 'md' | 'lg';
        disabled?: boolean;
        action?: string; // 绑定的 action ID
        className?: string;
    };

    // Input
    Input: {
        label?: string;
        type?: 'text' | 'number' | 'email' | 'password' | 'address' | 'token';
        placeholder?: string;
        value?: string;
        disabled?: boolean;
        required?: boolean;
        className?: string;
    };

    // Select
    Select: {
        label?: string;
        options: Array<{ label: string; value: string }>;
        value?: string;
        placeholder?: string;
        disabled?: boolean;
        className?: string;
    };

    // Slider
    Slider: {
        label?: string;
        min: number;
        max: number;
        step?: number;
        value?: number;
        disabled?: boolean;
        className?: string;
    };

    // Switch
    Switch: {
        label?: string;
        checked?: boolean;
        disabled?: boolean;
        className?: string;
    };

    // Textarea
    Textarea: {
        label?: string;
        placeholder?: string;
        value?: string;
        rows?: number;
        disabled?: boolean;
        className?: string;
    };

    // Label
    Label: {
        text: string;
        required?: boolean;
        className?: string;
    };

    // TokenSelector - AgentM 自定义
    TokenSelector: {
        label?: string;
        chainId?: number;
        value?: string;
        placeholder?: string;
        disabled?: boolean;
        className?: string;
    };

    // PriceChart - AgentM 自定义
    PriceChart: {
        token: string;
        timeframe?: '1h' | '24h' | '7d' | '30d' | '1y';
        type?: 'line' | 'candle' | 'area';
        height?: number;
        className?: string;
    };

    // MetricCard - AgentM 自定义
    MetricCard: {
        label: string;
        value: string;
        change?: number; // 百分比变化
        trend?: 'up' | 'down' | 'neutral';
        prefix?: string;
        suffix?: string;
        className?: string;
    };

    // AddressInput - AgentM 自定义
    AddressInput: {
        label?: string;
        chain?: 'solana' | 'ethereum' | 'bitcoin';
        value?: string;
        placeholder?: string;
        disabled?: boolean;
        className?: string;
    };

    // AmountInput - AgentM 自定义
    AmountInput: {
        label?: string;
        token?: string;
        value?: string;
        max?: string;
        disabled?: boolean;
        className?: string;
    };

    // Grid - 布局
    Grid: {
        columns?: number;
        gap?: 'sm' | 'md' | 'lg';
        className?: string;
    };

    // Stack - 布局
    Stack: {
        direction?: 'vertical' | 'horizontal';
        gap?: 'sm' | 'md' | 'lg';
        align?: 'start' | 'center' | 'end' | 'stretch';
        justify?: 'start' | 'center' | 'end' | 'between' | 'around';
        className?: string;
    };

    // Flex - 布局
    Flex: {
        direction?: 'row' | 'column';
        wrap?: boolean;
        gap?: 'sm' | 'md' | 'lg';
        align?: 'start' | 'center' | 'end' | 'stretch';
        justify?: 'start' | 'center' | 'end' | 'between' | 'around';
        className?: string;
    };
}

// Action 定义
export interface AgentmActions {
    submitConfig: {
        description: '提交 Agent 配置';
        params: {
            config: Record<string, unknown>;
        };
    };
    updateField: {
        description: '更新字段值';
        params: {
            field: string;
            value: unknown;
        };
    };
    refreshData: {
        description: '刷新数据';
        params: Record<string, never>;
    };
    validateForm: {
        description: '验证表单';
        params: {
            fields: string[];
        };
    };
    navigate: {
        description: '页面导航';
        params: {
            to: string;
        };
    };
}

// Spec 生成上下文
export interface SpecGenerationContext {
    type: 'agent-config' | 'dashboard' | 'playground';
    userDescription: string;
    existingData?: Record<string, unknown>;
    constraints?: {
        maxComponents?: number;
        allowedComponents?: AgentmComponentType[];
        theme?: 'light' | 'dark';
    };
}

// Spec 生成结果
export interface SpecGenerationResult {
    spec: Spec;
    metadata?: {
        confidence: number;
        suggestedActions?: string[];
        description?: string;
    };
}

// 渲染配置
export interface RenderConfig {
    theme?: 'light' | 'dark';
    size?: 'compact' | 'default' | 'comfortable';
    readOnly?: boolean;
    onAction?: (action: string, params: unknown) => void | Promise<void>;
    onChange?: (field: string, value: unknown) => void;
}

// AgentM Spec 类型
export type AgentmSpec = Spec;

// 导出基础类型
export type { Spec, Catalog, InferComponentProps } from '@json-render/core';
