import { renderHook } from '@testing-library/react';
import { useProfileValidation } from './useProfileValidation';

describe('useProfileValidation', () => {
  it('should validate name correctly', () => {
    const { result } = renderHook(() => useProfileValidation());
    const { validateName } = result.current;

    // Valid names
    expect(validateName('John')).toBeUndefined();
    expect(validateName('  John  ')).toBeUndefined(); // trimmed
    expect(validateName('A'.repeat(64))).toBeUndefined(); // max length

    // Invalid names
    expect(validateName('')).toBe('Nazwa jest wymagana');
    expect(validateName('   ')).toBe('Nazwa jest wymagana');
    expect(validateName('A')).toBe('Nazwa musi mieć co najmniej 2 znaki');
    expect(validateName('A'.repeat(65))).toBe('Nazwa nie może przekraczać 64 znaków');
  });

  it('should validate password correctly', () => {
    const { result } = renderHook(() => useProfileValidation());
    const { validatePassword } = result.current;

    // Valid passwords
    expect(validatePassword('password123')).toBeUndefined();
    expect(validatePassword('123456')).toBeUndefined(); // min length

    // Invalid passwords
    expect(validatePassword('')).toBe('Hasło jest wymagane');
    expect(validatePassword('12345')).toBe('Hasło musi mieć co najmniej 6 znaków');
  });

  it('should validate avatar file correctly', () => {
    const { result } = renderHook(() => useProfileValidation());
    const { validateAvatar } = result.current;

    // Valid files
    const validJpegFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
    Object.defineProperty(validJpegFile, 'size', { value: 100 * 1024 }); // 100KB
    expect(validateAvatar(validJpegFile)).toBeUndefined();

    const validPngFile = new File([''], 'test.png', { type: 'image/png' });
    Object.defineProperty(validPngFile, 'size', { value: 200 * 1024 }); // 200KB
    expect(validateAvatar(validPngFile)).toBeUndefined();

    // Invalid files
    const invalidTypeFile = new File([''], 'test.txt', { type: 'text/plain' });
    Object.defineProperty(invalidTypeFile, 'size', { value: 100 * 1024 });
    expect(validateAvatar(invalidTypeFile)).toBe('Nieprawidłowy typ pliku. Dozwolone: JPEG, PNG, GIF, WebP');

    const tooLargeFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
    Object.defineProperty(tooLargeFile, 'size', { value: 600 * 1024 }); // 600KB
    expect(validateAvatar(tooLargeFile)).toBe('Plik jest zbyt duży. Maksymalny rozmiar: 500KB');
  });

  it('should validate password change correctly', () => {
    const { result } = renderHook(() => useProfileValidation());
    const { validatePasswordChange } = result.current;

    // Valid password change
    expect(validatePasswordChange('oldpass', 'newpass123', 'newpass123')).toEqual({});

    // Invalid password change
    const result1 = validatePasswordChange('', 'newpass123', 'newpass123');
    expect(result1.oldPassword).toBe('Hasło jest wymagane');

    const result2 = validatePasswordChange('oldpass', '12345', '12345');
    expect(result2.newPassword).toBe('Hasło musi mieć co najmniej 6 znaków');

    const result3 = validatePasswordChange('oldpass', 'newpass123', 'different');
    expect(result3.confirmPassword).toBe('Hasła nie są identyczne');

    // Multiple errors
    const result4 = validatePasswordChange('', '12345', 'different');
    expect(result4).toEqual({
      oldPassword: 'Hasło jest wymagane',
      newPassword: 'Hasło musi mieć co najmniej 6 znaków',
      confirmPassword: 'Hasła nie są identyczne',
    });
  });
});
