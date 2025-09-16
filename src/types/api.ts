// API-related type definitions
// Standardized request/response types for all API endpoints

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Authentication API types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: import('./profile').UserProfile;
  refreshToken?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// Project API types
export interface CreateProjectRequest {
  name: string;
  blocks: any[];
  terrain?: any;
  thumbnail?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  blocks?: any[];
  terrain?: any;
  thumbnail?: string;
  published?: boolean;
}

export interface ProjectResponse {
  game: import('./project').ProjectData;
}

export interface ProjectListResponse {
  games: import('./project').ProjectData[];
}

// Friends API types
export interface SendFriendRequestRequest {
  userId: string;
}

export interface FriendRequestResponse {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  fromUser?: import('./profile').UserProfile;
  toUser?: import('./profile').UserProfile;
}

export interface FriendsListResponse {
  friends: (import('./profile').UserProfile & { friendshipId: string })[];
  requests: FriendRequestResponse[];
}

// Chat API types
export interface SendMessageRequest {
  content: string;
  recipientId?: string; // For private messages
}

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  recipientId?: string; // null for global chat
  createdAt: string;
  readAt?: string;
  sender?: import('./profile').UserProfile;
  recipient?: import('./profile').UserProfile;
}

export interface MessagesResponse {
  messages: ChatMessage[];
  unreadCount: number;
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface ValidationError extends ApiError {
  code: 'VALIDATION_ERROR';
  details: Record<string, string[]>; // field -> error messages
}

export interface AuthError extends ApiError {
  code: 'AUTH_ERROR' | 'TOKEN_EXPIRED' | 'INVALID_CREDENTIALS';
}

export interface NotFoundError extends ApiError {
  code: 'NOT_FOUND';
  details: {
    resource: string;
    id: string;
  };
}

// Upload types
export interface FileUploadRequest {
  file: File;
  type: 'avatar' | 'thumbnail' | 'asset';
  maxSize?: number; // in bytes
}

export interface FileUploadResponse {
  url: string;
  filename: string;
  size: number;
  contentType: string;
}
