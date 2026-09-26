import Image from "next/image";

import { cn } from "@/lib/utils";

/** viewBox of the files in `public/brand`, cropped to the drawing. */
const LOGO_WIDTH = 864;
const LOGO_HEIGHT = 183;

interface Props {
  /** Height in px; the width follows the logo's aspect ratio. */
  size?: number;
  className?: string;
}

/**
 * BaseCast logo, the "small" cut from `docs/brand`: its five thicker strands
 * hold up at UI sizes (the full cut's ten thin ones fade below ~100px).
 * Light themes get `basecast-logo-small-green.svg`, the kit's light cut
 * recolored to Base's greens (the kit's own light cut is blue); dark themes get
 * the kit's dark cut unchanged. The `.dark` class on <html> picks which one
 * shows, like the rest of the theme. The hidden one still downloads, but each
 * is ~8 KB.
 */
const Logo = ({ size = 32, className }: Props) => {
  const width = Math.round((size * LOGO_WIDTH) / LOGO_HEIGHT);

  return (
    <span className={cn("inline-flex", className)}>
      <Image
        src="/brand/basecast-logo-small-green.svg"
        alt="BaseCast"
        width={width}
        height={size}
        loading="eager"
        className="dark:hidden"
      />
      <Image
        src="/brand/basecast-logo-small-dark.svg"
        alt="BaseCast"
        width={width}
        height={size}
        loading="eager"
        className="hidden dark:block"
      />
    </span>
  );
};

export default Logo;
