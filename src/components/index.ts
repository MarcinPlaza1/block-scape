// Main components barrel export
// Organized by business domains for better maintainability

// Authentication components
export { default as ProtectedRoute } from './auth/ProtectedRoute';

// Core application components (layout, navigation, theme)
export * from './core';

// Editor and 3D scene components  
export * from './editor-enhanced';

// Game and gameplay components
export * from './game';

// Social features (chat, friends, collaboration)
export * from './social';

// UI components (shadcn/ui based)
// These are kept as individual imports to maintain tree-shaking
// Import specific UI components as needed: import { Button } from '@/components/ui/button';
