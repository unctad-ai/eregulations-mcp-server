import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TTLCache } from '../../utils/cache.js';

describe('TTLCache', () => {
  let cache: TTLCache<string>;
  
  beforeEach(() => {
    // Create a new cache instance with a shorter default TTL for testing
    cache = new TTLCache<string>(1000); // 1 second default TTL
  });
  
  afterEach(() => {
    // Clean up
    cache.clear();
  });
  
  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });
    
    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });
    
    it('should check if a key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });
    
    it('should delete keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.get('key1')).toBe('value1');
      
      cache.delete('key1');
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });
    
    it('should clear all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.size()).toBe(2);
      
      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
    
    it('should return the size of the cache', () => {
      expect(cache.size()).toBe(0);
      
      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);
      
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
      
      cache.delete('key1');
      expect(cache.size()).toBe(1);
    });
    
    it('should return all valid keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const keys = cache.keys();
      expect(keys).toHaveLength(2);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });
  });
  
  describe('TTL functionality', () => {
    it('should expire items after the default TTL', async () => {
      cache.set('expiring', 'value');
      
      expect(cache.get('expiring')).toBe('value');
      
      // Wait for the TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(cache.get('expiring')).toBeNull();
    });
    
    it('should expire items after a custom TTL', async () => {
      // Short TTL
      cache.set('short', 'value1', 500);
      // Longer TTL
      cache.set('long', 'value2', 2000);
      
      expect(cache.get('short')).toBe('value1');
      expect(cache.get('long')).toBe('value2');
      
      // Wait for the short TTL to expire
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(cache.get('short')).toBeNull();
      expect(cache.get('long')).toBe('value2');
      
      // Wait for the longer TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      expect(cache.get('long')).toBeNull();
    });
    
    it('should remove expired keys when checking existence', async () => {
      cache.set('key', 'value', 500);
      
      expect(cache.has('key')).toBe(true);
      
      // Wait for the TTL to expire
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(cache.has('key')).toBe(false);
      expect(cache.size()).toBe(0); // Should be removed from internal storage
    });
    
    it('should remove expired keys when listing keys', async () => {
      cache.set('expire1', 'value1', 500);
      cache.set('expire2', 'value2', 500);
      cache.set('valid', 'value3', 2000);
      
      expect(cache.keys()).toHaveLength(3);
      
      // Wait for some keys to expire
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const validKeys = cache.keys();
      expect(validKeys).toHaveLength(1);
      expect(validKeys).toContain('valid');
      expect(validKeys).not.toContain('expire1');
      expect(validKeys).not.toContain('expire2');
    });
    
    it('should clean expired items on demand', async () => {
      cache.set('expire1', 'value1', 500);
      cache.set('expire2', 'value2', 500);
      cache.set('valid', 'value3', 2000);
      
      expect(cache.size()).toBe(3);
      
      // Wait for some keys to expire
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Internal size still shows 3 before cleaning
      expect(cache.size()).toBe(3);
      
      // Clean should remove 2 items
      const removed = cache.cleanExpired();
      expect(removed).toBe(2);
      
      // Size should now be 1
      expect(cache.size()).toBe(1);
      expect(cache.get('valid')).toBe('value3');
    });
  });
  
  describe('edge cases', () => {
    it('should handle a custom default TTL', () => {
      const shortCache = new TTLCache<string>(100); // 100ms default TTL
      shortCache.set('key', 'value');
      
      // Initially the value should be there
      expect(shortCache.get('key')).toBe('value');
      
      // After waiting, it should be gone
      return new Promise<void>(resolve => {
        setTimeout(() => {
          expect(shortCache.get('key')).toBeNull();
          resolve();
        }, 150);
      });
    });
    
    it('should handle falsy values correctly', () => {
      const cacheWithFalsy = new TTLCache<any>();
      
      // Test with various falsy values
      cacheWithFalsy.set('zero', 0);
      cacheWithFalsy.set('empty', '');
      cacheWithFalsy.set('false', false);
      cacheWithFalsy.set('null', null);
      
      expect(cacheWithFalsy.get('zero')).toBe(0);
      expect(cacheWithFalsy.get('empty')).toBe('');
      expect(cacheWithFalsy.get('false')).toBe(false);
      expect(cacheWithFalsy.get('null')).toBe(null);
    });
    
    it('should handle complex objects', () => {
      const objectCache = new TTLCache<object>();
      const testObj = { a: 1, b: { c: 'test' } };
      
      objectCache.set('obj', testObj);
      
      expect(objectCache.get('obj')).toEqual(testObj);
    });
  });
});