// Side view of a passenger train (engine + two coaches) on a track, in the brand colours.
export default function TrainArt({ className = "" }) {
  return (
    <svg viewBox="0 0 320 84" className={className} aria-hidden>
      <defs>
        <linearGradient id="ta-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#19b386" />
          <stop offset="1" stopColor="#0b7a5c" />
        </linearGradient>
        <linearGradient id="ta-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9f8ff" />
          <stop offset="1" stopColor="#b9e2f7" />
        </linearGradient>
      </defs>
      {/* track */}
      <rect x="0" y="74" width="320" height="3" rx="1.5" fill="#c9d3df" />
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={i} x={6 + i * 20} y="77" width="10" height="4" rx="1" fill="#dfe5ec" />
      ))}
      {/* coaches */}
      {[0, 1].map((c) => {
        const x = 8 + c * 102;
        return (
          <g key={c}>
            <rect x={x} y="24" width="96" height="42" rx="8" fill="url(#ta-body)" />
            <rect x={x} y="52" width="96" height="5" fill="#f5b800" opacity=".9" />
            {[0, 1, 2, 3].map((w) => (
              <rect key={w} x={x + 8 + w * 21} y="31" width="15" height="13" rx="3" fill="url(#ta-glass)" />
            ))}
            {[x + 18, x + 78].map((wx) => (
              <g key={wx}>
                <circle cx={wx} cy="68" r="6" fill="#2b3440" />
                <circle cx={wx} cy="68" r="2.4" fill="#c9d3df" />
              </g>
            ))}
          </g>
        );
      })}
      {/* engine */}
      <path d="M212 24h66c16 0 30 14 34 30l2 12h-102z" fill="url(#ta-body)" />
      <rect x="212" y="52" width="102" height="5" fill="#f5b800" opacity=".9" />
      <path d="M268 31h12c9 0 17 8 20 17h-32z" fill="url(#ta-glass)" />
      <rect x="222" y="31" width="15" height="13" rx="3" fill="url(#ta-glass)" />
      <rect x="243" y="31" width="15" height="13" rx="3" fill="url(#ta-glass)" />
      <circle cx="306" cy="58" r="2.5" fill="#fff6c2" />
      {[232, 290].map((wx) => (
        <g key={wx}>
          <circle cx={wx} cy="68" r="6" fill="#2b3440" />
          <circle cx={wx} cy="68" r="2.4" fill="#c9d3df" />
        </g>
      ))}
      {/* couplers */}
      <rect x="104" y="56" width="6" height="4" fill="#2b3440" />
      <rect x="206" y="56" width="6" height="4" fill="#2b3440" />
    </svg>
  );
}
