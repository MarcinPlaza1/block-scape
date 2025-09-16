export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  skinId?: 'blocky' | 'capsule' | 'robot' | 'kogama';
  skinPrimary?: number;
  skinSecondary?: number;
  skinConfig?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserPermissions {
  role: string;
  permissions: string[];
}

export interface LoginLog {
  id: string;
  action: string;
  createdAt: string;
}

export interface ProfileUpdateData {
  name?: string;
  avatarUrl?: string | null;
  skinId?: 'blocky' | 'capsule' | 'robot' | 'kogama';
  skinPrimary?: number;
  skinSecondary?: number;
  skinConfig?: Record<string, any>;
}

export interface PasswordChangeData {
  oldPassword: string;
  newPassword: string;
}

export interface ProfileFormErrors {
  name?: string;
  avatar?: string;
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export interface ProfileState {
  name: string;
  avatarPreview: string | null;
  role: string;
  permissions: string[];
  logins: LoginLog[];
  errors: ProfileFormErrors;
  isSubmitting: boolean;
  isChangingPassword: boolean;
  isDeletingAccount: boolean;
}
