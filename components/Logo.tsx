export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#2f5d3a" />
      <path d="M20 31c0-8 3-13 10-16-1 8-4 13-10 16Z" fill="#a1d4a8" />
      <path d="M20 31c0-7-3-11-9-13 1 7 4 11 9 13Z" fill="#fdc79c" />
      <path d="M20 31V14" stroke="#fffbf4" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="11" r="2.5" fill="#fffbf4" />
    </svg>
  );
}
