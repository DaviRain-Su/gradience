"use client";

import React from "react";
import { DynamicDashboard } from "@/components/dashboard/DynamicDashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, BarChart3, PieChart, Activity } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dynamic Dashboard</h1>
        <p className="text-muted-foreground">
          Query your data with natural language. AI generates the best visualization automatically.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Returns</p>
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
                <p className="text-sm text-muted-foreground">Volume</p>
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
                <p className="text-sm text-muted-foreground">Portfolio Value</p>
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
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold">68%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle>Data Query</CardTitle>
          <CardDescription>
            Enter a query to get a custom data view
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DynamicDashboard />
        </CardContent>
      </Card>

      {/* Usage Guide */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Supported Queries</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>&#8226; Returns analysis -- &quot;Show my returns for the past 7 days&quot;</li>
              <li>&#8226; Volume analysis -- &quot;View SOL trading volume trend&quot;</li>
              <li>&#8226; Price tracking -- &quot;ETH price movement&quot;</li>
              <li>&#8226; Portfolio overview -- &quot;My portfolio distribution&quot;</li>
              <li>&#8226; Trade history -- &quot;Show recent transactions&quot;</li>
              <li>&#8226; Risk metrics -- &quot;Analyze my investment risk&quot;</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Time Ranges</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>&#8226; 1 hour -- &quot;Data from the past hour&quot;</li>
              <li>&#8226; 24 hours -- &quot;Today&apos;s returns&quot;</li>
              <li>&#8226; 7 days -- &quot;Trading volume this week&quot;</li>
              <li>&#8226; 30 days -- &quot;Price trend this month&quot;</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
