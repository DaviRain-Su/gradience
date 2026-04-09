'use client';

import React, { useState, useCallback } from 'react';
import { JsonRender, JsonRenderSkeleton, JsonRenderError } from '@/components/json-render';
import {
    Button,
    Textarea,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@gradiences/ui';
import { Wand2, Copy, Share2, Download, RefreshCw, Maximize2, Lightbulb } from 'lucide-react';
import type { Spec } from '@json-render/core';

// 示例模板
const TEMPLATES = [
    {
        id: 'crypto-monitor',
        name: '加密货币监控面板',
        description: '显示多个代币价格和涨跌幅',
        prompt: '创建一个加密货币监控面板，显示 BTC、ETH 和 SOL 的当前价格、24小时涨跌幅和价格走势图。使用卡片布局，每个代币一个卡片。',
    },
    {
        id: 'defi-dashboard',
        name: 'DeFi 仪表盘',
        description: '流动性池和收益概览',
        prompt: '创建一个 DeFi 仪表盘，显示总锁仓价值(TVL)、年化收益率(APY)、流动性池列表。使用指标卡片和网格布局。',
    },
    {
        id: 'nft-gallery',
        name: 'NFT 画廊',
        description: '展示 NFT 集合',
        prompt: '创建一个 NFT 画廊界面，有筛选器（按价格、稀有度排序）、搜索框、NFT 卡片网格展示。每个卡片显示图片、名称、价格和购买按钮。',
    },
    {
        id: 'trading-interface',
        name: '交易界面',
        description: '简洁的交易面板',
        prompt: '创建一个加密货币交易界面，有代币选择器、价格输入、数量输入、滑点设置、交易按钮。使用左右分栏布局。',
    },
    {
        id: 'portfolio-tracker',
        name: '投资组合追踪',
        description: '资产分布和收益分析',
        prompt: '创建一个投资组合追踪面板，显示总资产价值、收益曲线、资产分布饼图、持仓列表。使用多种图表组件。',
    },
    {
        id: 'task-manager',
        name: '任务管理器',
        description: '待办事项和状态跟踪',
        prompt: '创建一个任务管理界面，有任务列表、状态标签（待办/进行中/已完成）、优先级标记、添加任务按钮。使用卡片和列表布局。',
    },
    {
        id: 'wallet-overview',
        name: '钱包概览',
        description: '多链钱包资产总览',
        prompt: '创建一个多链钱包概览页面，显示各链余额、最近交易、代币列表。使用标签页切换不同链。',
    },
    {
        id: 'settings-panel',
        name: '设置面板',
        description: '用户偏好设置',
        prompt: '创建一个设置面板，有个人信息、通知设置、安全设置、主题切换等部分。使用表单组件和开关。',
    },
];

export default function AIPlaygroundPage() {
    const [prompt, setPrompt] = useState('');
    const [spec, setSpec] = useState<Spec | null>(null);
    const [specText, setSpecText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [activeTab, setActiveTab] = useState('preview');

    // 生成 Spec
    const generateSpec = useCallback(async () => {
        if (!prompt.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/ai/generate-spec', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    context: { type: 'playground' },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            setSpec(data.spec);
            setSpecText(JSON.stringify(data.spec, null, 2));
            setActiveTab('preview');
        } catch (err) {
            setError(err instanceof Error ? err : new Error('生成失败'));
        } finally {
            setLoading(false);
        }
    }, [prompt]);

    // 应用手动编辑的 Spec
    const applySpecEdit = useCallback(() => {
        try {
            const parsed = JSON.parse(specText);
            setSpec(parsed);
            setError(null);
        } catch (err) {
            setError(new Error('JSON 格式错误: ' + (err instanceof Error ? err.message : 'Unknown error')));
        }
    }, [specText]);

    // 加载模板
    const loadTemplate = useCallback((templateId: string | null) => {
        if (!templateId) return;
        const template = TEMPLATES.find((t) => t.id === templateId);
        if (template) {
            setPrompt(template.prompt);
        }
    }, []);

    // 复制代码
    const copyCode = useCallback(() => {
        if (!spec) return;
        const code = generateReactCode(spec);
        navigator.clipboard.writeText(code);
        alert('代码已复制到剪贴板');
    }, [spec]);

    // 导出 Spec
    const exportSpec = useCallback(() => {
        if (!spec) return;
        const dataStr = JSON.stringify(spec, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `playground-spec-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }, [spec]);

    // 分享
    const share = useCallback(() => {
        if (!spec) return;
        const url = `${window.location.origin}/ai-playground?spec=${encodeURIComponent(JSON.stringify(spec))}`;
        navigator.clipboard.writeText(url);
        alert('分享链接已复制到剪贴板');
    }, [spec]);

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl h-[calc(100vh-4rem)]">
            {/* 头部 */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                    <Wand2 className="h-6 w-6 text-primary" />
                    <h1 className="text-3xl font-bold">AI Playground</h1>
                </div>
                <p className="text-muted-foreground">用自然语言创建界面，探索 AI 生成 UI 的无限可能</p>
            </div>

            {/* 主布局 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100%-6rem)]">
                {/* 左侧：输入区 */}
                <div className="space-y-4 overflow-auto">
                    {/* 模板选择 */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Lightbulb className="h-4 w-4" />
                                示例模板
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Select onValueChange={loadTemplate}>
                                <SelectTrigger>
                                    <SelectValue placeholder="选择一个模板开始..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {TEMPLATES.map((template) => (
                                        <SelectItem key={template.id} value={template.id}>
                                            <div>
                                                <div className="font-medium">{template.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {template.description}
                                                </div>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    {/* 输入区 */}
                    <Card className="flex-1">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">界面描述</CardTitle>
                            <CardDescription>描述你想要的界面，越详细越好</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="例如：创建一个加密货币监控面板，显示 BTC、ETH 的价格和涨跌幅..."
                                className="min-h-[200px] resize-none"
                            />
                            <div className="flex gap-2">
                                <Button onClick={generateSpec} disabled={!prompt.trim() || loading} className="flex-1">
                                    {loading ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                            生成中...
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="h-4 w-4 mr-2" />
                                            生成界面
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setPrompt('');
                                        setSpec(null);
                                        setSpecText('');
                                        setError(null);
                                    }}
                                >
                                    清空
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Spec 编辑器 */}
                    {spec && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm">Spec 编辑器</CardTitle>
                                <CardDescription>手动编辑生成的 Spec（高级用户）</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Textarea
                                    value={specText}
                                    onChange={(e) => setSpecText(e.target.value)}
                                    className="min-h-[150px] font-mono text-xs"
                                />
                                <Button variant="outline" size="sm" onClick={applySpecEdit}>
                                    应用修改
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* 右侧：预览区 */}
                <div className="flex flex-col">
                    <Card className="flex-1 flex flex-col">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm">预览</CardTitle>
                                {spec && (
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={copyCode}>
                                            <Copy className="h-4 w-4 mr-1" />
                                            复制代码
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={exportSpec}>
                                            <Download className="h-4 w-4 mr-1" />
                                            导出
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={share}>
                                            <Share2 className="h-4 w-4 mr-1" />
                                            分享
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto">
                            <Tabs value={activeTab} onValueChange={setActiveTab}>
                                <TabsList className="mb-4">
                                    <TabsTrigger value="preview">预览</TabsTrigger>
                                    <TabsTrigger value="tree">组件树</TabsTrigger>
                                </TabsList>

                                <TabsContent value="preview" className="mt-0">
                                    {loading ? (
                                        <JsonRenderSkeleton />
                                    ) : error ? (
                                        <JsonRenderError error={error} onRetry={generateSpec} />
                                    ) : spec ? (
                                        <div className="border rounded-lg p-4">
                                            <JsonRender spec={spec} />
                                        </div>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground">
                                            <div className="text-center">
                                                <Wand2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                                <p>输入描述并点击"生成界面"</p>
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="tree" className="mt-0">
                                    {spec ? (
                                        <div className="font-mono text-sm">
                                            <ComponentTree spec={spec} />
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground text-center py-8">
                                            先生成界面以查看组件树
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// 生成 React 代码
function generateReactCode(spec: Spec): string {
    return `import { Renderer, JSONUIProvider } from "@json-render/react";
import { agentmRegistry } from "@/components/json-render/registry";

const spec = ${JSON.stringify(spec, null, 2)};

export default function GeneratedUI() {
  return (
    <JSONUIProvider registry={agentmRegistry.registry}>
      <Renderer spec={spec} />
    </JSONUIProvider>
  );
}
`;
}

// 组件树组件
function ComponentTree({ spec }: { spec: Spec }) {
    const renderTree = (elementId: string, depth: number = 0): React.ReactNode => {
        const element = spec.elements[elementId];
        if (!element) return null;

        const indent = '  '.repeat(depth);
        const children = element.children || [];

        return (
            <div key={elementId}>
                <div className="text-muted-foreground">
                    {indent}• {element.type} ({elementId})
                </div>
                {children.map((childId) => renderTree(childId, depth + 1))}
            </div>
        );
    };

    return (
        <div className="bg-muted p-4 rounded-lg overflow-auto">
            <div className="text-foreground font-medium mb-2">组件结构</div>
            {renderTree(spec.root)}
        </div>
    );
}
