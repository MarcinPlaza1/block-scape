export const PROFILE_CONSTANTS = {
  AVATAR: {
    MAX_SIZE: 500 * 1024, // 500KB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    ACCEPT_ATTRIBUTE: 'image/jpeg,image/png,image/gif,image/webp',
  },
  VALIDATION: {
    NAME: {
      MIN_LENGTH: 2,
      MAX_LENGTH: 64,
    },
    PASSWORD: {
      MIN_LENGTH: 6,
    },
  },
  MESSAGES: {
    SUCCESS: {
      PROFILE_UPDATED: 'Dane profilu zostały pomyślnie zapisane.',
      PASSWORD_CHANGED: 'Twoje hasło zostało pomyślnie zmienione.',
      ACCOUNT_DELETED: 'Twoje konto zostało pomyślnie usunięte.',
    },
    ERROR: {
      PROFILE_UPDATE_FAILED: 'Aktualizacja profilu nie powiodła się.',
      PASSWORD_CHANGE_FAILED: 'Zmiana hasła nie powiodła się.',
      ACCOUNT_DELETE_FAILED: 'Usuwanie konta nie powiodło się.',
      FILE_READ_ERROR: 'Nie można odczytać wybranego pliku.',
      UNEXPECTED_ERROR: 'Nieoczekiwany błąd',
    },
    VALIDATION: {
      NAME_REQUIRED: 'Nazwa jest wymagana',
      NAME_TOO_SHORT: 'Nazwa musi mieć co najmniej 2 znaki',
      NAME_TOO_LONG: 'Nazwa nie może przekraczać 64 znaków',
      PASSWORD_REQUIRED: 'Hasło jest wymagane',
      PASSWORD_TOO_SHORT: 'Hasło musi mieć co najmniej 6 znaków',
      PASSWORDS_NOT_MATCH: 'Hasła nie są identyczne',
      INVALID_FILE_TYPE: 'Nieprawidłowy typ pliku. Dozwolone: JPEG, PNG, GIF, WebP',
      FILE_TOO_LARGE: 'Plik jest zbyt duży. Maksymalny rozmiar: 500KB',
    },
  },
} as const;
