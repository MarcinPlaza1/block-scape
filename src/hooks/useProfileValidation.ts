import { useCallback } from 'react';
import { ProfileFormErrors } from '@/types/profile';

export const useProfileValidation = () => {
  const validateName = useCallback((name: string): string | undefined => {
    if (!name.trim()) return 'Nazwa jest wymagana';
    if (name.trim().length < 2) return 'Nazwa musi mieć co najmniej 2 znaki';
    if (name.trim().length > 64) return 'Nazwa nie może przekraczać 64 znaków';
    return undefined;
  }, []);

  const validatePassword = useCallback((password: string): string | undefined => {
    if (!password) return 'Hasło jest wymagane';
    if (password.length < 6) return 'Hasło musi mieć co najmniej 6 znaków';
    return undefined;
  }, []);

  const validateAvatar = useCallback((file: File): string | undefined => {
    const maxSize = 500 * 1024; // 500KB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!allowedTypes.includes(file.type)) {
      return 'Nieprawidłowy typ pliku. Dozwolone: JPEG, PNG, GIF, WebP';
    }
    if (file.size > maxSize) {
      return 'Plik jest zbyt duży. Maksymalny rozmiar: 500KB';
    }
    return undefined;
  }, []);

  const validatePasswordChange = useCallback((
    oldPassword: string, 
    newPassword: string, 
    confirmPassword: string
  ): ProfileFormErrors => {
    const errors: ProfileFormErrors = {};
    
    const oldPasswordError = validatePassword(oldPassword);
    const newPasswordError = validatePassword(newPassword);
    const confirmPasswordError = newPassword !== confirmPassword 
      ? 'Hasła nie są identyczne' 
      : undefined;

    if (oldPasswordError) errors.oldPassword = oldPasswordError;
    if (newPasswordError) errors.newPassword = newPasswordError;
    if (confirmPasswordError) errors.confirmPassword = confirmPasswordError;

    return errors;
  }, [validatePassword]);

  return {
    validateName,
    validatePassword,
    validateAvatar,
    validatePasswordChange,
  };
};
