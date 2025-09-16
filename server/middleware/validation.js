import config from '../config/config.js';
import { ValidationError } from './errorHandler.js';

/**
 * Validate request body against a schema
 */
export function validateBody(schema) {
  return (req, res, next) => {
    try {
      const errors = [];
      
      for (const [field, rules] of Object.entries(schema)) {
        const value = req.body[field];
        
        // Check required fields
        if (rules.required && (value === undefined || value === null || value === '')) {
          errors.push(`${field} is required`);
          continue;
        }
        
        // Skip validation if field is optional and not provided
        if (!rules.required && (value === undefined || value === null)) {
          continue;
        }
        
        // Type validation
        if (rules.type) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (actualType !== rules.type) {
            errors.push(`${field} must be of type ${rules.type}`);
            continue;
          }
        }
        
        // String validations
        if (rules.type === 'string') {
          if (rules.minLength && value.length < rules.minLength) {
            errors.push(`${field} must be at least ${rules.minLength} characters long`);
          }
          if (rules.maxLength && value.length > rules.maxLength) {
            errors.push(`${field} must be at most ${rules.maxLength} characters long`);
          }
          if (rules.pattern && !rules.pattern.test(value)) {
            errors.push(`${field} has invalid format`);
          }
          if (rules.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`${field} must be a valid email address`);
          }
        }
        
        // Number validations
        if (rules.type === 'number') {
          const num = Number(value);
          if (isNaN(num)) {
            errors.push(`${field} must be a valid number`);
            continue;
          }
          if (rules.min !== undefined && num < rules.min) {
            errors.push(`${field} must be at least ${rules.min}`);
          }
          if (rules.max !== undefined && num > rules.max) {
            errors.push(`${field} must be at most ${rules.max}`);
          }
        }
        
        // Array validations
        if (rules.type === 'array') {
          if (rules.minItems && value.length < rules.minItems) {
            errors.push(`${field} must have at least ${rules.minItems} items`);
          }
          if (rules.maxItems && value.length > rules.maxItems) {
            errors.push(`${field} must have at most ${rules.maxItems} items`);
          }
        }
        
        // Boolean validation
        if (rules.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`${field} must be a boolean`);
        }
        
        // Enum validation
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
        }
        
        // Custom validation
        if (rules.custom) {
          const customError = rules.custom(value, req.body);
          if (customError) {
            errors.push(customError);
          }
        }
      }
      
      if (errors.length > 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: errors.join('; ')
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Common validation schemas
 */
export const schemas = {
  // Auth schemas
  register: {
    email: {
      required: true,
      type: 'string',
      email: true,
      maxLength: 255
    },
    password: {
      required: true,
      type: 'string',
      minLength: config.security.minPasswordLength,
      maxLength: config.security.maxPasswordLength
    },
    name: {
      required: true,
      type: 'string',
      minLength: config.security.minNameLength,
      maxLength: config.security.maxNameLength
    }
  },
  
  login: {
    email: {
      required: true,
      type: 'string',
      email: true
    },
    password: {
      required: true,
      type: 'string'
    }
  },
  
  changePassword: {
    oldPassword: {
      required: true,
      type: 'string'
    },
    newPassword: {
      required: true,
      type: 'string',
      minLength: config.security.minPasswordLength,
      maxLength: config.security.maxPasswordLength
    }
  },
  
  // User schemas
  updateProfile: {
    name: {
      required: false,
      type: 'string',
      minLength: config.security.minNameLength,
      maxLength: config.security.maxNameLength
    },
    avatarUrl: {
      required: false,
      type: 'string',
      custom: (value) => {
        if (value && value.length > config.security.maxAvatarSize) {
          return 'Avatar size too large';
        }
        return null;
      }
    },
    skinId: {
      required: false,
      type: 'string',
      enum: ['blocky','capsule','robot','kogama']
    },
    skinPrimary: {
      required: false,
      type: 'number',
      min: 0,
      max: 16777215
    },
    skinSecondary: {
      required: false,
      type: 'number',
      min: 0,
      max: 16777215
    },
    skinConfig: {
      required: false,
      type: 'object',
      custom: (value) => {
        try {
          const json = JSON.stringify(value);
          if (json.length > 5000) return 'skinConfig too large';
        } catch { return 'Invalid skinConfig'; }
        return null;
      }
    }
  },
  
  // Friend schemas
  sendFriendRequest: {
    receiverId: {
      required: true,
      type: 'string'
    },
    message: {
      required: false,
      type: 'string',
      maxLength: 200
    }
  },
  
  // Chat schemas
  sendMessage: {
    content: {
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: config.security.maxMessageLength
    },
    messageType: {
      required: false,
      type: 'string',
      enum: ['text', 'system', 'action']
    }
  },
  
  // Game schemas
  createGame: {
    name: {
      required: false,
      type: 'string',
      minLength: config.security.minNameLength,
      maxLength: 200
    },
    blocks: {
      required: false,
      type: 'array'
    },
    mode: {
      required: false,
      type: 'string',
      enum: ['PARKOUR', 'PVP', 'RACE', 'SANDBOX']
    },
    modeConfig: {
      required: false,
      type: 'string'
    },
    terrain: {
      required: false,
      type: 'string'
    },
    published: {
      required: false,
      type: 'boolean'
    },
    visibility: {
      required: false,
      type: 'string',
      enum: ['PRIVATE', 'FRIENDS', 'PUBLIC']
    },
    thumbnail: {
      required: false,
      type: 'string',
      custom: (value) => {
        if (!value) return null;
        if (value.length > config.security.maxThumbnailSize) return 'Thumbnail size too large';
        // Optional: basic data URL validation
        if (!/^data:image\/(png|jpeg|jpg);base64,/.test(value)) return 'Thumbnail must be PNG or JPEG data URL';
        return null;
      }
    }
  },
  // Comment schemas
  createComment: {
    content: {
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 1000
    }
  },
  updateComment: {
    content: {
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 1000
    }
  },
  updateVisibility: {
    visibility: {
      required: true,
      type: 'string',
      enum: ['PRIVATE', 'FRIENDS', 'PUBLIC']
    }
  },
  shareGame: {
    userId: {
      required: true,
      type: 'string'
    },
    role: {
      required: true,
      type: 'string',
      enum: ['VIEWER', 'EDITOR']
    }
  },
  
  // Session schemas
  createSession: {
    gameId: {
      required: true,
      type: 'string'
    },
    type: {
      required: false,
      type: 'string',
      enum: config.session.validSessionTypes
    },
    maxParticipants: {
      required: false,
      type: 'number',
      min: 1,
      max: 100
    }
  },
  updateSessionSettings: {
    maxParticipants: {
      required: true,
      type: 'number',
      min: 1,
      max: 200
    }
  },
  
  // Score schemas
  submitScore: {
    timeMs: {
      required: true,
      type: 'number',
      min: 1,
      max: config.security.maxScoreTimeMs
    }
  }
};

/**
 * Sanitize user input
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length to prevent DoS
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000);
  }
  
  return sanitized;
}

/**
 * Middleware to sanitize all string inputs in body
 */
export function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    }
  }
  next();
}
