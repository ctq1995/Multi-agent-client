"use client"

import { useEffect, useRef, useState } from "react"

export function useNearViewport<T extends Element>(rootMargin: string) {
  const ref = useRef<T | null>(null)
  const [isNearViewport, setIsNearViewport] = useState(
    () => typeof IntersectionObserver === "undefined"
  )

  useEffect(() => {
    if (isNearViewport) {
      return
    }

    const node = ref.current
    if (!node || typeof IntersectionObserver === "undefined") {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNearViewport(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )

    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [isNearViewport, rootMargin])

  return { isNearViewport, ref }
}
