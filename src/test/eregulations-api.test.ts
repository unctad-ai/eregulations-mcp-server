import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { ERegulationsApi } from '../services/eregulations-api.js';
import { SqliteCache } from '../utils/db-cache.js';

// Mock dependencies
vi.mock('axios');
vi.mock('../utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));
vi.mock('../utils/db-cache.js', () => ({
  SqliteCache: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
    cleanExpired: vi.fn(),
    close: vi.fn()
  }))
}));

describe('ERegulationsApi', () => {
  const baseUrl = 'http://mock-eregulations-api.test';
  let api: ERegulationsApi;
  let mockCache: any;
  
  // Sample mock data based on real API responses
  const mockProceduresList = [
    {
      id: 725,
      name: "Import",
      links: [{ rel: "procedure", href: "/Procedures/725", method: "GET" }],
      subMenus: [
        {
          id: 1244,
          name: "Import Crystal Sugar",
          links: [{ rel: "procedure", href: "/Procedures/1244", method: "GET" }]
        }
      ]
    },
    {
      id: 736,
      name: "Export",
      links: [{ rel: "procedure", href: "/Procedures/736", method: "GET" }],
      childs: [
        {
          id: 1255,
          name: "Export Coffee",
          links: [{ rel: "procedure", href: "/Procedures/1255", method: "GET" }]
        }
      ]
    }
  ];
  
  const mockProcedureDetails = {
    id: 1244,
    name: "Import Crystal Sugar",
    explanatoryText: "This procedure describes how to import crystal sugar into Tanzania",
    isOnline: true,
    data: {
      id: 1244,
      name: "Import Crystal Sugar",
      url: "https://example.com/import-sugar",
      blocks: [
        {
          steps: [
            {
              id: 384,
              name: "Contract a clearing agent",
              isOnline: false,
              contact: {
                entityInCharge: {
                  name: "Tanzania Clearing Agents Association",
                  firstPhone: "+255 123 456 789"
                }
              }
            }
          ]
        }
      ]
    }
  };
  
  const mockProcedureStep = {
    data: {
      id: 384,
      name: "Contract a clearing agent",
      isOnline: false,
      contact: {
        entityInCharge: {
          name: "Tanzania Clearing Agents Association",
          firstPhone: "+255 123 456 789",
          firstEmail: "info@tcaa.co.tz",
          address: "Dar es Salaam, Tanzania"
        }
      },
      requirements: [
        {
          name: "Clearing Agent License",
          comments: "Must be registered with Tanzania Revenue Authority",
          nbOriginal: 1,
          nbCopy: 0
        }
      ],
      timeframe: {
        timeSpentAtTheCounter: {
          minutes: {
            max: 60
          }
        },
        waitingTimeUntilNextStep: {
          days: {
            max: 2
          }
        }
      },
      costs: [
        {
          value: 1000,
          unit: "TZS",
          comments: "Agent fees may vary"
        }
      ]
    },
    links: [
      {
        rel: "self",
        href: "/Procedures/1244/Steps/384",
        method: "GET"
      }
    ]
  };

  beforeEach(() => {
    vi.resetAllMocks();
    
    // Setup cache mock behavior
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn(),
      cleanExpired: vi.fn(),
      close: vi.fn()
    };
    (SqliteCache as any).mockImplementation(() => mockCache);
    
    // Create fresh API instance for each test
    api = new ERegulationsApi(baseUrl);
    
    // Mock successful axios responses by default
    (axios.create as any).mockReturnValue({
      get: vi.fn().mockResolvedValue({ data: {} }),
      request: vi.fn().mockResolvedValue({ data: {} })
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('initializes with correct baseUrl and cache enabled by default', () => {
      expect(api['baseUrl']).toBe(baseUrl);
      expect(api['cacheEnabled']).toBe(true);
      expect(SqliteCache).toHaveBeenCalledWith(baseUrl);
    });

    it('creates axios instance with correct configuration', () => {
      expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({
        timeout: expect.any(Number),
        headers: expect.objectContaining({
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        })
      }));
    });

    it('initializes with cache disabled when specified', () => {
      const apiNoCache = new ERegulationsApi(baseUrl, false);
      expect(apiNoCache['cacheEnabled']).toBe(false);
      expect(mockCache.clear).toHaveBeenCalled();
    });
  });

  describe('makeRequest', () => {
    it('makes HTTP requests with correct URL', async () => {
      // Mock the axios instance directly instead of mocking makeRequest method
      // to test the internal implementation
      const axiosGet = vi.fn().mockResolvedValue({ data: { test: 'data' } });
      (axios.create as any).mockReturnValue({ get: axiosGet });
      
      // Create a new API instance with the mocked axios
      api = new ERegulationsApi(baseUrl);
      
      // Call the private makeRequest method
      await (api as any).makeRequest('/test');
      
      // Check that the get method was called with the correct full URL
      // The baseUrl should be prepended to the path
      expect(axiosGet).toHaveBeenCalledWith('/test', expect.objectContaining({
        signal: expect.any(Object)
      }));
    });

    it('implements retry logic on failure', async () => {
      const error = new Error('Network error');
      const axiosGet = vi.fn()
        .mockRejectedValueOnce(error)  // First call fails
        .mockResolvedValueOnce({ data: { success: true } }); // Second call succeeds
      
      (axios.create as any).mockReturnValue({ get: axiosGet });
      api = new ERegulationsApi(baseUrl);
      
      const result = await (api as any).makeRequest('/test');
      
      expect(axiosGet).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: { success: true } });
    });

    it('throws error after exceeding maximum retries', async () => {
      const error = new Error('Persistent network error');
      const axiosGet = vi.fn().mockRejectedValue(error); // Always fails
      
      (axios.create as any).mockReturnValue({ get: axiosGet });
      api = new ERegulationsApi(baseUrl);
      
      await expect((api as any).makeRequest('/test', { maxRetries: 1 }))
        .rejects.toThrow(error);
      
      expect(axiosGet).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe('fetchWithCache', () => {
    const cacheKey = 'test_key';
    const mockData = { id: 123, name: 'Test Data' };
    const fetchFn = vi.fn().mockResolvedValue(mockData);
    const ttl = 3600000; // 1 hour
    
    it('returns cached data when available', async () => {
      mockCache.get.mockReturnValue(mockData);
      
      const result = await (api as any).fetchWithCache(cacheKey, fetchFn, ttl);
      
      expect(result).toEqual(mockData);
      expect(mockCache.get).toHaveBeenCalledWith(cacheKey);
      expect(fetchFn).not.toHaveBeenCalled(); // Fetch function not called
    });

    it('calls fetch function and caches result when cache misses', async () => {
      // Setup cache miss
      mockCache.get.mockReturnValue(null);
      
      // Create a mock function that actually returns the data
      const fetchFunction = vi.fn().mockImplementation(() => Promise.resolve(mockData));
      
      const result = await (api as any).fetchWithCache(cacheKey, fetchFunction, ttl);
      
      expect(fetchFunction).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith(cacheKey, mockData, ttl);
      expect(result).toEqual(mockData);
    });

    it('returns stale cache data on fetch error if available', async () => {
      mockCache.get
        .mockReturnValueOnce(null) // First call (normal get) returns null
        .mockReturnValueOnce(mockData); // Second call (get with allowExpired) returns data
      
      const errorFetchFn = vi.fn().mockRejectedValue(new Error('Fetch failed'));
      
      const result = await (api as any).fetchWithCache(cacheKey, errorFetchFn, ttl);
      
      expect(result).toEqual(mockData);
      expect(errorFetchFn).toHaveBeenCalled();
      expect(mockCache.get).toHaveBeenNthCalledWith(2, cacheKey, true); // Second call with allowExpired=true
    });

    it('throws error when fetch fails and no cache data is available', async () => {
      mockCache.get.mockReturnValue(null); // No cache data
      const error = new Error('Fetch failed and no cache');
      const errorFetchFn = vi.fn().mockRejectedValue(error);
      
      await expect((api as any).fetchWithCache(cacheKey, errorFetchFn, ttl))
        .rejects.toThrow(error);
    });

    it('bypasses cache when cacheEnabled is false', async () => {
      api = new ERegulationsApi(baseUrl, false); // Disable cache
      mockCache.get.mockReturnValue(mockData); // Cache would return data
      
      await (api as any).fetchWithCache(cacheKey, fetchFn, ttl);
      
      expect(fetchFn).toHaveBeenCalled(); // Should fetch despite cached data
      expect(mockCache.set).not.toHaveBeenCalled(); // Should not cache the result
    });
  });

  describe('getProceduresList', () => {
    it('fetches and processes procedures correctly', async () => {
      const mockAxiosGet = vi.fn().mockResolvedValue({ data: mockProceduresList });
      (api as any).makeRequest = mockAxiosGet;
      
      const procedures = await api.getProceduresList();
      
      expect(mockAxiosGet).toHaveBeenCalledWith(`${baseUrl}/Objectives`);
      expect(procedures).toBeInstanceOf(Array);
      expect(procedures.length).toBeGreaterThan(0);
      expect(procedures).toContainEqual(expect.objectContaining({
        id: 1244,
        name: "Import Crystal Sugar",
        fullName: "Import > Import Crystal Sugar"
      }));
      expect(procedures).toContainEqual(expect.objectContaining({
        id: 1255,
        name: "Export Coffee",
        fullName: "Export > Export Coffee"
      }));
    });

    it('handles empty procedures list', async () => {
      (api as any).makeRequest = vi.fn().mockResolvedValue({ data: [] });
      
      const procedures = await api.getProceduresList();
      
      expect(procedures).toEqual([]);
    });

    it('handles various API response formats', async () => {
      // Test object with 'items' array format
      (api as any).makeRequest = vi.fn().mockResolvedValue({
        data: { items: mockProceduresList }
      });
      
      const procedures1 = await api.getProceduresList();
      expect(procedures1.length).toBeGreaterThan(0);
      
      // Test object with 'data' array format
      (api as any).makeRequest = vi.fn().mockResolvedValue({
        data: { data: mockProceduresList }
      });
      
      const procedures2 = await api.getProceduresList();
      expect(procedures2.length).toBeGreaterThan(0);
    });

    it('extracts nested procedures correctly', async () => {
      const deeplyNested = [
        {
          id: 1,
          name: "Level 1",
          links: [{ rel: "procedure", href: "/Procedures/1" }],
          subMenus: [
            {
              id: 2,
              name: "Level 2",
              links: [{ rel: "procedure", href: "/Procedures/2" }],
              childs: [
                {
                  id: 3,
                  name: "Level 3",
                  links: [{ rel: "procedure", href: "/Procedures/3" }]
                }
              ]
            }
          ]
        }
      ];
      
      (api as any).makeRequest = vi.fn().mockResolvedValue({ data: deeplyNested });
      
      const procedures = await api.getProceduresList();
      
      expect(procedures).toContainEqual(expect.objectContaining({
        id: 1,
        name: "Level 1",
        fullName: "Level 1"
      }));
      expect(procedures).toContainEqual(expect.objectContaining({
        id: 2,
        name: "Level 2",
        fullName: "Level 1 > Level 2"
      }));
      expect(procedures).toContainEqual(expect.objectContaining({
        id: 3,
        name: "Level 3",
        fullName: "Level 1 > Level 2 > Level 3"
      }));
    });
  });

  describe('getProcedureById', () => {
    it('fetches procedure details by ID', async () => {
      (api as any).makeRequest = vi.fn().mockResolvedValue({ data: mockProcedureDetails });
      
      const procedure = await api.getProcedureById(1244);
      
      expect((api as any).makeRequest).toHaveBeenCalledWith(`${baseUrl}/Procedures/1244`);
      expect(procedure).toEqual(expect.objectContaining({
        id: 1244,
        name: "Import Crystal Sugar",
        explanatoryText: "This procedure describes how to import crystal sugar into Tanzania"
      }));
      // Should include additional links
      expect(procedure._links).toEqual(expect.objectContaining({
        self: `${baseUrl}/Procedures/1244`,
        resume: `${baseUrl}/Procedures/1244/Resume`
      }));
    });

    it('handles missing fields in procedure details', async () => {
      const incomplete = { name: "Incomplete Procedure" };
      (api as any).makeRequest = vi.fn().mockResolvedValue({ data: incomplete });
      
      const procedure = await api.getProcedureById(999);
      
      // Should fill in missing id from the parameter
      expect(procedure.id).toBe(999);
      expect(procedure.name).toBe("Incomplete Procedure");
    });
  });

  describe('getProcedureStep', () => {
    it('fetches step details correctly', async () => {
      (api as any).makeRequest = vi.fn().mockResolvedValue({ data: mockProcedureStep });
      
      const step = await api.getProcedureStep(1244, 384);
      
      expect((api as any).makeRequest).toHaveBeenCalledWith(`${baseUrl}/Procedures/1244/Steps/384`);
      expect(step).toEqual(expect.objectContaining({
        id: 384,
        name: "Contract a clearing agent",
        procedureId: 1244
      }));
      expect(step.contact?.entityInCharge?.name).toBe("Tanzania Clearing Agents Association");
    });

    it('handles incomplete step data', async () => {
      const incompleteStep = { data: { id: 123 } };
      (api as any).makeRequest = vi.fn().mockResolvedValue({ data: incompleteStep });
      
      const step = await api.getProcedureStep(1244, 123);
      
      expect(step.id).toBe(123);
      expect(step.name).toBe("Unknown"); // Default value
      expect(step.procedureId).toBe(1244);
    });

    it('throws error when step data is missing', async () => {
      (api as any).makeRequest = vi.fn().mockResolvedValue({ data: null });
      
      await expect(api.getProcedureStep(1244, 999))
        .rejects.toThrow("Failed to get step 999 for procedure 1244");
    });
  });

  describe('other getters', () => {
    it('fetches procedure resume correctly', async () => {
      const resumeData = { steps: 5, institutions: 3 };
      (api as any).makeRequest = vi.fn().mockResolvedValue({ data: resumeData });
      
      const result = await api.getProcedureResume(1244);
      
      expect((api as any).makeRequest).toHaveBeenCalledWith(`${baseUrl}/Procedures/1244/Resume`);
      expect(result).toEqual(resumeData);
    });
    
    it('fetches procedure totals correctly', async () => {
      const totalsData = { time: 30, cost: 5000 };
      (api as any).makeRequest = vi.fn().mockResolvedValue({ data: totalsData });
      
      const result = await api.getProcedureTotals(1244);
      
      expect((api as any).makeRequest).toHaveBeenCalledWith(`${baseUrl}/Procedures/1244/Totals`);
      expect(result).toEqual(totalsData);
    });
    
    it('handles null response data gracefully', async () => {
      (api as any).makeRequest = vi.fn().mockResolvedValue({ data: null });
      
      const result = await api.getProcedureABC(1244);
      
      expect(result).toBeNull();
    });
  });

  describe('dispose', () => {
    it('cleans up resources properly', () => {
      // Setup a spy on clearInterval
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      api.dispose();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(mockCache.close).toHaveBeenCalled();
    });
  });
});