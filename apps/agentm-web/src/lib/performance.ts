// @ts-nocheck
/**
 * 性能监控工具
 */

// 性能指标类型
export interface PerformanceMetrics {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
}

// AI 性能指标
export interface AIPerformanceMetrics {
  prompt: string;
  type: string;
  duration: number;
  cached: boolean;
  success: boolean;
  error?: string;
}

// 性能监控类
class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private aiMetrics: AIPerformanceMetrics[] = [];
  private listeners: ((metrics: PerformanceMetrics) => void)[] = [];

  constructor() {
    if (typeof window !== "undefined") {
      this.initWebVitals();
    }
  }

  // 初始化 Web Vitals 监控
  private initWebVitals() {
    // FCP
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length > 0) {
        this.metrics.fcp = entries[0].startTime;
        this.notifyListeners();
      }
    }).observe({ entryTypes: ["paint"] });

    // LCP
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length > 0) {
        const lastEntry = entries[entries.length - 1];
        this.metrics.lcp = lastEntry.startTime;
        this.notifyListeners();
      }
    }).observe({ entryTypes: ["largest-contentful-paint"] });

    // CLS
    new PerformanceObserver((list) => {
      let clsValue = 0;
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      this.metrics.cls = clsValue;
      this.notifyListeners();
    }).observe({ entryTypes: ["layout-shift"] });

    // TTFB
    if (performance.timing) {
      const timing = performance.timing;
      this.metrics.ttfb = timing.responseStart - timing.requestStart;
    }
  }

  // 记录 AI 性能
  recordAI(metrics: AIPerformanceMetrics) {
    this.aiMetrics.push(metrics);
    
    // 只保留最近 100 条记录
    if (this.aiMetrics.length > 100) {
      this.aiMetrics.shift();
    }

    // 发送到分析服务（如果有）
    this.sendToAnalytics("ai_performance", metrics);
  }

  // 获取性能指标
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // 获取 AI 性能统计
  getAIStats() {
    const total = this.aiMetrics.length;
    if (total === 0) return null;

    const cached = this.aiMetrics.filter((m) => m.cached).length;
    const successful = this.aiMetrics.filter((m) => m.success).length;
    const avgDuration =
      this.aiMetrics.reduce((sum, m) => sum + m.duration, 0) / total;

    return {
      total,
      cached,
      cacheHitRate: (cached / total) * 100,
      successRate: (successful / total) * 100,
      avgDuration,
      avgDurationCached:
        this.aiMetrics
          .filter((m) => m.cached)
          .reduce((sum, m) => sum + m.duration, 0) / (cached || 1),
      avgDurationUncached:
        this.aiMetrics
          .filter((m) => !m.cached)
          .reduce((sum, m) => sum + m.duration, 0) / (total - cached || 1),
    };
  }

  // 添加监听器
  addListener(listener: (metrics: PerformanceMetrics) => void) {
    this.listeners.push(listener);
  }

  // 移除监听器
  removeListener(listener: (metrics: PerformanceMetrics) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // 通知监听器
  private notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.metrics);
    }
  }

  // 发送到分析服务
  private sendToAnalytics(event: string, data: unknown) {
    // 这里可以集成 Google Analytics、Mixpanel 等
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", event, data);
    }
  }
}

// 导出单例
export const performanceMonitor = new PerformanceMonitor();

// 高阶组件：监控组件渲染性能
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.FC<P> {
  return function PerformanceTrackedComponent(props: P) {
    const startTime = performance.now();

    React.useEffect(() => {
      const duration = performance.now() - startTime;
      console.log(`[Performance] ${componentName} rendered in ${duration.toFixed(2)}ms`);
    });

    return React.createElement(Component, props);
  };
}

// 缓存性能监控
export interface CacheMetrics {
  hits: number;
  misses: number;
  size: number;
}

export function trackCachePerformance(
  cacheName: string,
  getMetrics: () => CacheMetrics
) {
  if (typeof window === "undefined") return;

  // 每 30 秒报告一次缓存指标
  setInterval(() => {
    const metrics = getMetrics();
    const hitRate = metrics.hits / (metrics.hits + metrics.misses || 1);
    
    console.log(`[Cache:${cacheName}] Hit rate: ${(hitRate * 100).toFixed(1)}%, Size: ${metrics.size}`);
  }, 30000);
}

export default performanceMonitor;
