export function getLruValue<K, V>(cache: Map<K, V>, key: K): V | undefined {
  const value = cache.get(key)
  if (value === undefined) {
    return undefined
  }

  cache.delete(key)
  cache.set(key, value)
  return value
}

export function setLruValue<K, V>(
  cache: Map<K, V>,
  key: K,
  value: V,
  maxSize: number
): void {
  if (cache.has(key)) {
    cache.delete(key)
  }

  cache.set(key, value)
  while (cache.size > maxSize) {
    const oldestKey = cache.keys().next().value
    if (oldestKey === undefined) {
      return
    }
    cache.delete(oldestKey)
  }
}
