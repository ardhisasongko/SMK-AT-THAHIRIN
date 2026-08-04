import { useMemo, useState } from 'react';

/**
 * Hook pencarian/penyaringan sederhana untuk daftar item.
 * Mencari substring (case-insensitive) pada field-field yang diberikan.
 */
export function useFilter<T>(
  items: T[],
  fields: (keyof T)[],
  initialQuery = ''
) {
  const [query, setQuery] = useState(initialQuery);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      fields.some((field) => String(item[field] ?? '').toLowerCase().includes(q))
    );
  }, [items, query, fields]);

  return { query, setQuery, filtered };
}
