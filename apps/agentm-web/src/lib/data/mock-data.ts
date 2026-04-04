/**
 * Mock Data for Dashboard
 * 用于演示的动态数据
 */

export interface MetricData {
  label: string;
  value: string;
  change: number;
  trend: "up" | "down" | "neutral";
  prefix?: string;
  suffix?: string;
}

export interface ChartDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface ChartData {
  token: string;
  timeframe: string;
  type: "line" | "candle" | "bar";
  data: ChartDataPoint[];
}

export interface Transaction {
  id: string;
  type: "buy" | "sell" | "transfer";
  token: string;
  amount: string;
  price: string;
  total: string;
  timestamp: number;
  status: "completed" | "pending" | "failed";
}

// 生成模拟的 Metric 数据
export function generateMockMetrics(): MetricData[] {
  return [
    {
      label: "总收益",
      value: "12,450.50",
      change: 12.5,
      trend: "up",
      prefix: "$",
    },
    {
      label: "交易量",
      value: "1.2M",
      change: 15.3,
      trend: "up",
      prefix: "$",
    },
    {
      label: "胜率",
      value: "68",
      change: 5.2,
      trend: "up",
      suffix: "%",
    },
    {
      label: "最大回撤",
      value: "8.5",
      change: -2.1,
      trend: "down",
      suffix: "%",
    },
  ];
}

// 生成模拟的图表数据
export function generateMockChartData(
  token: string = "SOL",
  timeframe: string = "7d",
  type: "line" | "candle" | "bar" = "line"
): ChartData {
  const now = Date.now();
  const points = timeframe === "1h" ? 60 : timeframe === "24h" ? 24 : timeframe === "7d" ? 7 : 30;
  const interval = timeframe === "1h" ? 60000 : timeframe === "24h" ? 3600000 : 86400000;

  const data: ChartDataPoint[] = [];
  let baseValue = 100 + Math.random() * 50;

  for (let i = 0; i < points; i++) {
    const timestamp = now - (points - i) * interval;
    const change = (Math.random() - 0.5) * 10;
    baseValue = Math.max(10, baseValue + change);
    
    data.push({
      timestamp,
      value: baseValue,
      label: new Date(timestamp).toLocaleDateString(),
    });
  }

  return {
    token,
    timeframe,
    type,
    data,
  };
}

// 生成模拟的交易数据
export function generateMockTransactions(count: number = 10): Transaction[] {
  const tokens = ["SOL", "ETH", "BTC", "USDC", "USDT"];
  const types: ("buy" | "sell" | "transfer")[] = ["buy", "sell", "transfer"];
  const statuses: ("completed" | "pending" | "failed")[] = ["completed", "completed", "completed", "pending", "failed"];

  return Array.from({ length: count }, (_, i) => {
    const token = tokens[Math.floor(Math.random() * tokens.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    const amount = (Math.random() * 100).toFixed(4);
    const price = (Math.random() * 1000 + 10).toFixed(2);
    const total = (parseFloat(amount) * parseFloat(price)).toFixed(2);

    return {
      id: `tx-${Date.now()}-${i}`,
      type,
      token,
      amount,
      price: `$${price}`,
      total: `$${total}`,
      timestamp: Date.now() - Math.random() * 86400000 * 7,
      status: statuses[Math.floor(Math.random() * statuses.length)],
    };
  });
}

// 查询意图识别
export type QueryIntent =
  | "profit_analysis"
  | "volume_analysis"
  | "price_tracking"
  | "portfolio_overview"
  | "transaction_history"
  | "risk_metrics"
  | "unknown";

export interface ParsedQuery {
  intent: QueryIntent;
  tokens: string[];
  timeframe: string;
  metrics: string[];
}

// 简单的查询解析器
export function parseQuery(query: string): ParsedQuery {
  const lowerQuery = query.toLowerCase();

  // 识别意图
  let intent: QueryIntent = "unknown";
  if (lowerQuery.includes("收益") || lowerQuery.includes("profit") || lowerQuery.includes("盈利")) {
    intent = "profit_analysis";
  } else if (lowerQuery.includes("交易量") || lowerQuery.includes("volume")) {
    intent = "volume_analysis";
  } else if (lowerQuery.includes("价格") || lowerQuery.includes("price")) {
    intent = "price_tracking";
  } else if (lowerQuery.includes("持仓") || lowerQuery.includes("portfolio")) {
    intent = "portfolio_overview";
  } else if (lowerQuery.includes("交易") || lowerQuery.includes("transaction")) {
    intent = "transaction_history";
  } else if (lowerQuery.includes("风险") || lowerQuery.includes("risk")) {
    intent = "risk_metrics";
  }

  // 识别代币
  const tokens: string[] = [];
  const tokenKeywords = ["sol", "eth", "btc", "usdc", "usdt", "bonk"];
  for (const token of tokenKeywords) {
    if (lowerQuery.includes(token)) {
      tokens.push(token.toUpperCase());
    }
  }

  // 识别时间范围
  let timeframe = "7d";
  if (lowerQuery.includes("1小时") || lowerQuery.includes("1h")) {
    timeframe = "1h";
  } else if (lowerQuery.includes("24小时") || lowerQuery.includes("24h") || lowerQuery.includes("今天")) {
    timeframe = "24h";
  } else if (lowerQuery.includes("7天") || lowerQuery.includes("7d") || lowerQuery.includes("一周")) {
    timeframe = "7d";
  } else if (lowerQuery.includes("30天") || lowerQuery.includes("30d") || lowerQuery.includes("一个月")) {
    timeframe = "30d";
  }

  // 识别指标
  const metrics: string[] = [];
  const metricKeywords = ["收益", "交易量", "价格", "胜率", "回撤", "波动率"];
  for (const metric of metricKeywords) {
    if (lowerQuery.includes(metric)) {
      metrics.push(metric);
    }
  }

  return {
    intent,
    tokens: tokens.length > 0 ? tokens : ["SOL"],
    timeframe,
    metrics,
  };
}

// 根据查询生成 Spec
export function generateDashboardSpec(query: string) {
  const parsed = parseQuery(query);

  const elements: Record<string, unknown> = {
    "dashboard-root": {
      type: "Stack",
      props: { direction: "vertical", gap: "lg" },
      children: ["metrics-grid", "charts-section"],
    },
    "metrics-grid": {
      type: "Grid",
      props: { columns: 4, gap: "md" },
      children: ["metric-1", "metric-2", "metric-3", "metric-4"],
    },
    "metric-1": {
      type: "MetricCard",
      props: {
        label: "总收益",
        value: "$12,450.50",
        change: 12.5,
        trend: "up",
        prefix: "$",
      },
    },
    "metric-2": {
      type: "MetricCard",
      props: {
        label: "交易量",
        value: "1.2M",
        change: 15.3,
        trend: "up",
        prefix: "$",
      },
    },
    "metric-3": {
      type: "MetricCard",
      props: {
        label: "胜率",
        value: "68",
        change: 5.2,
        trend: "up",
        suffix: "%",
      },
    },
    "metric-4": {
      type: "MetricCard",
      props: {
        label: "最大回撤",
        value: "8.5",
        change: -2.1,
        trend: "down",
        suffix: "%",
      },
    },
    "charts-section": {
      type: "Stack",
      props: { direction: "vertical", gap: "md" },
      children: parsed.intent === "price_tracking" ? ["price-chart"] : ["price-chart", "volume-chart"],
    },
    "price-chart": {
      type: "PriceChart",
      props: {
        token: parsed.tokens[0] || "SOL",
        timeframe: parsed.timeframe,
        type: "line",
        height: 300,
      },
    },
  };

  if (parsed.intent !== "price_tracking") {
    elements["volume-chart"] = {
      type: "Card",
      props: { title: "交易量分析", variant: "default" },
      children: ["volume-chart-content"],
    };
    elements["volume-chart-content"] = {
      type: "PriceChart",
      props: {
        token: parsed.tokens[0] || "SOL",
        timeframe: parsed.timeframe,
        type: "line",
        height: 200,
      },
    };
  }

  return {
    root: "dashboard-root",
    elements,
  };
}

export default {
  generateMockMetrics,
  generateMockChartData,
  generateMockTransactions,
  parseQuery,
  generateDashboardSpec,
};
