import 'dotenv/config';

const config = {
  // Server configuration
  port: Number(process.env.PORT || 3001),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:9000',
    credentials: true
  },
  
  // JWT and Auth configuration
  auth: {
    accessTokenTTL: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTokenTTLDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30),
    refreshCookieName: process.env.REFRESH_COOKIE_NAME || 'refresh_token',
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
  },
  
  // Express configuration
  express: {
    jsonLimit: '6mb'
  },
  
  // In-memory demo content
  news: [
    {
      id: 'water-glass',
      title: 'Nowe bloki w edytorze: Woda i Szkło!',
      description: 'Zanurz się w kreatywności dzięki nowym, realistycznym blokom wody i szkła.',
      image: '/news-water-glass.svg',
      date: '2024-07-20',
      category: 'Aktualizacja',
      href: '/news/water-glass',
      content:
        'Wprowadziliśmy dwa nowe bloki: Woda oraz Szkło.\n\nWoda umożliwia tworzenie jezior i rzek, a Szkło pozwala budować efektowne konstrukcje.\n\nSkorzystaj z trybu Budowy, aby dodać nowe bloki do świata i udostępnij efekty!'
    },
    {
      id: 'castle-contest',
      title: 'Konkurs na najlepszy zamek',
      description: 'Pokaż swoje umiejętności i wygraj nagrody w konkursie budowlanym.',
      image: '/news-castle-contest.svg',
      date: '2024-07-18',
      category: 'Społeczność',
      href: '/news/castle-contest',
      content:
        'Zapraszamy do udziału w konkursie na najlepszy zamek!\n\nOpublikuj swój projekt i wyślij link do 31 sierpnia.\n\nNajlepsze prace wyróżnimy na stronie głównej.'
    },
  ],
  
  // Security settings
  security: {
    bcryptRounds: 10,
    tokenBytesLength: 48,
    maxPasswordLength: 128,
    minPasswordLength: 6,
    maxNameLength: 64,
    minNameLength: 2,
    maxMessageLength: 1000,
    maxAvatarSize: 5000000, // 5MB
    maxThumbnailSize: 5000000, // 5MB
    maxGuestNameLength: 20,
    maxScoreTimeMs: 10 * 60 * 1000, // 10 minutes
    // CSRF double-submit cookie/header names and TTL
    csrf: {
      cookieName: process.env.CSRF_COOKIE_NAME || 'csrf_token',
      headerName: process.env.CSRF_HEADER_NAME || 'x-csrf-token',
      cookieMaxAgeMs: 24 * 60 * 60 * 1000
    },
    // Simple in-memory rate limits
    rateLimit: {
      login: {
        windowMs: Number(process.env.RL_LOGIN_WINDOW_MS || 10 * 60 * 1000),
        maxPerIp: Number(process.env.RL_LOGIN_MAX || 100)
      },
      refresh: {
        windowMs: Number(process.env.RL_REFRESH_WINDOW_MS || 60 * 1000),
        maxPerIp: Number(process.env.RL_REFRESH_MAX || 30)
      }
    },
    // Brute-force lock policy (per IP+email)
    bruteforce: {
      windowMs: Number(process.env.BF_WINDOW_MS || 15 * 60 * 1000),
      maxFailures: Number(process.env.BF_MAX_FAILURES || 5),
      lockoutMs: Number(process.env.BF_LOCKOUT_MS || 15 * 60 * 1000)
    }
  },
  
  // Pagination defaults
  pagination: {
    defaultLimit: 12,
    maxLimit: 50,
    defaultNewsLimit: 10,
    defaultChatHistoryLimit: 50,
    defaultMessagesLimit: 50
  },
  
  // Session defaults
  session: {
    defaultMaxParticipants: 10,
    publicPlayMaxParticipants: 20,
    defaultSessionType: 'edit',
    validSessionTypes: ['edit', 'play']
  },
  
  // API Routes configuration
  routes: {
    auth: '/api/auth',
    users: '/api/users',
    friends: '/api/friends',
    chat: '/api/chat',
    games: '/api/games',
    news: '/api/news',
    realtime: '/api/realtime'
  },
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    pretty: process.env.LOG_PRETTY === '1' || process.env.NODE_ENV !== 'production'
  }
};

// Validate required configuration
const requiredEnvVars = [];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 && config.nodeEnv === 'production') {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

export default config;
