import config from '../config/config.js';

/**
 * Parse pagination parameters from query
 */
export function parsePagination(query, defaults = {}) {
  const page = Math.max(1, Number(query.page || defaults.page || 1));
  const limit = Math.min(
    defaults.maxLimit || config.pagination.maxLimit,
    Math.max(1, Number(query.limit || defaults.limit || config.pagination.defaultLimit))
  );
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

/**
 * Format pagination response
 */
export function formatPaginationResponse(items, total, page, limit) {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasMore: page * limit < total,
    hasPrevious: page > 1
  };
}

/**
 * Parse sort parameter
 */
export function parseSort(sort, allowedFields, defaultSort = {}) {
  const sortMap = {
    'updated_asc': { updatedAt: 'asc' },
    'updated_desc': { updatedAt: 'desc' },
    'created_asc': { createdAt: 'asc' },
    'created_desc': { createdAt: 'desc' },
    'name_asc': { name: 'asc' },
    'name_desc': { name: 'desc' },
    'likes_asc': { likes: 'asc' },
    'likes_desc': { likes: 'desc' }
  };
  
  // Check if sort is in predefined map
  if (sortMap[sort]) {
    const sortObj = sortMap[sort];
    const field = Object.keys(sortObj)[0];
    
    // Check if field is allowed
    if (allowedFields.includes(field)) {
      return sortObj;
    }
  }
  
  // Parse custom sort format: field:direction
  if (sort && sort.includes(':')) {
    const [field, direction] = sort.split(':');
    if (allowedFields.includes(field) && ['asc', 'desc'].includes(direction)) {
      return { [field]: direction };
    }
  }
  
  return defaultSort;
}

/**
 * Clean and validate search query
 */
export function cleanSearchQuery(query) {
  if (!query || typeof query !== 'string') {
    return '';
  }
  
  // Remove special characters that could break searches
  let cleaned = query.trim();
  cleaned = cleaned.replace(/[<>]/g, '');
  
  // Limit length
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 100);
  }
  
  return cleaned;
}

/**
 * Format date for response
 */
export function formatDate(date) {
  if (!date) return null;
  return date instanceof Date ? date.toISOString() : date;
}

/**
 * Generate unique ID
 */
export function generateId(prefix = '') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Check if user is guest
 */
export function isGuest(userId) {
  return userId && userId.startsWith('guest_');
}

/**
 * Return canonical ordered pair [a,b] so that a <= b lexicographically.
 */
export function canonicalPair(idA, idB) {
  if (typeof idA !== 'string' || typeof idB !== 'string') {
    return [idA, idB];
  }
  return idA <= idB ? [idA, idB] : [idB, idA];
}

/**
 * Sleep for specified milliseconds (for testing/delays)
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry(fn, options = {}) {
  const {
    retries = 3,
    initialDelay = 100,
    maxDelay = 5000,
    factor = 2,
    onError = null
  } = options;
  
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (onError) {
        onError(error, i);
      }
      
      if (i < retries - 1) {
        const delay = Math.min(initialDelay * Math.pow(factor, i), maxDelay);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Batch array into chunks
 */
export function batchArray(array, batchSize) {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Debounce function
 */
export function debounce(fn, delay) {
  let timeoutId;
  
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Deep clone object (simple version)
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  
  const cloned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  
  return cloned;
}

/**
 * Pick specific fields from object
 */
export function pick(obj, fields) {
  const picked = {};
  for (const field of fields) {
    if (obj.hasOwnProperty(field)) {
      picked[field] = obj[field];
    }
  }
  return picked;
}

/**
 * Omit specific fields from object
 */
export function omit(obj, fields) {
  const result = { ...obj };
  for (const field of fields) {
    delete result[field];
  }
  return result;
}
