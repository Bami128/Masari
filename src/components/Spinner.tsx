export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-6 w-6 rounded-full border-2 border-line-2 border-t-accent animate-spin ${className}`}
    />
  )
}
