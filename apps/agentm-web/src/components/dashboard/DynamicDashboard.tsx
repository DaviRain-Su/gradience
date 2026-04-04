/**
 * DynamicDashboard 组件
 * 
 * 注意：此组件正在重构中。原来的 mock 数据已移除。
 * Dashboard 需要连接真实的数据源（收益、交易量等）。
 * 
 * TODO: 实现真实的数据查询 API
 */

"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction, BarChart3 } from "lucide-react";

interface DynamicDashboardProps {
  initialQuery?: string;
  showHistory?: boolean;
  className?: string;
}

export function DynamicDashboard({
  className = "",
}: DynamicDashboardProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Construction className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
            <p className="text-muted-foreground max-w-md">
              The Dashboard is being rebuilt to show real trading metrics and performance data.
              <br /><br />
              Check back soon for:
            </p>
            <ul className="text-muted-foreground text-sm mt-4 space-y-1 text-left inline-block">
              <li>• Real profit & loss tracking</li>
              <li>• Trading volume analytics</li>
              <li>• Win rate statistics</li>
              <li>• Risk metrics (max drawdown)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DynamicDashboard;
