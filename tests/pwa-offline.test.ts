import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sw = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');
const main = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8');

describe('PWA offline (service worker)', () => {
  it('service worker tersedia dan precache shell aplikasi', () => {
    expect(sw).toContain("PRECACHE_URLS");
    expect(sw).toContain("'/site.webmanifest'");
    expect(sw).toContain("'/school/icon-192.png'");
    expect(sw).toContain('skipWaiting');
    expect(sw).toContain('clients.claim');
  });

  it('tidak pernah meng-cache API (data & sesi sensitif)', () => {
    expect(sw).toContain("url.pathname.startsWith('/api/')");
    expect(sw).toContain('return;');
    expect(sw).not.toMatch(/caches\.(match|put|open).*\/api\//);
  });

  it('navigasi memakai network-first dengan fallback offline', () => {
    expect(sw).toContain("request.mode === 'navigate'");
    expect(sw).toContain('.catch(() => caches.match(\'/\'))');
  });

  it('didaftarkan hanya di produksi', () => {
    expect(main).toContain("import.meta.env.PROD && 'serviceWorker' in navigator");
    expect(main).toContain("navigator.serviceWorker.register('/sw.js')");
  });
});