'use client';

import React from 'react';
import { Renderer, JSONUIProvider } from '@json-render/react';
import { agentmRegistry } from './registry';
import type { Spec } from '@json-render/core';

interface JsonRenderProps {
    /** 要渲染的 Spec */
    spec: Spec;
    /** 初始数据 */
    initialData?: Record<string, unknown>;
    /** 是否只读模式 */
    readOnly?: boolean;
    /** 自定义样式类名 */
    className?: string;
    /** 表单值变化回调 */
    onChange?: (field: string, value: unknown) => void;
    /** Action 触发回调 */
    onAction?: (action: string, params: unknown) => void | Promise<void>;
    /** 渲染错误回调 */
    onError?: (error: Error) => void;
}

/**
 * JsonRender 组件
 * 将 JSON Spec 渲染为交互式 UI
 */
export function JsonRender({ spec, initialData = {}, readOnly = false, className = '', onChange }: JsonRenderProps) {
    return (
        <div className={`json-render-container ${className}`}>
            <JSONUIProvider
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                registry={(agentmRegistry as any).registry}
                initialState={initialData}
                onStateChange={(changes) => {
                    changes.forEach(({ path, value }) => {
                        onChange?.(path, value);
                    });
                }}
            >
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Renderer spec={spec} registry={(agentmRegistry as any).registry} />
            </JSONUIProvider>
        </div>
    );
}

/**
 * JsonRender 加载状态
 */
export function JsonRenderSkeleton({ className = '' }: { className?: string }) {
    return (
        <div className={`space-y-4 animate-pulse ${className}`}>
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-32 bg-muted rounded" />
            <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-10 bg-muted rounded" />
            </div>
            <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-10 bg-muted rounded" />
            </div>
        </div>
    );
}

/**
 * JsonRender 错误状态
 */
export function JsonRenderError({
    error,
    onRetry,
    className = '',
}: {
    error: Error;
    onRetry?: () => void;
    className?: string;
}) {
    return (
        <div className={`p-4 border border-destructive/50 rounded-lg bg-destructive/5 ${className}`}>
            <h4 className="font-medium text-destructive mb-2">渲染错误</h4>
            <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
                >
                    重试
                </button>
            )}
        </div>
    );
}

export default JsonRender;
