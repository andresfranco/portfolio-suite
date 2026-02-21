/**
 * Frontend Input Validation & Sanitization Utilities
 * 
 * Provides client-side validation to complement server-side validation.
 * Never rely solely on client-side validation for security!
 * 
 * Usage:
 *   import { validateEmail, sanitizeString, isXSSSafe } from '@/utils/validators';
 *   
 *   if (!validateEmail(email)) {
 *     setError('Invalid email format');
 *   }
 */

// Dangerous patterns for XSS detection
const XSS_PATTERNS = [
  // Match script blocks even when closing tags contain whitespace/attributes
  // like </script\t\n bar>.
  /<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[^>]*>/gi,
  /<embed[^>]*>/gi,
  /<object[^>]*>/gi,
  /eval\s*\(/gi,
  /expression\s*\(/gi,
  /vbscript:/gi,
  /data:text\/html/gi,
];

// SQL injection patterns
const SQL_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi,
  /(--|#|\/\*|\*\/)/g,
  /(\bOR\b.*=.*)/gi,
  /(\bAND\b.*=.*)/gi,
];

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\./g,
  /\/etc\//g,
  /\/proc\//g,
  /file:\/\//gi,
];

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email) {
    return { isValid: false, error: 'Email cannot be empty' };
  }

  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailPattern.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  if (email.length > 254) {
    return { isValid: false, error: 'Email too long' };
  }

  return { isValid: true };
}

/**
 * Validate username format
 */
export function validateUsername(username: string): ValidationResult {
  if (!username) {
    return { isValid: false, error: 'Username cannot be empty' };
  }

  if (username.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters' };
  }

  if (username.length > 50) {
    return { isValid: false, error: 'Username cannot exceed 50 characters' };
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, and ._- characters' };
  }

  return { isValid: true };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: false, error: 'Password cannot be empty' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' };
  }

  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one lowercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number' };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one special character' };
  }

  return { isValid: true };
}

/**
 * Validate URL format
 */
export function validateUrl(url: string, allowedSchemes: string[] = ['http', 'https']): ValidationResult {
  if (!url) {
    return { isValid: false, error: 'URL cannot be empty' };
  }

  try {
    const parsed = new URL(url);
    
    if (!allowedSchemes.includes(parsed.protocol.replace(':', ''))) {
      return { isValid: false, error: `URL scheme must be one of: ${allowedSchemes.join(', ')}` };
    }

    if (url.length > 2048) {
      return { isValid: false, error: 'URL too long' };
    }

    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

/**
 * Check if string contains XSS patterns
 */
export function isXSSSafe(value: string): ValidationResult {
  if (!value) {
    return { isValid: true };
  }

  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(value)) {
      return { isValid: false, error: 'Potentially unsafe content detected' };
    }
  }

  return { isValid: true };
}

/**
 * Check if string contains SQL injection patterns
 */
export function isSQLSafe(value: string): ValidationResult {
  if (!value) {
    return { isValid: true };
  }

  for (const pattern of SQL_PATTERNS) {
    if (pattern.test(value)) {
      return { isValid: false, error: 'Potentially unsafe content detected' };
    }
  }

  return { isValid: true };
}

/**
 * Check if path contains traversal attempts
 */
export function isPathSafe(value: string): ValidationResult {
  if (!value) {
    return { isValid: true };
  }

  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(value)) {
      return { isValid: false, error: 'Invalid path format' };
    }
  }

  return { isValid: true };
}

/**
 * Sanitize string by removing dangerous characters
 */
export function sanitizeString(value: string, maxLength?: number): string {
  if (!value) {
    return '';
  }

  // Remove control characters (except common whitespace)
  let sanitized = value.replace(/[\x00-\x1F\x7F]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Truncate if needed
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize HTML by escaping dangerous characters
 */
export function sanitizeHTML(html: string): string {
  if (!html) {
    return '';
  }

  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Validate filename
 */
export function validateFilename(filename: string): ValidationResult {
  if (!filename) {
    return { isValid: false, error: 'Filename cannot be empty' };
  }

  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { isValid: false, error: 'Filename cannot contain path separators' };
  }

  if (/[\x00-\x1F]/.test(filename)) {
    return { isValid: false, error: 'Filename contains invalid characters' };
  }

  if (filename.length > 255) {
    return { isValid: false, error: 'Filename too long' };
  }

  const dangerousExtensions = ['exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar'];
  const ext = filename.split('.').pop()?.toLowerCase();
  
  if (ext && dangerousExtensions.includes(ext)) {
    return { isValid: false, error: `File extension '.${ext}' is not allowed` };
  }

  return { isValid: true };
}

/**
 * Validate slug format
 */
export function validateSlug(slug: string): ValidationResult {
  if (!slug) {
    return { isValid: false, error: 'Slug cannot be empty' };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { isValid: false, error: 'Slug must contain only lowercase letters, numbers, and hyphens' };
  }

  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { isValid: false, error: 'Slug cannot start or end with a hyphen' };
  }

  if (slug.includes('--')) {
    return { isValid: false, error: 'Slug cannot contain consecutive hyphens' };
  }

  return { isValid: true };
}

/**
 * Validate phone number (basic international format)
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  if (!phone) {
    return { isValid: false, error: 'Phone number cannot be empty' };
  }

  // Basic international phone format: +[country code][number]
  const phonePattern = /^\+?[1-9]\d{1,14}$/;
  
  // Remove common separators for validation
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

  if (!phonePattern.test(cleanPhone)) {
    return { isValid: false, error: 'Invalid phone number format' };
  }

  return { isValid: true };
}

/**
 * Validate hex color code
 */
export function validateHexColor(color: string): ValidationResult {
  if (!color) {
    return { isValid: false, error: 'Color cannot be empty' };
  }

  const hexPattern = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

  if (!hexPattern.test(color)) {
    return { isValid: false, error: 'Invalid hex color format' };
  }

  return { isValid: true };
}

/**
 * Validate positive integer
 */
export function validatePositiveInteger(value: number, maxValue?: number): ValidationResult {
  if (!Number.isInteger(value)) {
    return { isValid: false, error: 'Value must be an integer' };
  }

  if (value < 1) {
    return { isValid: false, error: 'Value must be positive' };
  }

  if (maxValue && value > maxValue) {
    return { isValid: false, error: `Value cannot exceed ${maxValue}` };
  }

  return { isValid: true };
}

/**
 * Validate IP address (IPv4 or IPv6)
 */
export function validateIPAddress(ip: string): ValidationResult {
  if (!ip) {
    return { isValid: false, error: 'IP address cannot be empty' };
  }

  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  if (ipv4Pattern.test(ip)) {
    // Validate each octet is 0-255
    const octets = ip.split('.');
    const validOctets = octets.every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });

    if (!validOctets) {
      return { isValid: false, error: 'Invalid IPv4 address' };
    }

    return { isValid: true };
  }

  if (ipv6Pattern.test(ip)) {
    return { isValid: true };
  }

  return { isValid: false, error: 'Invalid IP address format' };
}

/**
 * Comprehensive validation for form inputs
 */
export function validateInput(
  value: string,
  checks: Array<'xss' | 'sql' | 'path'> = ['xss', 'sql']
): ValidationResult {
  if (!value) {
    return { isValid: true };
  }

  if (checks.includes('xss')) {
    const xssResult = isXSSSafe(value);
    if (!xssResult.isValid) {
      return xssResult;
    }
  }

  if (checks.includes('sql')) {
    const sqlResult = isSQLSafe(value);
    if (!sqlResult.isValid) {
      return sqlResult;
    }
  }

  if (checks.includes('path')) {
    const pathResult = isPathSafe(value);
    if (!pathResult.isValid) {
      return pathResult;
    }
  }

  return { isValid: true };
}

/**
 * Create a string from maxLength that shows remaining characters
 */
export function getRemainingChars(current: string, maxLength: number): string {
  const remaining = maxLength - current.length;
  return remaining >= 0 ? `${remaining} characters remaining` : `${Math.abs(remaining)} characters over limit`;
}

/**
 * Validate credit card number using Luhn algorithm (for demo/testing purposes only)
 * DO NOT use for actual payment processing - use payment gateway APIs
 */
export function validateCreditCard(cardNumber: string): ValidationResult {
  if (!cardNumber) {
    return { isValid: false, error: 'Card number cannot be empty' };
  }

  // Remove spaces and dashes
  const cleanNumber = cardNumber.replace(/[\s\-]/g, '');

  // Check if only digits
  if (!/^\d+$/.test(cleanNumber)) {
    return { isValid: false, error: 'Card number must contain only digits' };
  }

  // Check length
  if (cleanNumber.length < 13 || cleanNumber.length > 19) {
    return { isValid: false, error: 'Invalid card number length' };
  }

  // Luhn algorithm
  let sum = 0;
  let isEven = false;

  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  if (sum % 10 !== 0) {
    return { isValid: false, error: 'Invalid card number' };
  }

  return { isValid: true };
}

const validators = {
  validateEmail,
  validateUsername,
  validatePassword,
  validateUrl,
  isXSSSafe,
  isSQLSafe,
  isPathSafe,
  sanitizeString,
  sanitizeHTML,
  validateFilename,
  validateSlug,
  validatePhoneNumber,
  validateHexColor,
  validatePositiveInteger,
  validateIPAddress,
  validateInput,
  getRemainingChars,
  validateCreditCard,
};

export default validators;
