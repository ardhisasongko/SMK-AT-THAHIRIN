/**
 * Authentication utility untuk SMK AT-THAHIRIN
 * Implementasi basic authentication dengan password hashing
 */

import { User } from '../types';

// Simple hash function (untuk demo - production harus pakai bcrypt di backend)
function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Default credentials untuk demo
 * Format: { email/nisn: password }
 */
const DEFAULT_CREDENTIALS: Record<string, string> = {
  // Admin
  'admin@smksplusatthahirin.sch.id': 'admin123',
  '19700512 199803 1 002': 'admin123',
  
  // Guru
  'guru@smksplusatthahirin.sch.id': 'guru123',
  '19890215 201502 1 003': 'guru123',
  
  // Siswa
  'siswa@smksplusatthahirin.sch.id': 'siswa123',
  '0068123491': 'siswa123'
};

/**
 * Validate login credentials
 */
export function validateCredentials(
  identifier: string, 
  password: string
): boolean {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const storedPassword = DEFAULT_CREDENTIALS[normalizedIdentifier] || DEFAULT_CREDENTIALS[identifier.trim()];
  
  if (!storedPassword) {
    // Jika tidak ada kredensial default, terima password minimal 6 karakter
    return password.length >= 6;
  }
  
  return password === storedPassword;
}

/**
 * Get password requirements message
 */
export function getPasswordRequirements(): string {
  return 'Password minimal 6 karakter';
}

/**
 * Validate password strength
 */
export function isPasswordStrong(password: string): { valid: boolean; message: string } {
  if (password.length < 6) {
    return { valid: false, message: 'Password minimal 6 karakter' };
  }
  
  // Opsional: Tambahkan validasi lebih ketat
  // if (!/[A-Z]/.test(password)) {
  //   return { valid: false, message: 'Password harus mengandung huruf besar' };
  // }
  // if (!/[0-9]/.test(password)) {
  //   return { valid: false, message: 'Password harus mengandung angka' };
  // }
  
  return { valid: true, message: 'Password valid' };
}

/**
 * Session timeout duration (in milliseconds)
 */
export const SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours

/**
 * Check if session is expired
 */
export function isSessionExpired(loginTimestamp: number | null): boolean {
  if (!loginTimestamp) return true;
  const now = Date.now();
  return (now - loginTimestamp) > SESSION_TIMEOUT;
}

/**
 * Get default credentials info for UI display
 */
export function getDefaultCredentialsInfo() {
  return [
    { role: 'Admin', email: 'admin@smksplusatthahirin.sch.id', password: 'admin123' },
    { role: 'Guru', email: 'guru@smksplusatthahirin.sch.id', password: 'guru123' },
    { role: 'Siswa', email: 'siswa@smksplusatthahirin.sch.id', password: 'siswa123' }
  ];
}
