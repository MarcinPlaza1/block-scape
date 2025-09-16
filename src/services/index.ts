// Services barrel export
// Centralized access to all application services

// API services - type-safe API methods
export { 
  AuthService, 
  ProjectService, 
  FriendsService, 
  ChatService, 
  NewsService 
} from './api.service';

// Business logic services
export { 
  ProjectManagerService,
  type ProjectSaveOptions,
  type ProjectValidationResult 
} from './project-manager.service';

// Application state management
export { AppStateService } from './app-state.service';

// Service factory for dependency injection pattern (future extensibility)
export class ServiceFactory {
  private static instances = new Map();
  
  static getAuthService() {
    return AuthService;
  }
  
  static getProjectService() {
    return ProjectService;
  }
  
  static getProjectManager() {
    return ProjectManagerService;
  }
  
  static getAppStateService() {
    return AppStateService;
  }
  
  static getFriendsService() {
    return FriendsService;
  }
  
  static getChatService() {
    return ChatService;
  }
  
  static getNewsService() {
    return NewsService;
  }
}
