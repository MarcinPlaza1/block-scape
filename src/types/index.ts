// Types barrel export
// Centralized access to all type definitions

// Core domain types
export * from './profile';
export * from './project';

// API and communication types
export * from './api';

// UI and component types
export * from './ui';

// Editor and 3D types
export * from './editor';

// Global utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Partial<T> = { [P in keyof T]?: T[P] };
export type Required<T> = { [P in keyof T]-?: T[P] };

// Event handler types
export type EventHandler<T = void> = (data: T) => void;
export type AsyncEventHandler<T = void> = (data: T) => Promise<void>;

// Generic CRUD operation types
export interface CrudOperations<T, CreateData = Partial<T>, UpdateData = Partial<T>> {
  create: (data: CreateData) => Promise<T>;
  read: (id: string) => Promise<T>;
  update: (id: string, data: UpdateData) => Promise<T>;
  delete: (id: string) => Promise<void>;
  list: (options?: ListOptions) => Promise<PaginatedResult<T>>;
}

export interface ListOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: Record<string, any>;
  search?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// State management types
export interface StoreState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

export interface StoreActions<T> {
  set: (data: T) => void;
  update: (updater: (current: T) => T) => void;
  reset: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// Validation types
export interface ValidationRule<T> {
  validate: (value: T) => boolean | string;
  message?: string;
  when?: (data: any) => boolean;
}

export interface ValidationSchema<T> {
  [K in keyof T]?: ValidationRule<T[K]>[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
  warnings: Record<string, string[]>;
}

// Configuration types
export interface AppConfig {
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
  };
  editor: {
    autoSave: boolean;
    autoSaveInterval: number;
    maxUndoHistory: number;
    defaultCameraMode: import('./editor').CameraMode;
  };
  rendering: {
    defaultQuality: 'low' | 'medium' | 'high';
    enableHardwareAcceleration: boolean;
    maxTextures: number;
    maxLights: number;
  };
  features: {
    multiplayer: boolean;
    terrain: boolean;
    physics: boolean;
    vr: boolean;
  };
}

// Hook return types for consistency
export interface UseAsyncReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: any[]) => Promise<void>;
  reset: () => void;
}

export interface UseToggleReturn {
  value: boolean;
  toggle: () => void;
  setTrue: () => void;
  setFalse: () => void;
  setValue: (value: boolean) => void;
}

export interface UseCounterReturn {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  set: (count: number) => void;
}

// WebSocket and real-time types
export interface WebSocketMessage<T = any> {
  type: string;
  data: T;
  timestamp: number;
  id?: string;
}

export interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
  reconnectAttempts: number;
}

// File and media types
export interface FileInfo {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  data?: ArrayBuffer | string;
}

export interface ImageInfo extends FileInfo {
  width: number;
  height: number;
  aspectRatio: number;
}

// Performance monitoring types
export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  category: 'rendering' | 'memory' | 'network' | 'interaction';
}

export interface PerformanceProfile {
  metrics: PerformanceMetric[];
  averages: Record<string, number>;
  peaks: Record<string, number>;
  startTime: number;
  endTime: number;
}
