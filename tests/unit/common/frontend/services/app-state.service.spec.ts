import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppStateService } from '@/services/app-state.service';

describe('services/app-state.service', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    // Ensure document root classList exists in jsdom
    Object.defineProperty(document, 'documentElement', { value: document.createElement('div'), writable: true });
    (document.documentElement as any).classList = {
      toggle: vi.fn(),
    } as any;
  });

  it('getDefaultSettings returns sane defaults', () => {
    const s = AppStateService.getDefaultSettings();
    expect(s.language).toBe('pl');
    expect(s.autoSave).toBe(true);
  });

  it('getSettings merges stored values with defaults and updateSettings persists', () => {
    AppStateService.updateSettings({ theme: 'dark', autoSaveInterval: 5 });
    const s = AppStateService.getSettings();
    expect(s.theme).toBe('dark');
    expect(s.autoSaveInterval).toBe(5);
  });

  it('add/remove recent projects maintain a capped list', () => {
    for (let i = 0; i < 12; i++) AppStateService.addRecentProject(`P${i}`);
    let s = AppStateService.getSettings();
    expect(s.recentProjects.length).toBeLessThanOrEqual(10);
    AppStateService.removeRecentProject(s.recentProjects[0]);
    s = AppStateService.getSettings();
    expect(s.recentProjects.length).toBeLessThanOrEqual(10);
  });

  it('recordPerformanceMetrics stores history with cap and getAveragePerformance computes mean', () => {
    for (let i = 0; i < 15; i++) {
      AppStateService.recordPerformanceMetrics({ frameRate: 60, memoryUsage: 100, triangleCount: 1000, drawCalls: 200, loadTime: 500 });
    }
    const hist = AppStateService.getPerformanceHistory();
    expect(hist.length).toBeLessThanOrEqual(50);
    const avg = AppStateService.getAveragePerformance();
    expect(avg?.frameRate).toBe(60);
  });

  it('session data save/get/clear works', () => {
    AppStateService.saveSessionData({ a: 1 });
    expect(AppStateService.getSessionData()).toEqual({ a: 1 });
    AppStateService.clearSessionData();
    expect(AppStateService.getSessionData()).toEqual({});
  });

  it('debug mode toggles global flag and updates settings', () => {
    AppStateService.enableDebugMode();
    expect((window as any).DEBUG_MODE).toBe(true);
    AppStateService.disableDebugMode();
    expect((window as any).DEBUG_MODE).toBe(false);
  });

  it('exportDiagnostics returns JSON string with essential fields', () => {
    const s = AppStateService.exportDiagnostics();
    const json = JSON.parse(s);
    expect(json.settings).toBeTruthy();
    expect(json.timestamp).toBeTruthy();
  });
});


