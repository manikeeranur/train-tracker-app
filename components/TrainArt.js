// Side view of a passenger train (engine + two coaches) in the brand colours.
// `track`: draw rails under it (off when the card draws its own long track).
// Wheels carry the `train-wheel` class and the body `train-bob` for the running animation.
function Wheel({ cx }) {
  return (
    <g className="train-wheel">
      <circle cx={cx} cy="68" r="6" fill="#2b3440" />
      <path d={`M${cx - 4.5} 68h9M${cx} 63.5v9`} stroke="#8d99a8" strokeWidth="1.2" />
      <circle cx={cx} cy="68" r="2" fill="#c9d3df" />
    </g>
  );
}

export default function TrainArt({ className = "", track = true }) {
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
      {track && (
        <>
          <rect x="0" y="74" width="320" height="3" rx="1.5" fill="#c9d3df" />
          {Array.from({ length: 16 }, (_, i) => (
            <rect key={i} x={6 + i * 20} y="77" width="10" height="4" rx="1" fill="#dfe5ec" />
          ))}
        </>
      )}
      <g className="train-bob">
        {[0, 1].map((c) => {
          const x = 8 + c * 102;
          return (
            <g key={c}>
              <rect x={x} y="24" width="96" height="42" rx="8" fill="url(#ta-body)" />
              <rect x={x} y="52" width="96" height="5" fill="#f5b800" opacity=".9" />
              {[0, 1, 2, 3].map((w) => (
                <rect key={w} x={x + 8 + w * 21} y="31" width="15" height="13" rx="3" fill="url(#ta-glass)" />
              ))}
            </g>
          );
        })}
        <path d="M212 24h66c16 0 30 14 34 30l2 12h-102z" fill="url(#ta-body)" />
        <rect x="212" y="52" width="102" height="5" fill="#f5b800" opacity=".9" />
        <path d="M268 31h12c9 0 17 8 20 17h-32z" fill="url(#ta-glass)" />
        <rect x="222" y="31" width="15" height="13" rx="3" fill="url(#ta-glass)" />
        <rect x="243" y="31" width="15" height="13" rx="3" fill="url(#ta-glass)" />
        <circle cx="306" cy="58" r="2.5" fill="#fff6c2" />
        <rect x="104" y="56" width="6" height="4" fill="#2b3440" />
        <rect x="206" y="56" width="6" height="4" fill="#2b3440" />
      </g>
      {[26, 86, 128, 188, 232, 290].map((cx) => <Wheel key={cx} cx={cx} />)}
    </svg>
  );
}

/**
 * Scenery strip for the bottom of a (relative, overflow-hidden) card: hills, trees and
 * drifting clouds, with the train running along the track.
 */
export function RunningTrain() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 overflow-hidden" aria-hidden>
      {/* clouds */}
      <svg viewBox="0 0 60 20" className="cloud-drift absolute top-1 w-12 opacity-70" style={{ animationDuration: "38s" }}>
        <path d="M10 16a6 6 0 0 1 1-12 8 8 0 0 1 15-2 7 7 0 0 1 13 4 6 6 0 0 1 1 10z" fill="#fff" />
      </svg>
      <svg viewBox="0 0 60 20" className="cloud-drift absolute top-4 w-9 opacity-60" style={{ animationDuration: "52s", animationDelay: "-20s" }}>
        <path d="M10 16a6 6 0 0 1 1-12 8 8 0 0 1 15-2 7 7 0 0 1 13 4 6 6 0 0 1 1 10z" fill="#fff" />
      </svg>
      {/* hills + trees */}
      <svg viewBox="0 0 400 60" preserveAspectRatio="none" className="absolute inset-x-0 bottom-2 h-14 w-full">
        <path d="M0 40C40 18 80 16 120 30s80 22 120 4 90-26 160 6v20H0z" fill="#cfe9df" />
        <path d="M0 50c50-14 90-12 140-2s90 10 140-4 80-8 120 2v14H0z" fill="#b5ddcd" />
        {[30, 92, 176, 262, 318, 372].map((x, i) => (
          <g key={x} transform={`translate(${x} ${44 - (i % 2) * 3})`}>
            <rect x="-1" y="0" width="2" height="7" fill="#7a5a3a" />
            <circle cx="0" cy="-2" r={5 + (i % 3)} fill="#5fb38f" />
          </g>
        ))}
      </svg>
      {/* track */}
      <div className="absolute inset-x-0 bottom-[7px] h-[3px] rounded-full bg-[#9fb0bf]" />
      <div className="absolute inset-x-0 bottom-[2px] h-[5px] bg-[repeating-linear-gradient(90deg,#c7d2dc_0_10px,transparent_10px_20px)]" />
      {/* train with speed lines behind and a headlight beam ahead */}
      <div className="train-run absolute bottom-[7px] flex w-[13.5rem] items-end">
        <span className="mb-4 mr-1 flex w-8 flex-col gap-1 opacity-70">
          <span className="h-[2px] w-full rounded bg-gradient-to-r from-transparent to-accent" />
          <span className="ml-2 h-[2px] w-6 rounded bg-gradient-to-r from-transparent to-accent" />
          <span className="h-[2px] w-full rounded bg-gradient-to-r from-transparent to-accent" />
        </span>
        <TrainArt track={false} className="w-44 shrink-0 drop-shadow-[0_4px_6px_rgba(11,122,92,0.25)]" />
        <span className="-ml-1 mb-3 h-3 w-6 rounded-full bg-gradient-to-r from-[#fff6c2] to-transparent opacity-80 blur-[2px]" />
      </div>
    </div>
  );
}
