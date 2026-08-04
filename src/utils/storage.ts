/**
 * LocalStorage utility untuk persist data aplikasi SMK AT-THAHIRIN
 * Data akan tersimpan di browser dan tidak hilang saat refresh
 */

const STORAGE_KEYS = {
  KELAS_LIST: 'smk_kelas_list',
  SISWA_LIST: 'smk_siswa_list',
  PRESENSI_LIST: 'smk_presensi_list',
  MODUL_LIST: 'smk_modul_list',
  FORUM_TOPICS: 'smk_forum_topics',
  NOTIFICATIONS: 'smk_notifications',
  CBT_EXAMS: 'smk_cbt_exams',
  CBT_SUBMISSIONS: 'smk_cbt_submissions',
  CURRENT_USER: 'smk_current_user'
};

/**
 * Save data to localStorage with error handling
 */
export function saveToStorage<T>(key: string, data: T): void {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(key, serialized);
  } catch (error) {
    console.error(`Error saving to localStorage [${key}]:`, error);
  }
}

/**
 * Load data from localStorage with fallback
 */
export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return fallback;
    }
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error loading from localStorage [${key}]:`, error);
    return fallback;
  }
}

/**
 * Remove data from localStorage
 */
export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing from localStorage [${key}]:`, error);
  }
}

/**
 * Clear all app data from localStorage
 */
export function clearAllStorage(): void {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
}

export { STORAGE_KEYS };
