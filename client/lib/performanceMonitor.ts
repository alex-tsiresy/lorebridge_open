import { logger } from "@/lib/logger";
interface PerformanceMetrics {
  renderTime: number;
  memoryUsage?: number;
  nodeCount: number;
  contentLength: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private isEnabled: boolean = process.env.NODE_ENV === 'development';

  // Track node rendering performance
  trackNodeRender = (nodeId: string, contentLength: number, renderTime: number) => {
    if (!this.isEnabled) return;

    const metric: PerformanceMetrics = {
      renderTime,
      nodeCount: 1,
      contentLength,
      timestamp: Date.now()
    };

    this.metrics.push(metric);

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Log slow renders
    if (renderTime > 100) {
      logger.warn(`Slow node render detected: ${nodeId} took ${renderTime}ms`);
    }
  };

  // Track flow performance
  trackFlowRender = (nodeCount: number, totalRenderTime: number) => {
    if (!this.isEnabled) return;

    const metric: PerformanceMetrics = {
      renderTime: totalRenderTime,
      nodeCount,
      contentLength: 0,
      timestamp: Date.now()
    };

    this.metrics.push(metric);

    // Log performance warnings
    if (totalRenderTime > 500) {
      logger.warn(`Slow flow render: ${nodeCount} nodes took ${totalRenderTime}ms`);
    }
  };

  // Get performance statistics
  getStats = () => {
    if (this.metrics.length === 0) return null;

    const recentMetrics = this.metrics.slice(-20);
    const avgRenderTime = recentMetrics.reduce((sum, m) => sum + m.renderTime, 0) / recentMetrics.length;
    const maxRenderTime = Math.max(...recentMetrics.map(m => m.renderTime));
    const avgNodeCount = recentMetrics.reduce((sum, m) => sum + m.nodeCount, 0) / recentMetrics.length;

    return {
      avgRenderTime: Math.round(avgRenderTime),
      maxRenderTime,
      avgNodeCount: Math.round(avgNodeCount),
      totalMetrics: this.metrics.length
    };
  };

  // Clear metrics
  clear = () => {
    this.metrics = [];
  };

  // Enable/disable monitoring
  setEnabled = (enabled: boolean) => {
    this.isEnabled = enabled;
  };
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export const usePerformanceMonitor = () => {
  const trackNodeRender = (nodeId: string, contentLength: number, renderTime: number) => {
    performanceMonitor.trackNodeRender(nodeId, contentLength, renderTime);
  };

  const trackFlowRender = (nodeCount: number, totalRenderTime: number) => {
    performanceMonitor.trackFlowRender(nodeCount, totalRenderTime);
  };

  const getStats = () => performanceMonitor.getStats();

  return {
    trackNodeRender,
    trackFlowRender,
    getStats,
    clear: performanceMonitor.clear.bind(performanceMonitor),
    setEnabled: performanceMonitor.setEnabled.bind(performanceMonitor)
  };
}; 