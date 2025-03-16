/**
 * Simple in-memory cache implementation with TTL support
 */
export class TTLCache<T = any> {
  private cache: Map<string, { data: T; expiry: number }>;
  private defaultTtl: number;

  /**
   * Create a new cache instance
   * @param defaultTtlMs Default time-to-live in milliseconds
   */
  constructor(defaultTtlMs: number = 3600000) { // Default: 1 hour
    this.cache = new Map();
    this.defaultTtl = defaultTtlMs;
  }

  /**
   * Set a value in the cache with optional TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttlMs Time-to-live in milliseconds (overrides default)
   */
  set(key: string, value: T, ttlMs?: number): void {
    const expiryTime = Date.now() + (ttlMs || this.defaultTtl);
    this.cache.set(key, { data: value, expiry: expiryTime });
  }

  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns The cached value or null if not found or expired
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    
    // Not in cache
    if (!item) return null;
    
    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  /**
   * Check if a key exists and is not expired
   * @param key Cache key
   * @returns True if the key exists and is not expired
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete a key from the cache
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get all valid keys in the cache
   * @returns Array of valid (not expired) keys
   */
  keys(): string[] {
    const validKeys: string[] = [];
    for (const [key, item] of this.cache.entries()) {
      if (Date.now() <= item.expiry) {
        validKeys.push(key);
      } else {
        this.cache.delete(key);
      }
    }
    return validKeys;
  }

  /**
   * Get the size of the cache (including expired items)
   * @returns Number of items in the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clean expired items from the cache
   * @returns Number of items removed
   */
  cleanExpired(): number {
    const initialSize = this.cache.size;
    for (const [key, item] of this.cache.entries()) {
      if (Date.now() > item.expiry) {
        this.cache.delete(key);
      }
    }
    return initialSize - this.cache.size;
  }
}