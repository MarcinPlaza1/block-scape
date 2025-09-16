// Minimal in-memory error monitoring and request counters
import logger from '../utils/logger.js';

const counters = {
  requests: 0,
  errors: 0,
  lastErrorAt: null,
};

export function trackRequest() {
  counters.requests += 1;
}

export function trackError(err) {
  counters.errors += 1;
  counters.lastErrorAt = new Date().toISOString();
  // Basic log line for monitoring
  logger.error({ err }, 'Request failed');
}

export function getStats() {
  return { ...counters };
}

// Optional hook to flush on shutdown or integrate external services later
export function resetStats() {
  counters.requests = 0;
  counters.errors = 0;
  counters.lastErrorAt = null;
}


