import { cn } from "@/lib/utils";

/** House mark: compass rose + RoRo silhouette. Used on title, login, boards. */
export function HouseMark({ className, size = 44 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn("shrink-0 text-brass", className)}
      aria-hidden
    >
      <circle cx="24" cy="24" r="22.5" fill="none" stroke="currentColor" strokeWidth="1.15" opacity="0.55" />
      <circle cx="24" cy="24" r="17.5" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.28" />
      <path d="M24 3.5 L25.4 20.2 L24 19.1 L22.6 20.2 Z" fill="currentColor" />
      <path d="M24 44.5 L22.6 27.8 L24 28.9 L25.4 27.8 Z" fill="currentColor" opacity="0.55" />
      <path d="M3.5 24 L20.2 22.6 L19.1 24 L20.2 25.4 Z" fill="currentColor" opacity="0.7" />
      <path d="M44.5 24 L27.8 25.4 L28.9 24 L27.8 22.6 Z" fill="currentColor" opacity="0.7" />
      <path
        d="M12 29.5 h24 l-2.6-6.2 H14.6 Z M16.2 16.8 h15.6 v6.5 H16.2 Z M28.8 13.2 h4.2 v3.6 h-4.2 Z"
        fill="var(--color-accent)"
      />
      <path d="M16.2 16.8 h15.6 v1.1 H16.2 Z" fill="var(--color-fg)" opacity="0.35" />
    </svg>
  );
}
