export default function TrainIcon({ className = "size-6" }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <rect x="7" y="3" width="18" height="20" rx="5" fill="currentColor" opacity="0.18" />
      <rect x="7" y="3" width="18" height="20" rx="5" stroke="currentColor" strokeWidth="2" />
      <rect x="10.5" y="7" width="11" height="6" rx="1.5" fill="currentColor" />
      <circle cx="11.5" cy="18" r="1.6" fill="currentColor" />
      <circle cx="20.5" cy="18" r="1.6" fill="currentColor" />
      <path d="M12 23l-3.5 6M20 23l3.5 6M10 27h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
