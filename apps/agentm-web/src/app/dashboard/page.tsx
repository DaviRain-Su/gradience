"use client";

import React from "react";
import { DynamicDashboard } from "@/components/dashboard/DynamicDashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, BarChart3, PieChart, Activity } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* 头部 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">动态数据仪表盘</h1>
        <p className="text-muted-foreground">
          使用自然语言查询你的数据，AI 会自动生成最佳的可视化图表
        </p>
      </div>

      {/* 功能卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">收益分析</p>
                <p className="text-2xl font-bold">+12.5%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">交易量</p>
                <p className="text-2xl font-bold">$1.2M</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <PieChart className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">持仓价值</p>
                <p className="text-2xl font-bold">$45.2K</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">胜率</p>
                <p className="text-2xl font-bold">68%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 动态仪表盘 */}
      <Card>
        <CardHeader>
          <CardTitle>数据查询</CardTitle>
          <CardDescription>
            输入查询语句获取自定义数据视图
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DynamicDashboard />
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">支持的查询类型</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• 收益分析 - "显示我过去 7 天的收益"</li>
              <li>• 交易量分析 - "查看 SOL 的交易量趋势"</li>
              <li>• 价格追踪 - "ETH 价格走势"</li>
              <li>• 持仓概览 - "我的持仓分布"</li>
              <li>• 交易历史 - "显示最近的交易记录"</li>
              <li>• 风险指标 - "分析我的投资风险"</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">时间范围</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• 1小时 - "过去 1 小时的数据"</li>
              <li>• 24小时 - "今天的收益"</li>
              <li>• 7天 - "过去一周的交易量"</li>
              <li>• 30天 - "最近一个月的价格走势"</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
