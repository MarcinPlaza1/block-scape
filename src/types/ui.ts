// UI component and state types
// Shared types for UI components and interactions

export type ThemeMode = 'light' | 'dark' | 'system';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Modal and dialog types
export interface ModalState {
  isOpen: boolean;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  preventClose?: boolean;
}

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel?: () => void;
}

// Form types
export interface FormFieldError {
  message: string;
  code?: string;
}

export interface FormValidationState<T = any> {
  errors: Partial<Record<keyof T, FormFieldError>>;
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
}

// Navigation and routing
export interface NavigationItem {
  id: string;
  label: string;
  href?: string;
  icon?: React.ComponentType<any>;
  badge?: string | number;
  disabled?: boolean;
  children?: NavigationItem[];
}

export interface Breadcrumb {
  label: string;
  href?: string;
  isActive?: boolean;
}

// Loading states
export type LoadingState = 
  | 'idle' 
  | 'loading' 
  | 'success' 
  | 'error';

export interface AsyncState<T = any> {
  status: LoadingState;
  data?: T;
  error?: string;
  lastFetch?: number;
}

// Editor UI types
export interface ToolbarItem {
  id: string;
  label: string;
  icon?: React.ComponentType<any>;
  shortcut?: string;
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
  children?: ToolbarItem[];
}

export interface PanelState {
  id: string;
  title: string;
  isOpen: boolean;
  position: 'left' | 'right' | 'top' | 'bottom';
  size: number; // percentage or pixels
  minSize?: number;
  maxSize?: number;
  resizable?: boolean;
  collapsible?: boolean;
}

// Context menu
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ComponentType<any>;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  onClick?: () => void;
  children?: ContextMenuItem[];
}

// Drag and drop
export interface DragDropItem<T = any> {
  id: string;
  type: string;
  data: T;
  preview?: React.ReactNode;
}

export interface DropZoneProps {
  accepts: string[];
  onDrop: (item: DragDropItem) => void;
  canDrop?: (item: DragDropItem) => boolean;
  className?: string;
  activeClassName?: string;
  children?: React.ReactNode;
}

// Animation and transition types
export interface AnimationConfig {
  duration: number;
  easing: string;
  delay?: number;
}

export interface TransitionState {
  isEntering: boolean;
  isExiting: boolean;
  hasEntered: boolean;
  hasExited: boolean;
}

// Color and theme
export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  warning: string;
  success: string;
  info: string;
}

export interface ThemeConfig {
  colors: {
    light: ColorPalette;
    dark: ColorPalette;
  };
  fonts: {
    sans: string[];
    mono: string[];
  };
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  shadows: Record<string, string>;
  breakpoints: Record<string, string>;
}

// Virtual scrolling
export interface VirtualScrollItem {
  id: string;
  height: number;
  data: any;
}

export interface VirtualScrollState {
  startIndex: number;
  endIndex: number;
  scrollTop: number;
  totalHeight: number;
  visibleRange: [number, number];
}

// Search and filtering
export interface SearchState {
  query: string;
  filters: Record<string, any>;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  results?: any[];
  totalResults?: number;
  isSearching?: boolean;
}

export interface FilterOption {
  id: string;
  label: string;
  value: any;
  count?: number;
  disabled?: boolean;
}

// Selection and multi-select
export interface SelectionState<T = any> {
  selected: Set<string>;
  lastSelected?: string;
  selectionMode: 'single' | 'multiple' | 'range';
  items: T[];
}

// Keyboard shortcuts
export interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
  handler: (event: KeyboardEvent) => void;
  category?: string;
  enabled?: boolean;
}
