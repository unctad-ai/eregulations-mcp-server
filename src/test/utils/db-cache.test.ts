import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SqliteCache } from '../../utils/db-cache.js';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Mock dependencies
vi.mock('better-sqlite3');
vi.mock('fs');
vi.mock('path');
vi.mock('crypto');
vi.mock('../../utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('SqliteCache', () => {
  const baseUrl = 'http://mock-eregulations-api.test';
  const hashedBaseUrl = 'mock-hash';
  const mockDbPath = '/mock/path/to/cache/mock-hash.sqlite';
  
  let mockDb: any;
  let mockStmt: any;
  let cache: SqliteCache;
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Mock path operations
    (path.resolve as any).mockReturnValue('/mock/path/to/cache');
    (path.join as any).mockReturnValue(mockDbPath);
    
    // Mock fs operations
    (fs.existsSync as any).mockReturnValue(true);
    (fs.mkdirSync as any).mockImplementation(() => undefined);
    
    // Mock crypto hash
    (crypto.createHash as any).mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue(hashedBaseUrl)
    });
    
    // Create a mock prepared statement that can be referenced by tests
    mockStmt = {
      run: vi.fn().mockReturnValue({ changes: 1 }),
      get: vi.fn(),
      all: vi.fn().mockReturnValue([])
    };
    
    // Mock database operations
    mockDb = {
      exec: vi.fn(),
      prepare: vi.fn().mockReturnValue(mockStmt),
      close: vi.fn()
    };
    (Database as any).mockReturnValue(mockDb);
    
    // Create a cache instance
    cache = new SqliteCache(baseUrl);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('constructor', () => {
    it('creates database with correct filename based on hashed baseUrl', () => {
      expect(crypto.createHash).toHaveBeenCalledWith('md5');
      expect(Database).toHaveBeenCalledWith(mockDbPath);
      expect(mockDb.exec).toHaveBeenCalled();
    });
    
    it('creates cache directory if it does not exist', () => {
      (fs.existsSync as any).mockReturnValueOnce(false);
      
      new SqliteCache(baseUrl);
      
      expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/path/to/cache', { recursive: true });
    });
    
    it('falls back to in-memory database on file access error', () => {
      (Database as any).mockImplementationOnce(() => { throw new Error('File access error'); });
      
      cache = new SqliteCache(baseUrl);
      
      // Should retry with in-memory database
      expect(Database).toHaveBeenLastCalledWith(':memory:');
    });
  });
  
  describe('set', () => {
    it('inserts data into the cache with correct TTL', () => {
      const key = 'test-key';
      const data = { id: 123, name: 'Test Item' };
      const ttl = 60000; // 1 minute
      
      // Mock current time
      const now = 1648000000000; // Some fixed timestamp
      vi.spyOn(Date, 'now').mockReturnValue(now);
      
      cache.set(key, data, ttl);
      
      expect(mockDb.prepare).toHaveBeenCalled();
      const prepareArg = mockDb.prepare.mock.calls[0][0];
      expect(prepareArg).toContain('INSERT OR REPLACE');
      
      const runCall = mockStmt.run.mock.calls[0];
      expect(runCall[0]).toBe(key);
      expect(JSON.parse(runCall[1])).toEqual(data);
      expect(runCall[2]).toBe(now + ttl);
    });
    
    it('uses default TTL when not specified', () => {
      const key = 'test-key';
      const data = { id: 123 };
      const defaultTtl = 3600000; // 1 hour (default)
      
      // Mock current time
      const now = 1648000000000; // Some fixed timestamp
      vi.spyOn(Date, 'now').mockReturnValue(now);
      
      cache.set(key, data);
      
      const runCall = mockStmt.run.mock.calls[0];
      expect(runCall[2]).toBe(now + defaultTtl);
    });
  });
  
  describe('get', () => {
    it('returns cached data when available and not expired', () => {
      const key = 'test-key';
      const data = { id: 123, name: 'Test Item' };
      const serializedData = JSON.stringify(data);
      
      // Setup mock to return cached data
      mockStmt.get.mockReturnValueOnce({ data: serializedData });
      
      const result = cache.get(key);
      
      expect(result).toEqual(data);
      expect(mockDb.prepare).toHaveBeenCalled();
    });
    
    it('returns null when key does not exist', () => {
      // Setup mock to return undefined (no cached data)
      mockStmt.get.mockReturnValueOnce(undefined);
      
      const result = cache.get('nonexistent-key');
      
      expect(result).toBeNull();
    });
    
    it('includes expiry check by default', () => {
      cache.get('test-key');
      
      // The prepare call should include expiry check
      const prepareArg = mockDb.prepare.mock.calls[1][0]; // Get second call, after cleanExpiredKey
      expect(prepareArg).toContain('expiry >');
    });
    
    it('returns expired entries when allowExpired is true', () => {
      const key = 'test-key';
      const data = { id: 123 };
      
      // Setup mock to return data regardless of expiry
      mockStmt.get.mockReturnValueOnce({ data: JSON.stringify(data) });
      
      const result = cache.get(key, true);
      
      expect(result).toEqual(data);
      
      // The prepare call should not include expiry check
      const prepareArg = mockDb.prepare.mock.calls[0][0]; 
      expect(prepareArg).not.toContain('expiry >');
    });
  });
  
  describe('updateNamespace', () => {
    it('closes the old database and creates a new one with updated namespace', () => {
      const newBaseUrl = 'http://new-api-url.test';
      const newHashedBaseUrl = 'new-mock-hash';
      const newDbPath = '/mock/path/to/cache/new-mock-hash.sqlite';
      
      // Mock for the new hash
      (crypto.createHash as any).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(newHashedBaseUrl)
      });
      
      // Mock for the new path
      (path.join as any).mockReturnValue(newDbPath);
      
      // Call updateNamespace
      cache.updateNamespace(newBaseUrl);
      
      // Should close the old database
      expect(mockDb.close).toHaveBeenCalled();
      
      // Should create a new database with the new namespace
      expect(Database).toHaveBeenCalledWith(newDbPath);
      
      // Should initialize the new database
      expect(mockDb.exec).toHaveBeenCalled();
    });
    
    it('falls back to in-memory database on error', () => {
      const newBaseUrl = 'http://error-api-url.test';
      
      // Reset mock implementation
      (Database as any).mockReset();
      
      // Set up sequence of mock behavior:
      // 1. Return mockDb for the constructor call
      // 2. Throw error when updateNamespace calls it
      // 3. Return mockDb for the :memory: fallback
      (Database as any)
        .mockImplementationOnce(() => mockDb)
        .mockImplementationOnce(() => { 
          throw new Error('File access error'); 
        })
        .mockImplementationOnce(() => mockDb);
      
      // Create a fresh cache instance
      cache = new SqliteCache(baseUrl);
      
      // Now call updateNamespace which should trigger the error and fallback
      cache.updateNamespace(newBaseUrl);
      
      // Since this is the third call to Database, it should be with ':memory:'
      expect(Database).toHaveBeenNthCalledWith(3, ':memory:');
    });
    
    it('throws error when baseUrl is empty', () => {
      expect(() => cache.updateNamespace('')).toThrow('Base URL cannot be empty');
    });
  });
  
  describe('cleanExpired', () => {
    it('removes expired entries', () => {
      const mockChanges = 5;
      
      // Mock statement result with changes count
      mockStmt.run.mockReturnValueOnce({ changes: mockChanges });
      
      const result = cache.cleanExpired();
      
      expect(result).toBe(mockChanges);
      expect(mockDb.prepare).toHaveBeenCalled();
      
      const prepareArg = mockDb.prepare.mock.calls[0][0];
      expect(prepareArg).toContain('DELETE FROM');
      expect(prepareArg).toContain('expiry <=');
    });
  });
  
  describe('close', () => {
    it('closes the database connection', () => {
      cache.close();
      expect(mockDb.close).toHaveBeenCalled();
    });
    
    it('handles errors gracefully', () => {
      mockDb.close.mockImplementationOnce(() => { throw new Error('Close error'); });
      
      // Should not throw
      expect(() => cache.close()).not.toThrow();
    });
  });
});