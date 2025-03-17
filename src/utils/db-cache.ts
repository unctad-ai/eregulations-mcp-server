// Import better-sqlite3 correctly for usage as a constructor
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from './logger.js';

/**
 * Interface for cache entries
 */
interface CacheEntry<T> {
  key: string;
  data: T;
  expiry: number;
}

/**
 * Interface for database row types
 */
interface CacheRow {
  key: string;
  data: string;
  expiry: number;
}

/**
 * File-based cache implementation with TTL support using SQLite
 * Each cache instance is isolated by baseUrl to avoid conflicts
 */
export class SqliteCache<T = any> {
  private db: Database.Database;
  private defaultTtl: number;
  private tableName = 'cache_entries';

  /**
   * Create a new cache instance
   * @param baseUrl The base URL is used to isolate caches for different API endpoints
   * @param defaultTtlMs Default time-to-live in milliseconds
   */
  constructor(baseUrl: string, defaultTtlMs: number = 3600000) { // Default: 1 hour
    this.defaultTtl = defaultTtlMs;
    
    // Create cache directory if it doesn't exist
    const cacheDir = path.resolve(process.cwd(), 'data', 'cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    // Create a unique filename based on the baseUrl
    const dbFileName = this.getBaseUrlHash(baseUrl);
    const dbPath = path.join(cacheDir, `${dbFileName}.sqlite`);
    
    logger.debug(`Using cache database at: ${dbPath}`);
    
    try {
      this.db = new Database(dbPath);
      this.initializeDatabase();
    } catch (error) {
      logger.error(`Error initializing cache database: ${error}`);
      // Fallback to in-memory database if file access fails
      this.db = new Database(':memory:');
      this.initializeDatabase();
    }
  }

  /**
   * Creates a hash of the base URL to use as a unique identifier
   */
  private getBaseUrlHash(baseUrl: string): string {
    return crypto.createHash('md5').update(baseUrl).digest('hex');
  }

  /**
   * Initialize the database schema
   */
  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        expiry INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_expiry ON ${this.tableName} (expiry);
    `);
  }

  /**
   * Set a value in the cache with optional TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttlMs Time-to-live in milliseconds (overrides default)
   */
  set(key: string, value: T, ttlMs?: number): void {
    try {
      const expiryTime = Date.now() + (ttlMs || this.defaultTtl);
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO ${this.tableName} (key, data, expiry) 
        VALUES (?, ?, ?)
      `);
      
      stmt.run(key, JSON.stringify(value), expiryTime);
    } catch (error) {
      logger.error(`Error setting cache key ${key}: ${error}`);
    }
  }

  /**
   * Get a value from the cache
   * @param key Cache key
   * @param allowExpired Whether to return expired entries
   * @returns The cached value or null if not found or expired
   */
  get(key: string, allowExpired: boolean = false): T | null {
    try {
      if (!allowExpired) {
        // Clean expired entries for the specific key if not allowing expired entries
        this.cleanExpiredKey(key);
      }
      
      // Then try to get the value
      const stmt = this.db.prepare(`
        SELECT data FROM ${this.tableName}
        WHERE key = ? ${!allowExpired ? 'AND expiry > ?' : ''}
      `);
      
      const row = !allowExpired 
        ? stmt.get(key, Date.now()) as Pick<CacheRow, 'data'> | undefined
        : stmt.get(key) as Pick<CacheRow, 'data'> | undefined;
        
      if (!row) return null;
      
      return JSON.parse(row.data);
    } catch (error) {
      logger.error(`Error getting cache key ${key}: ${error}`);
      return null;
    }
  }

  /**
   * Check if a key exists and is not expired
   * @param key Cache key
   * @returns True if the key exists and is not expired
   */
  has(key: string): boolean {
    try {
      const stmt = this.db.prepare(`
        SELECT 1 FROM ${this.tableName}
        WHERE key = ? AND expiry > ?
        LIMIT 1
      `);
      
      const row = stmt.get(key, Date.now());
      return !!row;
    } catch (error) {
      logger.error(`Error checking cache key ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Delete a key from the cache
   * @param key Cache key
   */
  delete(key: string): void {
    try {
      const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE key = ?`);
      stmt.run(key);
    } catch (error) {
      logger.error(`Error deleting cache key ${key}: ${error}`);
    }
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    try {
      const stmt = this.db.prepare(`DELETE FROM ${this.tableName}`);
      stmt.run();
    } catch (error) {
      logger.error(`Error clearing cache: ${error}`);
    }
  }

  /**
   * Get all valid keys in the cache
   * @returns Array of valid (not expired) keys
   */
  keys(): string[] {
    try {
      const stmt = this.db.prepare(`
        SELECT key FROM ${this.tableName}
        WHERE expiry > ?
      `);
      
      const rows = stmt.all(Date.now()) as Pick<CacheRow, 'key'>[];
      return rows.map(row => row.key);
    } catch (error) {
      logger.error(`Error getting cache keys: ${error}`);
      return [];
    }
  }

  /**
   * Get the size of the cache (only non-expired items)
   * @returns Number of valid items in the cache
   */
  size(): number {
    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM ${this.tableName}
        WHERE expiry > ?
      `);
      
      const result = stmt.get(Date.now()) as { count: number } | undefined;
      return result ? result.count : 0;
    } catch (error) {
      logger.error(`Error getting cache size: ${error}`);
      return 0;
    }
  }

  /**
   * Clean expired items from the cache
   * @returns Number of items removed
   */
  cleanExpired(): number {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM ${this.tableName}
        WHERE expiry <= ?
      `);
      
      const result = stmt.run(Date.now());
      return result.changes;
    } catch (error) {
      logger.error(`Error cleaning expired cache entries: ${error}`);
      return 0;
    }
  }

  /**
   * Clean expired entries for a specific key
   * @param key The cache key to check
   */
  private cleanExpiredKey(key: string): void {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM ${this.tableName}
        WHERE key = ? AND expiry <= ?
      `);
      
      stmt.run(key, Date.now());
    } catch (error) {
      logger.error(`Error cleaning expired cache entry for key ${key}: ${error}`);
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch (error) {
        logger.error(`Error closing cache database: ${error}`);
      }
    }
  }
}