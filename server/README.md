# Block Scape Studio - Backend

## Struktura projektu

Po refaktoryzacji backend został podzielony na następujące moduły:

### 📁 config/
- `config.js` - Główna konfiguracja aplikacji (porty, limity, ustawienia)
- `database.js` - Konfiguracja i singleton Prisma Client

### 📁 middleware/
- `auth.js` - Middleware autoryzacji (requireAuth, requireRole, optionalAuth)
- `errorHandler.js` - Globalna obsługa błędów i pomocniki (asyncHandler, klasy błędów)
- `validation.js` - Walidacja danych wejściowych i schematy walidacji

### 📁 utils/
- `auth.js` - Funkcje pomocnicze autoryzacji (JWT, sesje, hasła)
- `helpers.js` - Ogólne funkcje pomocnicze (paginacja, formatowanie)

### 📁 controllers/
- `authController.js` - Logika autoryzacji (login, register, refresh token)
- `userController.js` - Zarządzanie profilem użytkownika
- `friendsController.js` - System znajomych
- `chatController.js` - Czat globalny i prywatny
- `gamesController.js` - Zarządzanie grami
- `realtimeController.js` - Sesje real-time

### 📁 routes/
- `auth.js` - `/api/auth/*` - Trasy autoryzacji
- `users.js` - `/api/users/*` - Trasy użytkownika
- `friends.js` - `/api/friends/*` - Trasy znajomych
- `chat.js` - `/api/chat/*` - Trasy czatu
- `games.js` - `/api/games/*` - Trasy gier
// creators routes were removed
- `news.js` - `/api/news/*` - Trasy aktualności
- `realtime.js` - `/api/realtime/*` - Trasy sesji real-time

### 📄 index.js
Główny plik aplikacji - tylko konfiguracja Express i montowanie tras.

## Główne zmiany

1. **Modularyzacja** - Kod został podzielony na logiczne moduły
2. **Centralna konfiguracja** - Wszystkie ustawienia w jednym miejscu
3. **Lepsze middleware** - Walidacja, obsługa błędów, sanityzacja
4. **Czystsza struktura** - Separacja kontrolerów od tras
5. **Reużywalne helpery** - Wspólne funkcje w utils

## Uruchamianie

```bash
npm install
npm run dev
```

## Zmienne środowiskowe

Stwórz plik `.env` z następującymi zmiennymi:

```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:9000
JWT_ACCESS_SECRET=your-secret-key
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
REFRESH_COOKIE_NAME=refresh_token
```

## API Endpoints

### Autoryzacja
- `POST /api/auth/register` - Rejestracja
- `POST /api/auth/login` - Logowanie
- `POST /api/auth/refresh` - Odświeżanie tokenu
- `POST /api/auth/logout` - Wylogowanie
- `GET /api/auth/sessions` - Lista sesji
- `DELETE /api/auth/sessions/:id` - Usunięcie sesji

### Użytkownik
- `GET /api/users/me` - Profil użytkownika
- `PUT /api/users/me` - Aktualizacja profilu
- `DELETE /api/users/me` - Usunięcie konta
- `POST /api/users/me/password` - Zmiana hasła
- `GET /api/users/me/permissions` - Uprawnienia
- `GET /api/users/me/logins` - Historia logowań
- `GET /api/users/me/games` - Gry użytkownika

### Znajomi
- `GET /api/friends` - Lista znajomych
- `GET /api/friends/requests` - Zaproszenia
- `POST /api/friends/requests` - Wyślij zaproszenie
- `POST /api/friends/requests/:id/accept` - Akceptuj zaproszenie
- `POST /api/friends/requests/:id/reject` - Odrzuć zaproszenie
- `DELETE /api/friends/requests/:id` - Anuluj zaproszenie
- `DELETE /api/friends/:friendId` - Usuń znajomego
- `GET /api/friends/search` - Szukaj użytkowników
- `GET /api/friends/online` - Status online znajomych

### Czat
- `GET /api/chat/global/history` - Historia czatu globalnego
- `GET /api/chat/global/users` - Użytkownicy online
- `GET /api/chat/conversations` - Lista konwersacji
- `POST /api/chat/conversations` - Stwórz konwersację
- `GET /api/chat/conversations/:id/messages` - Wiadomości
- `POST /api/chat/conversations/:id/messages` - Wyślij wiadomość
- `GET /api/chat/unread-count` - Liczba nieprzeczytanych

### Gry
- `GET /api/games` - Lista publicznych gier
- `POST /api/games` - Stwórz grę
- `GET /api/games/:id` - Szczegóły gry (prywatne)
- `PUT /api/games/:id` - Aktualizuj grę
- `DELETE /api/games/:id` - Usuń grę
- `GET /api/games/:id/public` - Szczegóły gry (publiczne)
- `GET /api/games/:id/likes` - Status polubień
- `POST /api/games/:id/likes` - Polub grę
- `DELETE /api/games/:id/likes` - Usuń polubienie
- `GET /api/games/:id/leaderboard` - Ranking
- `POST /api/games/:id/leaderboard` - Dodaj wynik

### Real-time
- `POST /api/realtime/sessions` - Stwórz sesję
- `POST /api/realtime/sessions/:id/join` - Dołącz do sesji
- `POST /api/realtime/sessions/:id/join-guest` - Dołącz jako gość
- `POST /api/realtime/games/:gameId/join-play` - Dołącz do gry
- `GET /api/realtime/sessions/:id` - Szczegóły sesji
- `GET /api/realtime/sessions/:id/chat` - Historia czatu sesji
- `DELETE /api/realtime/sessions/:id` - Zamknij sesję

## WebSocket

Serwer WebSocket jest zintegrowany i nasłuchuje na tym samym porcie co HTTP.
Szczegóły implementacji znajdują się w `websocket.js` i folderze `websocket/`.
