/**
 * Performance Monitoring & Optimization Utilities
 * Tracks operation timing, memory usage, and provides optimization recommendations
 */

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryBefore?: number;
  memoryAfter?: number;
  memoryDelta?: number;
  metadata?: Record<string, any>;
}

export interface PerformanceStats {
  totalOperations: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  totalDuration: number;
  averageMemoryDelta: number;
}

/**
 * Performance Monitor - Tracks and analyzes operation performance
 */
export class PerformanceMonitor {
  private static metrics: Map<string, PerformanceMetric[]> = new Map();
  private static activeTimers: Map<string, number> = new Map();
  private static readonly MAX_METRICS_PER_OP = 500;

  /**
   * Start tracking an operation
   */
  static startOperation(operationName: string): void {
    const timerId = `${operationName}-${Date.now()}-${Math.random()}`;
    this.activeTimers.set(timerId, Date.now());
  }

  /**
   * Start tracking with ID for async operations
   */
  static startOperationWithId(operationName: string, id: string): string {
    const timerId = `${operationName}-${id}`;
    this.activeTimers.set(timerId, Date.now());
    return timerId;
  }

  /**
   * End operation tracking
   */
  static endOperation(operationName: string, metadata?: Record<string, any>): PerformanceMetric | null {
    const timerId = Array.from(this.activeTimers.keys()).find(
      (key) => key.startsWith(operationName) && !key.endsWith('-ended')
    );

    if (!timerId) {
      console.warn(`No active timer found for operation: ${operationName}`);
      return null;
    }

    return this.finishTimer(timerId, metadata);
  }

  /**
   * End operation with specific ID
   */
  static endOperationWithId(timerId: string, metadata?: Record<string, any>): PerformanceMetric | null {
    if (!this.activeTimers.has(timerId)) {
      console.warn(`No active timer found with ID: ${timerId}`);
      return null;
    }

    return this.finishTimer(timerId, metadata);
  }

  /**
   * Finish timer and record metric
   */
  private static finishTimer(timerId: string, metadata?: Record<string, any>): PerformanceMetric {
    const startTime = this.activeTimers.get(timerId)!;
    const endTime = Date.now();
    const duration = endTime - startTime;

    const operationName = timerId.split('-').slice(0, -2).join('-');

    const metric: PerformanceMetric = {
      name: operationName,
      startTime,
      endTime,
      duration,
      metadata,
    };

    // Store metric
    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, []);
    }

    const ops = this.metrics.get(operationName)!;
    ops.push(metric);

    // Keep only recent metrics
    if (ops.length > this.MAX_METRICS_PER_OP) {
      ops.splice(0, ops.length - this.MAX_METRICS_PER_OP);
    }

    // Clean up timer
    this.activeTimers.delete(timerId);

    // Log slow operations
    if (duration > 1000) {
      console.warn(
        `⚠️  Slow operation: ${operationName} took ${duration}ms`
      );
    }

    return metric;
  }

  /**
   * Measure a synchronous operation
   */
  static measure<T>(
    operationName: string,
    operation: () => T,
    metadata?: Record<string, any>
  ): { result: T; duration: number } {
    const startTime = Date.now();
    const result = operation();
    const duration = Date.now() - startTime;

    const metric: PerformanceMetric = {
      name: operationName,
      startTime,
      endTime: startTime + duration,
      duration,
      metadata,
    };

    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, []);
    }
    this.metrics.get(operationName)!.push(metric);

    if (duration > 1000) {
      console.warn(`⚠️  Slow operation: ${operationName} took ${duration}ms`);
    }

    return { result, duration };
  }

  /**
   * Measure an async operation
   */
  static async measureAsync<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await operation();
    const duration = Date.now() - startTime;

    const metric: PerformanceMetric = {
      name: operationName,
      startTime,
      endTime: startTime + duration,
      duration,
      metadata,
    };

    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, []);
    }
    this.metrics.get(operationName)!.push(metric);

    if (duration > 1000) {
      console.warn(`⚠️  Slow operation: ${operationName} took ${duration}ms`);
    }

    return { result, duration };
  }

  /**
   * Get statistics for an operation
   */
  static getStats(operationName: string): PerformanceStats | null {
    const metrics = this.metrics.get(operationName);
    if (!metrics || metrics.length === 0) return null;

    const durations = metrics.map((m) => m.duration || 0);
    const totalDuration = durations.reduce((a, b) => a + b, 0);

    return {
      totalOperations: metrics.length,
      averageDuration: totalDuration / metrics.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalDuration,
      averageMemoryDelta: 0, // Memory tracking would require additional setup
    };
  }

  /**
   * Get all metrics for an operation
   */
  static getMetrics(operationName: string): PerformanceMetric[] {
    return [...(this.metrics.get(operationName) || [])];
  }

  /**
   * Get all recorded operations
   */
  static getAllOperations(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Generate performance report
   */
  static generateReport(): string {
    let report = '=== Performance Report ===\n\n';

    for (const operationName of this.metrics.keys()) {
      const stats = this.getStats(operationName);
      if (!stats) continue;

      report += `${operationName}:\n`;
      report += `  Total Operations: ${stats.totalOperations}\n`;
      report += `  Average Duration: ${stats.averageDuration.toFixed(2)}ms\n`;
      report += `  Min Duration: ${stats.minDuration.toFixed(2)}ms\n`;
      report += `  Max Duration: ${stats.maxDuration.toFixed(2)}ms\n`;
      report += `  Total Duration: ${stats.totalDuration.toFixed(2)}ms\n`;
      report += '\n';
    }

    return report;
  }

  /**
   * Clear all metrics
   */
  static clearMetrics(): void {
    this.metrics.clear();
    this.activeTimers.clear();
  }

  /**
   * Clear metrics for specific operation
   */
  static clearMetricsForOperation(operationName: string): void {
    this.metrics.delete(operationName);
  }
}

/**
 * Memoization utility for expensive function results
 */
export class Memoizer {
  private static cache: Map<string, { result: any; timestamp: number }> = new Map();
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Create a memoized version of a function
   */
  static memoize<T extends (...args: any[]) => any>(
    fn: T,
    ttlMs: number = this.DEFAULT_TTL
  ): T {
    const cache = new Map<string, { result: any; timestamp: number }>();

    return ((...args: any[]) => {
      const key = JSON.stringify(args);
      const cached = cache.get(key);
      const now = Date.now();

      if (cached && now - cached.timestamp < ttlMs) {
        return cached.result;
      }

      const result = fn(...args);
      cache.set(key, { result, timestamp: now });

      // Cleanup old entries
      for (const [k, v] of cache.entries()) {
        if (now - v.timestamp > ttlMs) {
          cache.delete(k);
        }
      }

      return result;
    }) as T;
  }

  /**
   * Create a memoized version of an async function
   */
  static memoizeAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    ttlMs: number = this.DEFAULT_TTL
  ): T {
    const cache = new Map<string, { result: any; timestamp: number }>();

    return (async (...args: any[]) => {
      const key = JSON.stringify(args);
      const cached = cache.get(key);
      const now = Date.now();

      if (cached && now - cached.timestamp < ttlMs) {
        return cached.result;
      }

      const result = await fn(...args);
      cache.set(key, { result, timestamp: now });

      // Cleanup old entries
      for (const [k, v] of cache.entries()) {
        if (now - v.timestamp > ttlMs) {
          cache.delete(k);
        }
      }

      return result;
    }) as T;
  }

  /**
   * Clear memoization cache
   */
  static clearCache(): void {
    if (Memoizer.cache) {
      Memoizer.cache.clear();
    }
  }
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): T {
  let timeoutId: NodeJS.Timeout | null = null;

  return ((...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs) as any;
  }) as T;
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): T {
  let lastCallTime = 0;

  return ((...args: any[]) => {
    const now = Date.now();
    if (now - lastCallTime >= delayMs) {
      fn(...args);
      lastCallTime = now;
    }
  }) as T;
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private callTimes: number[] = [];
  private readonly maxCalls: number;
  private readonly windowMs: number;

  constructor(maxCalls: number, windowMs: number) {
    this.maxCalls = maxCalls;
    this.windowMs = windowMs;
  }

  /**
   * Check if operation is allowed
   */
  canProceed(): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    // Remove old calls outside window
    this.callTimes = this.callTimes.filter((time) => time > cutoff);

    if (this.callTimes.length < this.maxCalls) {
      this.callTimes.push(now);
      return true;
    }

    return false;
  }

  /**
   * Wait until operation is allowed
   */
  async waitUntilAllowed(): Promise<void> {
    while (!this.canProceed()) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Reset rate limiter
   */
  reset(): void {
    this.callTimes = [];
  }
}

export default PerformanceMonitor;
