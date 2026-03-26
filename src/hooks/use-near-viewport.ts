import { useEffect, useRef, useState } from "react"

export function useNearViewport<T extends Element>(rootMargin = "200px") {
  const ref = useRef<T>(null)
  const [isNearViewport, setIsNearViewport] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNearViewport(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin])

  return { isNearViewport, ref }
}
