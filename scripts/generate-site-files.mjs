// Generate file situs dari schoolConfig: index.html, public/site.webmanifest,
// public/robots.txt, public/sitemap.xml. Jalankan: npm run generate:site
// Kalimat pemasaran (meta description, OG, JSON-LD description) ada di template ini;
// identitas sekolah (nama, domain, warna, kontak, alamat, NPSN) berasal dari config.
import { writeFileSync } from 'node:fs';
import { SCHOOL_INFO, SCHOOL_BRAND } from '../src/data/schoolConfig.ts';

const { name, tagline, npsn, email, telepon, address } = SCHOOL_INFO;
const { themeColor, domain, ogImage, manifestName, manifestShortName } = SCHOOL_BRAND;
const origin = `https://${domain}`;
const telDigits = telepon.replace(/\D/g, '').replace(/^0/, '');
const telephoneIntl = telDigits.length === 10 ? `+62-${telDigits.slice(0, 3)}-${telDigits.slice(3)}` : `+62-${telDigits}`;

const indexHtml = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name} | Portal Sekolah</title>
    <meta name="description" content="Portal resmi ${name} ${address.locality}. Informasi sekolah, CBT, absensi digital, kelas, dan layanan pembelajaran terpadu." />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="theme-color" content="${themeColor}" />
    <meta name="application-name" content="${manifestName}" />
    <link rel="canonical" href="${origin}/" />
    <link rel="icon" type="image/svg+xml" href="/school/school-mark.svg" />
    <link rel="apple-touch-icon" href="/school/icon-192.png" />
    <link rel="manifest" href="/site.webmanifest" />

    <meta property="og:type" content="website" />
    <meta property="og:locale" content="id_ID" />
    <meta property="og:site_name" content="${manifestName}" />
    <meta property="og:title" content="${name} | Portal Sekolah" />
    <meta property="og:description" content="Portal pendidikan digital ${name} ${address.locality}: informasi sekolah, CBT, absensi, dan layanan pembelajaran terpadu." />
    <meta property="og:url" content="${origin}/" />
    <meta property="og:image" content="${origin}/school/${ogImage}" />
    <meta property="og:image:secure_url" content="${origin}/school/${ogImage}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${name}, portal pendidikan digital terpadu di ${address.locality} ${address.region}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${name} | Portal Sekolah" />
    <meta name="twitter:description" content="Informasi sekolah, CBT, absensi digital, dan layanan pembelajaran ${name}." />
    <meta name="twitter:image" content="${origin}/school/${ogImage}" />

    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "EducationalOrganization",
        "@id": "${origin}/#school",
        "name": "${manifestName}",
        "url": "${origin}/",
        "logo": "${origin}/school/icon-512.png",
        "image": "${origin}/school/${ogImage}",
        "description": "Sekolah menengah kejuruan di ${address.locality}, ${address.region}.",
        "identifier": "NPSN ${npsn}",
        "email": "${email}",
        "telephone": "${telephoneIntl}",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "${address.streetAddress}",
          "addressLocality": "${address.locality}",
          "addressRegion": "${address.region}",
          "postalCode": "${address.postalCode}",
          "addressCountry": "${address.country}"
        }
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const webmanifest = `{
  "name": "${manifestName}",
  "short_name": "${manifestShortName}",
  "description": "Portal pendidikan digital ${manifestName} ${address.locality}",
  "lang": "id-ID",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f8fafc",
  "theme_color": "${themeColor}",
  "icons": [
    { "src": "/school/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/school/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
`;

const robotsTxt = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${origin}/sitemap.xml
`;

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

writeFileSync('index.html', indexHtml);
writeFileSync('public/site.webmanifest', webmanifest);
writeFileSync('public/robots.txt', robotsTxt);
writeFileSync('public/sitemap.xml', sitemapXml);
console.log('Selesai: index.html, site.webmanifest, robots.txt, sitemap.xml (identitas dari schoolConfig).');