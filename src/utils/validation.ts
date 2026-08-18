/**
 * Input Validation Utilities untuk sistem informasi sekolah
 * Validasi berbagai tipe input sesuai standar Indonesia
 */

/**
 * Validasi format NISN (Nomor Induk Siswa Nasional)
 * NISN harus 10 digit angka
 */
export function validateNISN(nisn: string): { valid: boolean; message: string } {
  const cleaned = nisn.trim();
  
  if (!cleaned) {
    return { valid: false, message: 'NISN tidak boleh kosong' };
  }
  
  if (!/^\d{10}$/.test(cleaned)) {
    return { valid: false, message: 'NISN harus 10 digit angka' };
  }
  
  return { valid: true, message: 'NISN valid' };
}

/**
 * Validasi format NIP (Nomor Induk Pegawai)
 * NIP format: 18 digit dengan spasi (contoh: 19700512 199803 1 002)
 */
export function validateNIP(nip: string): { valid: boolean; message: string } {
  const cleaned = nip.trim().replace(/\s+/g, '');
  
  if (!cleaned) {
    return { valid: false, message: 'NIP tidak boleh kosong' };
  }
  
  // NIP bisa 18 digit atau format lama
  if (!/^\d{18}$/.test(cleaned) && cleaned.length < 8) {
    return { valid: false, message: 'NIP harus 18 digit atau minimal 8 digit' };
  }
  
  return { valid: true, message: 'NIP valid' };
}

/**
 * Validasi format Email
 */
export function validateEmail(email: string): { valid: boolean; message: string } {
  const cleaned = email.trim().toLowerCase();
  
  if (!cleaned) {
    return { valid: false, message: 'Email tidak boleh kosong' };
  }
  
  // RFC 5322 simplified regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(cleaned)) {
    return { valid: false, message: 'Format email tidak valid' };
  }
  
  return { valid: true, message: 'Email valid' };
}

/**
 * Validasi nomor HP Indonesia
 * Format: 08xx-xxxx-xxxx (minimal 10 digit, maksimal 13 digit)
 */
export function validatePhoneNumber(phone: string): { valid: boolean; message: string } {
  const cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
  
  if (!cleaned) {
    return { valid: false, message: 'Nomor HP tidak boleh kosong' };
  }
  
  // Harus dimulai dengan 08 atau +62 atau 62
  if (!/^(08|628|\+628)/.test(cleaned)) {
    return { valid: false, message: 'Nomor HP harus dimulai dengan 08 atau +62' };
  }
  
  const digitsOnly = cleaned.replace(/^\+/, '');
  
  if (digitsOnly.length < 10 || digitsOnly.length > 14) {
    return { valid: false, message: 'Nomor HP harus 10-13 digit' };
  }
  
  return { valid: true, message: 'Nomor HP valid' };
}

/**
 * Validasi tanggal format YYYY-MM-DD
 */
export function validateDate(dateStr: string): { valid: boolean; message: string } {
  if (!dateStr) {
    return { valid: false, message: 'Tanggal tidak boleh kosong' };
  }
  
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!dateRegex.test(dateStr)) {
    return { valid: false, message: 'Format tanggal harus YYYY-MM-DD' };
  }
  
  const date = new Date(dateStr);
  
  if (isNaN(date.getTime())) {
    return { valid: false, message: 'Tanggal tidak valid' };
  }
  
  return { valid: true, message: 'Tanggal valid' };
}

/**
 * Validasi nama (minimal 3 karakter, hanya huruf dan spasi)
 */
export function validateName(name: string): { valid: boolean; message: string } {
  const cleaned = name.trim();
  
  if (!cleaned) {
    return { valid: false, message: 'Nama tidak boleh kosong' };
  }
  
  if (cleaned.length < 3) {
    return { valid: false, message: 'Nama minimal 3 karakter' };
  }
  
  if (!/^[a-zA-Z\s.,']+$/.test(cleaned)) {
    return { valid: false, message: 'Nama hanya boleh huruf dan spasi' };
  }
  
  return { valid: true, message: 'Nama valid' };
}

/**
 * Validasi text field umum (minimal length)
 */
export function validateTextField(
  text: string, 
  fieldName: string,
  minLength: number = 1,
  maxLength?: number
): { valid: boolean; message: string } {
  const cleaned = text.trim();
  
  if (!cleaned) {
    return { valid: false, message: `${fieldName} tidak boleh kosong` };
  }
  
  if (cleaned.length < minLength) {
    return { valid: false, message: `${fieldName} minimal ${minLength} karakter` };
  }
  
  if (maxLength && cleaned.length > maxLength) {
    return { valid: false, message: `${fieldName} maksimal ${maxLength} karakter` };
  }
  
  return { valid: true, message: `${fieldName} valid` };
}

/**
 * Sanitize input untuk mencegah XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

/**
 * Validate and sanitize combined
 */
export function validateAndSanitize(
  input: string,
  validator: (val: string) => { valid: boolean; message: string }
): { valid: boolean; message: string; sanitized: string } {
  const sanitized = sanitizeInput(input);
  const validation = validator(sanitized);
  
  return {
    ...validation,
    sanitized
  };
}
