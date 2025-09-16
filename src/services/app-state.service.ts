// Application state management service
// Handles global app state, settings persistence, and cross-cutting concerns

interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  autoSave: boolean;
  autoSaveInterval: number; // in minutes
  performanceMode: 'high' | 'medium' | 'low';
  showWelcomeTour: boolean;
  debugMode: boolean;
  lastActiveTab: string;
  recentProjects: string[];
}

interface PerformanceMetrics {
  frameRate: number;
  memoryUsage: number;
  triangleCount: number;
  drawCalls: number;
  loadTime: number;
}

export class AppStateService {
  private static readonly SETTINGS_KEY = 'app-settings';
  private static readonly METRICS_KEY = 'performance-metrics';
  private static readonly SESSION_KEY = 'session-data';

  // Settings management
  static getDefaultSettings(): AppSettings {
    return {
      theme: 'system',
      language: 'pl',
      autoSave: true,
      autoSaveInterval: 2, // 2 minutes
      performanceMode: 'medium',
      showWelcomeTour: true,
      debugMode: false,
      lastActiveTab: 'editor',
      recentProjects: [],
    };
  }

  static getSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(this.SETTINGS_KEY);
      if (!stored) return this.getDefaultSettings();

      const parsed = JSON.parse(stored) as Partial<AppSettings>;
      return { ...this.getDefaultSettings(), ...parsed };
    } catch {
      return this.getDefaultSettings();
    }
  }

  static updateSettings(updates: Partial<AppSettings>): void {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...updates };
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(updated));
      
      // Apply settings that need immediate effect
      this.applySettingsChanges(updates);
    } catch (error) {
      console.error('Failed to update app settings:', error);
    }
  }

  private static applySettingsChanges(updates: Partial<AppSettings>): void {
    // Theme changes
    if (updates.theme) {
      this.applyTheme(updates.theme);
    }

    // Performance mode changes
    if (updates.performanceMode) {
      this.applyPerformanceMode(updates.performanceMode);
    }

    // Language changes
    if (updates.language) {
      // This would trigger i18n updates if implemented
      console.log('Language changed to:', updates.language);
    }
  }

  private static applyTheme(theme: 'light' | 'dark' | 'system'): void {
    const root = document.documentElement;
    
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }

  private static applyPerformanceMode(mode: 'high' | 'medium' | 'low'): void {
    // This would adjust 3D rendering settings
    const perfSettings = {
      high: { shadows: true, antialiasing: 4, particleCount: 1000 },
      medium: { shadows: true, antialiasing: 2, particleCount: 500 },
      low: { shadows: false, antialiasing: 1, particleCount: 100 },
    };

    const settings = perfSettings[mode];
    console.log('Performance mode changed:', mode, settings);
    
    // Apply to 3D engine if available
    try {
      (window as any).scene3D?.setPerformanceMode?.(mode, settings);
    } catch {}
  }

  // Recent projects management
  static addRecentProject(projectName: string): void {
    const settings = this.getSettings();
    const recent = settings.recentProjects.filter(name => name !== projectName);
    recent.unshift(projectName);
    
    // Keep only last 10 projects
    const updated = recent.slice(0, 10);
    
    this.updateSettings({ recentProjects: updated });
  }

  static removeRecentProject(projectName: string): void {
    const settings = this.getSettings();
    const updated = settings.recentProjects.filter(name => name !== projectName);
    this.updateSettings({ recentProjects: updated });
  }

  // Performance monitoring
  static recordPerformanceMetrics(metrics: PerformanceMetrics): void {
    try {
      const stored = localStorage.getItem(this.METRICS_KEY);
      const history = stored ? JSON.parse(stored) : [];
      
      history.push({
        ...metrics,
        timestamp: Date.now(),
      });
      
      // Keep only last 50 entries
      const trimmed = history.slice(-50);
      localStorage.setItem(this.METRICS_KEY, JSON.stringify(trimmed));
    } catch {}
  }

  static getPerformanceHistory(): (PerformanceMetrics & { timestamp: number })[] {
    try {
      const stored = localStorage.getItem(this.METRICS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  static getAveragePerformance(): PerformanceMetrics | null {
    const history = this.getPerformanceHistory().slice(-10); // Last 10 records
    if (history.length === 0) return null;

    const sum = history.reduce(
      (acc, curr) => ({
        frameRate: acc.frameRate + curr.frameRate,
        memoryUsage: acc.memoryUsage + curr.memoryUsage,
        triangleCount: acc.triangleCount + curr.triangleCount,
        drawCalls: acc.drawCalls + curr.drawCalls,
        loadTime: acc.loadTime + curr.loadTime,
      }),
      { frameRate: 0, memoryUsage: 0, triangleCount: 0, drawCalls: 0, loadTime: 0 }
    );

    return {
      frameRate: Math.round(sum.frameRate / history.length),
      memoryUsage: Math.round(sum.memoryUsage / history.length),
      triangleCount: Math.round(sum.triangleCount / history.length),
      drawCalls: Math.round(sum.drawCalls / history.length),
      loadTime: Math.round(sum.loadTime / history.length),
    };
  }

  // Session management
  static saveSessionData(data: Record<string, any>): void {
    try {
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(data));
    } catch {}
  }

  static getSessionData(): Record<string, any> {
    try {
      const stored = sessionStorage.getItem(this.SESSION_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  static clearSessionData(): void {
    try {
      sessionStorage.removeItem(this.SESSION_KEY);
    } catch {}
  }

  // Feature flags and capabilities detection
  static getCapabilities() {
    return {
      webGL: this.detectWebGL(),
      webGL2: this.detectWebGL2(),
      webAssembly: this.detectWebAssembly(),
      serviceWorker: 'serviceWorker' in navigator,
      indexedDB: 'indexedDB' in window,
      localStorage: this.detectLocalStorage(),
      touchDevice: 'ontouchstart' in window,
      mobile: this.detectMobile(),
      performanceAPI: 'performance' in window,
    };
  }

  private static detectWebGL(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch {
      return false;
    }
  }

  private static detectWebGL2(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!canvas.getContext('webgl2');
    } catch {
      return false;
    }
  }

  private static detectWebAssembly(): boolean {
    return typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
  }

  private static detectLocalStorage(): boolean {
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      return true;
    } catch {
      return false;
    }
  }

  private static detectMobile(): boolean {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // Debug utilities
  static enableDebugMode(): void {
    this.updateSettings({ debugMode: true });
    (window as any).DEBUG_MODE = true;
    console.log('Debug mode enabled');
  }

  static disableDebugMode(): void {
    this.updateSettings({ debugMode: false });
    (window as any).DEBUG_MODE = false;
    console.log('Debug mode disabled');
  }

  static exportDiagnostics(): string {
    const data = {
      settings: this.getSettings(),
      capabilities: this.getCapabilities(),
      performance: this.getPerformanceHistory().slice(-5),
      session: this.getSessionData(),
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    return JSON.stringify(data, null, 2);
  }

  // Cleanup
  static cleanup(): void {
    try {
      // Remove old performance data (older than 7 days)
      const history = this.getPerformanceHistory();
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const filtered = history.filter(entry => entry.timestamp > weekAgo);
      localStorage.setItem(this.METRICS_KEY, JSON.stringify(filtered));

      // Clear session data
      this.clearSessionData();
    } catch {}
  }
}
