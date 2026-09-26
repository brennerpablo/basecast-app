"use client"

import React from "react"
import { ResponsiveContainer } from "recharts"

type ResponsiveContainerProps = React.ComponentProps<typeof ResponsiveContainer>

const hasPositiveFixedSize = (
  value: ResponsiveContainerProps["width"] | ResponsiveContainerProps["height"],
) => typeof value === "number" && value > 0

/**
 * recharts' ResponsiveContainer renders once with its default
 * initialDimension of -1×-1 before its ResizeObserver reports, and that
 * first pass logs a "width(-1) and height(-1)" console warning for every
 * percent-sized chart. Measure the slot before first paint and only mount
 * the container with a real initialDimension so that render never happens.
 * A genuinely 0-sized slot still warns — that one is a real layout bug.
 */
export const MeasuredResponsiveContainer = ({
  width = "100%",
  height = "100%",
  ...props
}: ResponsiveContainerProps) => {
  const hostRef = React.useRef<HTMLDivElement>(null)
  const [initialDimension, setInitialDimension] = React.useState<{
    width: number
    height: number
  } | null>(null)
  const deferUntilMeasured =
    !hasPositiveFixedSize(width) && !hasPositiveFixedSize(height)

  React.useLayoutEffect(() => {
    if (!deferUntilMeasured) return
    const host = hostRef.current
    if (host) {
      setInitialDimension({ width: host.clientWidth, height: host.clientHeight })
    }
  }, [deferUntilMeasured])

  if (!deferUntilMeasured) {
    return <ResponsiveContainer width={width} height={height} {...props} />
  }

  return (
    <div ref={hostRef} className="size-full">
      {initialDimension ? (
        <ResponsiveContainer
          width={width}
          height={height}
          initialDimension={initialDimension}
          {...props}
        />
      ) : null}
    </div>
  )
}
