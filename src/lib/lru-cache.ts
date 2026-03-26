// Each entry tracks insertion order via a counter for LRU eviction
const orderMap = new WeakMap<Map<unknown, unknown>, Map<unknown, number>>()
let counter = 0

function getOrder(cache: Map<unknown, unknown>): Map<unknown, number> {
  let order = orderMap.get(cache)
  if (!order) {
    order = new Map()
    orderMap.set(cache, order)
  }
  return order
}

export function getLruValue<K, V>(cache: Map<K, V>, key: K): V | undefined {
  const value = cache.get(key)
  if (value !== undefined) {
    getOrder(cache as Map<unknown, unknown>).set(key, ++counter)
  }
  return value
}

export function setLruValue<K, V>(
  cache: Map<K, V>,
  key: K,
  value: V,
  maxSize: number
): void {
  const order = getOrder(cache as Map<unknown, unknown>)
  if (cache.size >= maxSize && !cache.has(key)) {
    let oldestKey: K | undefined
    let oldestOrder = Infinity
    for (const [k] of cache) {
      const o = order.get(k) ?? 0
      if (o < oldestOrder) {
        oldestOrder = o
        oldestKey = k
      }
    }
    if (oldestKey !== undefined) {
      cache.delete(oldestKey)
      order.delete(oldestKey)
    }
  }
  cache.set(key, value)
  order.set(key, ++counter)
}
