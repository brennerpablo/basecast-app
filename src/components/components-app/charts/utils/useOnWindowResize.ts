import { useCallback, useEffect } from "react"

export function useOnWindowResize(handler: () => void) {
  const stableHandler = useCallback(() => handler(), [handler])
  useEffect(() => {
    window.addEventListener("resize", stableHandler)
    stableHandler()
    return () => window.removeEventListener("resize", stableHandler)
  }, [stableHandler])
}
