interface Props {
  /** Height of the mark in px; the wordmark scales with it. */
  size?: number;
  /** Hide the wordmark and show only the mark (collapsed or tight spaces). */
  markOnly?: boolean;
  className?: string;
}

/**
 * basecast logo: a mark of three rising bars (a forecast climbing toward the
 * peak) plus the wordmark. The wordmark follows `currentColor`, so the parent
 * sets its ink for light and dark.
 */
const Logo = ({ size = 28, markOnly = false, className }: Props) => {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden={!markOnly}
        role={markOnly ? "img" : undefined}
        aria-label={markOnly ? "basecast" : undefined}
      >
        <rect width="32" height="32" rx="8" className="fill-basecast-brand" />
        <rect x="7" y="18" width="4.5" height="7" rx="1.5" fill="white" fillOpacity="0.7" />
        <rect x="13.75" y="13" width="4.5" height="12" rx="1.5" fill="white" fillOpacity="0.85" />
        <rect x="20.5" y="7" width="4.5" height="18" rx="1.5" fill="white" />
      </svg>
      {markOnly ? null : (
        <span
          className="font-semibold tracking-tight"
          style={{ fontSize: Math.round(size * 0.72) }}
        >
          basecast
        </span>
      )}
    </span>
  );
};

export default Logo;
