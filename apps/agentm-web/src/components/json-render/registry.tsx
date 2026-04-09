/**
 * AgentM 组件注册表 (Registry)
 * 将 json-render 的组件类型映射到实际的 React 组件实现
 */

'use client';

import React from 'react';
import { defineRegistry } from '@json-render/react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Button,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Slider,
    Switch,
    Textarea,
    Label,
} from '@gradiences/ui';
import { agentmCatalog } from './catalog';
import type { AgentmComponentType } from './types';

// 布局组件 - Grid
const Grid = (ctx: {
    children?: React.ReactNode;
    props: { columns?: number; gap?: 'sm' | 'md' | 'lg'; className?: string };
}) => {
    const {
        children,
        props: { columns = 2, gap = 'md', className },
    } = ctx;
    const gapClass = { sm: 'gap-2', md: 'gap-4', lg: 'gap-6' }[gap];
    return <div className={`grid grid-cols-${columns} ${gapClass} ${className || ''}`}>{children}</div>;
};

// 布局组件 - Stack
const Stack = (ctx: {
    children?: React.ReactNode;
    props: {
        direction?: 'vertical' | 'horizontal';
        gap?: 'sm' | 'md' | 'lg';
        align?: 'start' | 'center' | 'end' | 'stretch';
        justify?: 'start' | 'center' | 'end' | 'between' | 'around';
        className?: string;
    };
}) => {
    const {
        children,
        props: { direction = 'vertical', gap = 'md', align = 'stretch', justify = 'start', className },
    } = ctx;
    const gapClass = { sm: 'gap-2', md: 'gap-4', lg: 'gap-6' }[gap];
    const alignClass = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' }[
        align
    ];
    const justifyClass = {
        start: 'justify-start',
        center: 'justify-center',
        end: 'justify-end',
        between: 'justify-between',
        around: 'justify-around',
    }[justify];
    const flexDirection = direction === 'horizontal' ? 'flex-row' : 'flex-col';
    return (
        <div className={`flex ${flexDirection} ${gapClass} ${alignClass} ${justifyClass} ${className || ''}`}>
            {children}
        </div>
    );
};

// 布局组件 - Flex
const Flex = (ctx: {
    children?: React.ReactNode;
    props: {
        direction?: 'row' | 'column';
        wrap?: boolean;
        gap?: 'sm' | 'md' | 'lg';
        align?: 'start' | 'center' | 'end' | 'stretch';
        justify?: 'start' | 'center' | 'end' | 'between' | 'around';
        className?: string;
    };
}) => {
    const {
        children,
        props: { direction = 'row', wrap = false, gap = 'md', align = 'stretch', justify = 'start', className },
    } = ctx;
    const gapClass = { sm: 'gap-2', md: 'gap-4', lg: 'gap-6' }[gap];
    const alignClass = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' }[
        align
    ];
    const justifyClass = {
        start: 'justify-start',
        center: 'justify-center',
        end: 'justify-end',
        between: 'justify-between',
        around: 'justify-around',
    }[justify];
    const flexWrap = wrap ? 'flex-wrap' : 'flex-nowrap';
    const flexDirection = direction === 'column' ? 'flex-col' : 'flex-row';
    return (
        <div
            className={`flex ${flexDirection} ${flexWrap} ${gapClass} ${alignClass} ${justifyClass} ${className || ''}`}
        >
            {children}
        </div>
    );
};

// Card 组件
const CardComponent = (ctx: {
    children?: React.ReactNode;
    props: {
        title?: string;
        description?: string;
        variant?: 'default' | 'metric' | 'alert' | 'outlined';
        className?: string;
    };
}) => {
    const {
        children,
        props: { title, description, variant = 'default', className },
    } = ctx;
    const variantClasses = {
        default: '',
        metric: 'border-primary/50 bg-primary/5',
        alert: 'border-destructive/50 bg-destructive/5',
        outlined: 'border-2',
    }[variant];
    return (
        <Card className={`${variantClasses} ${className || ''}`}>
            {(title || description) && (
                <CardHeader>
                    {title && <CardTitle>{title}</CardTitle>}
                    {description && <CardDescription>{description}</CardDescription>}
                </CardHeader>
            )}
            <CardContent>{children}</CardContent>
        </Card>
    );
};

// Button 组件
const ButtonComponent = (ctx: {
    props: {
        label: string;
        variant?: 'default' | 'primary' | 'secondary' | 'danger' | 'ghost';
        size?: 'sm' | 'md' | 'lg';
        disabled?: boolean;
        action?: string;
    };
    emit: (event: string) => void;
}) => {
    const {
        props: { label, variant = 'default', size = 'md', disabled = false, action },
        emit,
    } = ctx;
    const variantMap = {
        default: 'default',
        primary: 'default',
        secondary: 'secondary',
        danger: 'destructive',
        ghost: 'ghost',
    } as const;
    const sizeMap = { sm: 'sm', md: 'default', lg: 'lg' } as const;
    return (
        <Button
            variant={variantMap[variant]}
            size={sizeMap[size]}
            disabled={disabled}
            onClick={() => action && emit(action)}
        >
            {label}
        </Button>
    );
};

// Input 组件
const InputComponent = (ctx: {
    props: {
        label?: string;
        type?: 'text' | 'number' | 'email' | 'password' | 'address' | 'token';
        placeholder?: string;
        value?: string;
        disabled?: boolean;
        required?: boolean;
        className?: string;
    };
    emit: (event: string) => void;
}) => {
    const {
        props: { label, type = 'text', placeholder, value, disabled = false, required = false, className },
        emit,
    } = ctx;
    const inputType = type === 'token' ? 'text' : type;
    return (
        <div className={`space-y-2 ${className || ''}`}>
            {label && (
                <Label>
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </Label>
            )}
            <Input
                type={inputType}
                placeholder={placeholder}
                value={value || ''}
                disabled={disabled}
                onChange={(e) => emit(`change:${e.target.value}`)}
            />
        </div>
    );
};

// Select 组件
const SelectComponent = (ctx: {
    props: {
        label?: string;
        options: Array<{ label: string; value: string }>;
        value?: string;
        placeholder?: string;
        disabled?: boolean;
        className?: string;
    };
    emit: (event: string) => void;
}) => {
    const {
        props: { label, options, value, placeholder, disabled = false, className },
        emit,
    } = ctx;
    return (
        <div className={`space-y-2 ${className || ''}`}>
            {label && <Label>{label}</Label>}
            <Select value={value} onValueChange={(val) => emit(`change:${val}`)} disabled={disabled}>
                <SelectTrigger>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
};

// Slider 组件
const SliderComponent = (ctx: {
    props: {
        label?: string;
        min: number;
        max: number;
        step?: number;
        value?: number;
        disabled?: boolean;
        className?: string;
    };
    emit: (event: string) => void;
}) => {
    const {
        props: { label, min, max, step = 1, value, disabled = false, className },
        emit,
    } = ctx;
    const currentValue = value !== undefined ? [value] : [min];
    return (
        <div className={`space-y-2 ${className || ''}`}>
            {label && (
                <div className="flex justify-between">
                    <Label>{label}</Label>
                    <span className="text-sm text-muted-foreground">{currentValue[0]}</span>
                </div>
            )}
            <Slider
                min={min}
                max={max}
                step={step}
                value={currentValue}
                disabled={disabled}
                onValueChange={(vals) => {
                    const val = Array.isArray(vals) ? vals[0] : vals;
                    emit(`change:${val}`);
                }}
            />
        </div>
    );
};

// Switch 组件
const SwitchComponent = (ctx: {
    props: { label?: string; checked?: boolean; disabled?: boolean; className?: string };
    emit: (event: string) => void;
}) => {
    const {
        props: { label, checked = false, disabled = false, className },
        emit,
    } = ctx;
    return (
        <div className={`flex items-center space-x-2 ${className || ''}`}>
            <Switch checked={checked} disabled={disabled} onCheckedChange={(val) => emit(`change:${val}`)} />
            {label && <Label>{label}</Label>}
        </div>
    );
};

// Textarea 组件
const TextareaComponent = (ctx: {
    props: {
        label?: string;
        placeholder?: string;
        value?: string;
        rows?: number;
        disabled?: boolean;
        className?: string;
    };
    emit: (event: string) => void;
}) => {
    const {
        props: { label, placeholder, value, rows = 3, disabled = false, className },
        emit,
    } = ctx;
    return (
        <div className={`space-y-2 ${className || ''}`}>
            {label && <Label>{label}</Label>}
            <Textarea
                placeholder={placeholder}
                value={value || ''}
                rows={rows}
                disabled={disabled}
                onChange={(e) => emit(`change:${e.target.value}`)}
            />
        </div>
    );
};

// Label 组件
const LabelComponent = (ctx: { props: { text: string; required?: boolean; className?: string } }) => {
    const {
        props: { text, required = false, className },
    } = ctx;
    return (
        <Label className={className}>
            {text}
            {required && <span className="text-destructive ml-1">*</span>}
        </Label>
    );
};

// TokenSelector 组件
const TokenSelector = (ctx: {
    props: {
        label?: string;
        chainId?: number;
        value?: string;
        placeholder?: string;
        disabled?: boolean;
        className?: string;
    };
    emit: (event: string) => void;
}) => {
    const {
        props: { label, chainId, value, placeholder = '选择代币...', disabled = false, className },
        emit,
    } = ctx;
    const tokens = [
        { label: 'SOL', value: 'So11111111111111111111111111111111111111112' },
        { label: 'USDC', value: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
        { label: 'USDT', value: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
        { label: 'BONK', value: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
    ];
    return (
        <div className={`space-y-2 ${className || ''}`}>
            {label && <Label>{label}</Label>}
            <Select value={value} onValueChange={(val) => emit(`change:${val}`)} disabled={disabled}>
                <SelectTrigger>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {tokens.map((token) => (
                        <SelectItem key={token.value} value={token.value}>
                            {token.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {chainId && <p className="text-xs text-muted-foreground">Chain ID: {chainId}</p>}
        </div>
    );
};

// PriceChart 组件
const PriceChart = (ctx: {
    props: {
        token: string;
        timeframe?: '1h' | '24h' | '7d' | '30d' | '1y';
        type?: 'line' | 'candle' | 'area';
        height?: number;
        className?: string;
    };
}) => {
    const {
        props: { token, timeframe = '24h', type = 'line', height = 300, className },
    } = ctx;
    return (
        <div className={`border rounded-lg p-4 bg-muted/50 ${className || ''}`} style={{ height }}>
            <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">
                    {token} Price ({timeframe})
                </h4>
                <span className="text-xs text-muted-foreground capitalize">{type} chart</span>
            </div>
            <div className="flex items-center justify-center h-[calc(100%-3rem)]">
                <p className="text-muted-foreground text-sm">
                    📊 Price chart for {token} ({timeframe})
                </p>
            </div>
        </div>
    );
};

// MetricCard 组件
const MetricCard = (ctx: {
    props: {
        label: string;
        value: string;
        change?: number;
        trend?: 'up' | 'down' | 'neutral';
        prefix?: string;
        suffix?: string;
        className?: string;
    };
}) => {
    const {
        props: { label, value, change, trend, prefix = '', suffix = '', className },
    } = ctx;
    const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground';
    const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
    return (
        <Card className={className}>
            <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{label}</p>
                <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold">
                        {prefix}
                        {value}
                        {suffix}
                    </span>
                    {change !== undefined && (
                        <span className={`text-sm ${trendColor}`}>
                            {trendIcon} {Math.abs(change).toFixed(2)}%
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

// AddressInput 组件
const AddressInput = (ctx: {
    props: {
        label?: string;
        chain?: 'solana' | 'ethereum' | 'bitcoin';
        value?: string;
        placeholder?: string;
        disabled?: boolean;
        className?: string;
    };
    emit: (event: string) => void;
}) => {
    const {
        props: { label, chain = 'solana', value, placeholder = '输入地址...', disabled = false, className },
        emit,
    } = ctx;
    return (
        <div className={`space-y-2 ${className || ''}`}>
            {label && (
                <div className="flex justify-between">
                    <Label>{label}</Label>
                    <span className="text-xs text-muted-foreground capitalize">{chain}</span>
                </div>
            )}
            <Input
                type="text"
                placeholder={placeholder}
                value={value || ''}
                disabled={disabled}
                onChange={(e) => emit(`change:${e.target.value}`)}
                className="font-mono text-sm"
            />
        </div>
    );
};

// AmountInput 组件
const AmountInput = (ctx: {
    props: { label?: string; token?: string; value?: string; max?: string; disabled?: boolean; className?: string };
    emit: (event: string) => void;
}) => {
    const {
        props: { label, token, value, max, disabled = false, className },
        emit,
    } = ctx;
    return (
        <div className={`space-y-2 ${className || ''}`}>
            {label && (
                <div className="flex justify-between">
                    <Label>{label}</Label>
                    {token && <span className="text-xs text-muted-foreground">{token}</span>}
                </div>
            )}
            <div className="relative">
                <Input
                    type="text"
                    placeholder="0.00"
                    value={value || ''}
                    disabled={disabled}
                    onChange={(e) => emit(`change:${e.target.value}`)}
                    className="pr-16"
                />
                {max && (
                    <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary hover:underline"
                        onClick={() => emit(`change:${max}`)}
                    >
                        MAX
                    </button>
                )}
            </div>
        </div>
    );
};

// 创建 AgentM Registry - 使用 any 绕过类型检查
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const agentmRegistry = (defineRegistry as any)(agentmCatalog, {
    components: {
        Card: CardComponent,
        Button: ButtonComponent,
        Input: InputComponent,
        Select: SelectComponent,
        Slider: SliderComponent,
        Switch: SwitchComponent,
        Textarea: TextareaComponent,
        Label: LabelComponent,
        TokenSelector: TokenSelector,
        PriceChart: PriceChart,
        MetricCard: MetricCard,
        AddressInput: AddressInput,
        AmountInput: AmountInput,
        Grid: Grid,
        Stack: Stack,
        Flex: Flex,
    },
    actions: {
        submitConfig: async (params: unknown) => {
            console.log('submitConfig:', params);
        },
        updateField: async (params: unknown) => {
            console.log('updateField:', params);
        },
        refreshData: async (params: unknown) => {
            console.log('refreshData:', params);
        },
        validateForm: async (params: unknown) => {
            console.log('validateForm:', params);
        },
        navigate: async (params: unknown) => {
            console.log('navigate:', params);
            if (typeof window !== 'undefined' && (params as { to?: string })?.to) {
                window.location.href = (params as { to: string }).to;
            }
        },
    },
});

// 导出类型
export type AgentmRegistry = typeof agentmRegistry;

// 导出组件映射（用于调试）
export const componentMap: Record<AgentmComponentType, string> = {
    Card: 'shadcn/ui Card',
    Button: 'shadcn/ui Button',
    Input: 'shadcn/ui Input',
    Select: 'shadcn/ui Select',
    Slider: 'shadcn/ui Slider',
    Switch: 'shadcn/ui Switch',
    Textarea: 'shadcn/ui Textarea',
    Label: 'shadcn/ui Label',
    TokenSelector: 'AgentM TokenSelector',
    PriceChart: 'AgentM PriceChart',
    MetricCard: 'AgentM MetricCard',
    AddressInput: 'AgentM AddressInput',
    AmountInput: 'AgentM AmountInput',
    Grid: 'Layout Grid',
    Stack: 'Layout Stack',
    Flex: 'Layout Flex',
};
