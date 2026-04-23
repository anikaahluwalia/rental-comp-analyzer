type Props = {
  className?: string;
  title?: string;
};

/**
 * Approximation of the Fitzrovia "F" mark — two offset Fs creating a layered
 * architectural feel. Replace with the real asset when available
 * (drop an SVG into /public and swap this component for an <Image />).
 */
export function FitzroviaMark({ className, title = "Fitzrovia" }: Props) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label={title}
      fill="currentColor"
    >
      {/* Back F (outlined effect via lower opacity) */}
      <g opacity="0.35">
        <rect x="4" y="4" width="28" height="4" />
        <rect x="4" y="4" width="4" height="32" />
        <rect x="4" y="18" width="20" height="4" />
      </g>
      {/* Front F */}
      <g>
        <rect x="12" y="12" width="28" height="4" />
        <rect x="12" y="12" width="4" height="32" />
        <rect x="12" y="26" width="20" height="4" />
      </g>
    </svg>
  );
}
