/**
 * DynamicDashboard 组件
 * 动态数据仪表盘 - 自然语言查询驱动的数据展示
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import { JsonRender, JsonRenderSkeleton, JsonRenderError } from "@/components/json-render";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, History, Bookmark, Share2, Download } from "lucide-react";
import { generateDashboardSpec, parseQuery, type QueryIntent } from "@/lib/data/mock-data";
import type { Spec } from "@json-render/core";

// 查询历史项
interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  intent: QueryIntent;
}

// 常用查询
const COMMON_QUERIES = [
  "显示我过去 7 天的收益",
  "SOL 价格走势",
  "我的交易历史",
  "持仓概览",
  "风险指标分析",
];

interface DynamicDashboardProps {
  /** 初始查询 */
  initialQuery?: string;
  /** 是否显示历史 */
  showHistory?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * DynamicDashboard 组件
 */
export function DynamicDashboard({
  initialQuery = "",
  showHistory = true,
  className = "",
}: DynamicDashboardProps) {
  const [query, setQuery] = useState(initialQuery);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // 从 localStorage 加载历史
  useEffect(() => {
    const saved = localStorage.getItem("dashboard-query-history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        // ignore parse error
      }
    }
  }, []);

  // 保存历史到 localStorage
  useEffect(() => {
    localStorage.setItem("dashboard-query-history", JSON.stringify(history));
  }, [history]);

  // 执行查询
  const executeQuery = useCallback(async (queryText: string) => {
    if (!queryText.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // 解析查询
      const parsed = parseQuery(queryText);

      // 模拟 API 调用延迟
      await new Promise(resolve => setTimeout(resolve, 500));

      // 生成 Spec
      const generatedSpec = generateDashboardSpec(queryText) as Spec;
      setSpec(generatedSpec);

      // 添加到历史
      const newItem: QueryHistoryItem = {
        id: `query-${Date.now()}`,
        query: queryText,
        timestamp: Date.now(),
        intent: parsed.intent,
      };
      setHistory(prev => [newItem, ...prev.slice(0, 19)]); // 保留最近 20 条

    } catch (err) {
      setError(err instanceof Error ? err : new Error("查询失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  // 处理搜索
  const handleSearch = useCallback(() => {
    executeQuery(query);
  }, [query, executeQuery]);

  // 从历史执行
  const handleHistoryClick = useCallback((historyQuery: string) => {
    setQuery(historyQuery);
    executeQuery(historyQuery);
    setShowHistoryPanel(false);
  }, [executeQuery]);

  // 处理表单变化
  const handleFormChange = useCallback((field: string, value: unknown) => {
    console.log(`Dashboard field changed: ${field} =`, value);
  }, []);

  // 处理分享
  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/dashboard?q=${encodeURIComponent(query)}`;
    navigator.clipboard.writeText(url);
    alert("链接已复制到剪贴板");
  }, [query]);

  // 处理导出
  const handleExport = useCallback(() => {
    if (!spec) return;
    const dataStr = JSON.stringify(spec, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dashboard-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [spec]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 查询输入区 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="询问你的数据，例如：显示我过去 7 天的收益..."
                className="pr-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
              />
              {showHistory && (
                <button
                  onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <History className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              查询
            </Button>
          </div>

          {/* 常用查询 */}
          <div className="flex flex-wrap gap-2 mt-4">
            {COMMON_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setQuery(q);
                  executeQuery(q);
                }}
                className="px-3 py-1 text-sm bg-muted rounded-full hover:bg-muted/80 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 历史面板 */}
      {showHistoryPanel && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">查询历史</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleHistoryClick(item.query)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
                >
                  <div className="text-sm">{item.query}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(item.timestamp).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 加载状态 */}
      {loading && (
        <Card>
          <CardContent className="pt-6">
            <JsonRenderSkeleton />
          </CardContent>
        </Card>
      )}

      {/* 错误状态 */}
      {error && (
        <JsonRenderError
          error={error}
          onRetry={() => executeQuery(query)}
        />
      )}

      {/* 结果展示 */}
      {spec && !loading && (
        <div className="space-y-4">
          {/* 操作栏 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              分享
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
          </div>

          {/* 仪表盘内容 */}
          <Card>
            <CardContent className="pt-6">
              <JsonRender
                spec={spec}
                onChange={handleFormChange}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* 空状态 */}
      {!spec && !loading && !error && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6 text-center py-12">
            <div className="text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">开始查询</p>
              <p className="text-sm mt-2">输入查询或选择上方常用查询</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default DynamicDashboard;
