// Generates the RailGo app icons (train logo) used by the PWA manifest.
// Usage: node scripts/icons.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

// Front view of a train on tracks, white on the brand green. `pad` shrinks the
// artwork for maskable icons (Android crops to a circle/squircle).
function svg({ size = 512, pad = 0, rounded = true } = {}) {
  const s = (512 - pad * 2) / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#14a37b"/><stop offset="1" stop-color="#0a6a50"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#bg)"/>
  <g transform="translate(${pad} ${pad}) scale(${s})">
    <rect x="136" y="72" width="240" height="276" rx="64" fill="#ffffff"/>
    <rect x="168" y="112" width="176" height="92" rx="20" fill="#0b7a5c"/>
    <rect x="220" y="86" width="72" height="12" rx="6" fill="#0b7a5c" opacity="0.35"/>
    <circle cx="184" cy="280" r="22" fill="#ffd166"/>
    <circle cx="328" cy="280" r="22" fill="#ffd166"/>
    <rect x="232" y="268" width="48" height="24" rx="8" fill="#0b7a5c" opacity="0.35"/>
    <path d="M196 348 150 436M316 348 362 436" stroke="#ffffff" stroke-width="22" stroke-linecap="round"/>
    <path d="M168 404H344" stroke="#ffffff" stroke-width="18" stroke-linecap="round" opacity="0.85"/>
  </g>
</svg>`;
}

const out = [
  ["public/icons/icon-192.png", 192, {}],
  ["public/icons/icon-512.png", 512, {}],
  ["public/icons/maskable-512.png", 512, { pad: 72, rounded: false }],
  ["app/apple-icon.png", 180, { pad: 24, rounded: false }],
  ["app/icon.png", 64, {}],
];
for (const [file, size, opts] of out) {
  await sharp(Buffer.from(svg({ size, ...opts }))).png().toFile(file);
  console.log(file);
}
writeFileSync("public/icons/icon.svg", svg());
