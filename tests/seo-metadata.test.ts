import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

describe('SEO and social metadata', () => {
  it('uses Indonesian metadata and canonical URL', () => {
    expect(html).toContain('<html lang="id">');
    expect(html).toContain('rel="canonical" href="https://smk-at-tahirin.pages.dev/"');
    expect(html).toContain('type="application/ld+json"');
    expect(html).not.toContain('My Google AI Studio App');
  });

  it('defines a large Open Graph image for WhatsApp previews', () => {
    expect(html).toContain('property="og:image" content="https://smk-at-tahirin.pages.dev/og-smk-at-thahirin.png"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });
});
