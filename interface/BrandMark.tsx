type Props = {
  className?: string;
  title?: string;
};

/**
 * Generic editorial wordmark for the app — a layered "M" formed from two
 * offset rectangular slabs, echoing the editorial Georgia headlines used
 * throughout the UI. Drop-in replacement for any future real logo asset.
 */
export function BrandMark({ className, title = "Midtown Rental Comp" }: Props) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label={title}
      fill="currentColor"
    >
      {/* Back M slab (faded depth) */}
      <g opacity="0.35">
        <rect x="4" y="4" width="4" height="32" />
        <rect x="4" y="4" width="28" height="4" />
        <rect x="28" y="4" width="4" height="32" />
        <rect x="14" y="4" width="4" height="20" />
      </g>
      {/* Front M slab */}
      <g>
        <rect x="12" y="12" width="4" height="32" />
        <rect x="12" y="12" width="28" height="4" />
        <rect x="36" y="12" width="4" height="32" />
        <rect x="22" y="12" width="4" height="20" />
      </g>
    </svg>
  );
}
