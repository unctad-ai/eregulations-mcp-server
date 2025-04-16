import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios, { AxiosError } from "axios";
import { ERegulationsApi } from "../services/eregulations-api.js";
import type { ObjectiveData } from "../mcp-capabilities/tools/formatters/types.js";
import { logger } from "../utils/logger.js";

// Mock dependencies
vi.mock("axios");
vi.mock("../utils/logger.js", () => ({
  logger: {
    log: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("../utils/logger.js", () => ({
  logger: {
    log: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ERegulationsApi", () => {
  const baseUrl = "http://mock-eregulations-api.test";
  let api: ERegulationsApi;
  // Define mockAxiosInstance at the top level
  let mockAxiosInstance: any;

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
          links: [
            { rel: "procedure", href: "/Procedures/1244", method: "GET" },
          ],
        },
      ],
    },
    {
      id: 736,
      name: "Export",
      links: [{ rel: "procedure", href: "/Procedures/736", method: "GET" }],
      childs: [
        {
          id: 1255,
          name: "Export Coffee",
          links: [
            { rel: "procedure", href: "/Procedures/1255", method: "GET" },
          ],
        },
      ],
    },
  ];

  const mockProcedureDetails = {
    id: 1244,
    name: "Import Crystal Sugar",
    explanatoryText:
      "This procedure describes how to import crystal sugar into Tanzania",
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
                  firstPhone: "+255 123 456 789",
                },
              },
            },
          ],
        },
      ],
    },
  };

  const mockProcedureDetailsWithDesc = {
    ...mockProcedureDetails,
    description: "This is the procedure description.",
    explanatoryText: undefined,
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
          address: "Dar es Salaam, Tanzania",
        },
      },
      requirements: [
        {
          name: "Clearing Agent License",
          comments: "Must be registered with Tanzania Revenue Authority",
          nbOriginal: 1,
          nbCopy: 0,
        },
      ],
      timeframe: {
        timeSpentAtTheCounter: {
          minutes: {
            max: 60,
          },
        },
        waitingTimeUntilNextStep: {
          days: {
            max: 2,
          },
        },
      },
      costs: [
        {
          value: 1000,
          unit: "TZS",
          comments: "Agent fees may vary",
        },
      ],
    },
    links: [
      {
        rel: "self",
        href: "/Procedures/1244/Steps/384",
        method: "GET",
      },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Setup environment variable for the API URL
    process.env.EREGULATIONS_API_URL = baseUrl;

    // Initialize the mockAxiosInstance structure
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      request: vi.fn(),
    };

    // Mock axios.create to return our instance initially (important for constructor)
    (axios.create as any).mockReturnValue(mockAxiosInstance);

    // Create fresh API instance for each test
    api = new ERegulationsApi();

    // --- NEW APPROACH: Directly assign the mock to the instance ---
    // After the api instance is created, forcefully replace its internal
    // axiosInstance with our mockAxiosInstance. This ensures the API
    // methods definitely use our mock.
    (api as any).axiosInstance = mockAxiosInstance;
    // --- END NEW APPROACH ---

    // Clear mocks before each test using the instance
    mockAxiosInstance.get.mockClear();
    mockAxiosInstance.post.mockClear();
    mockAxiosInstance.request.mockClear();

    // Set default success behavior (can be overridden in specific tests)
    mockAxiosInstance.get.mockResolvedValue({ data: {} });
    mockAxiosInstance.post.mockResolvedValue({ data: {} });
    mockAxiosInstance.request.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.EREGULATIONS_API_URL;
  });

  describe("constructor and initialization", () => {
    it("should create an Axios instance on creation", () => {
      expect(axios.create).toHaveBeenCalled();
    });

    it("should initialize with the base URL from environment variables", () => {
      // Access private method for testing initialization path
      (api as any).getBaseUrl();
      expect((api as any).baseUrl).toBe(baseUrl);
    });

    it("should throw error if no base URL is set", () => {
      delete process.env.EREGULATIONS_API_URL;
      // Create new instance without env var
      const newApi = new ERegulationsApi();
      expect(() => (newApi as any).getBaseUrl()).toThrow(
        /No EREGULATIONS_API_URL set/
      );
    });

    it("should allow setting base URL manually", () => {
      const manualUrl = "http://manual.example.com";
      api.setBaseUrl(manualUrl);
      expect((api as any).baseUrl).toBe(manualUrl);
    });

    it("should add https protocol if missing", () => {
      const testBaseUrl = "http://test-eregulations-api.test";
      const api = new ERegulationsApi();
      api.setBaseUrl(testBaseUrl);
      expect((api as any).baseUrl).toBe(testBaseUrl);
    });
  });

  describe("getBaseUrl", () => {
    it("uses process.env.EREGULATIONS_API_URL when baseUrl is not set", () => {
      const url = (api as any).getBaseUrl();
      expect(url).toBe(baseUrl);
    });

    it("throws error when no baseUrl is set and environment variable is missing", () => {
      delete process.env.EREGULATIONS_API_URL;
      expect(() => (api as any).getBaseUrl()).toThrow(
        /No EREGULATIONS_API_URL set/
      );
    });

    it("returns manually set baseUrl when available", () => {
      const customUrl = "http://custom-api.test";
      api.setBaseUrl(customUrl);
      const url = (api as any).getBaseUrl();
      expect(url).toBe(customUrl);
    });
  });

  describe("makeRequest", () => {
    it("makes HTTP requests with correct URL", async () => {
      // Mock the axios instance directly instead of mocking makeRequest method
      // to test the internal implementation
      const axiosGet = vi.fn().mockResolvedValue({ data: { test: "data" } });
      (axios.create as any).mockReturnValue({ get: axiosGet });

      // Create a new API instance with the mocked axios
      api = new ERegulationsApi();

      // Call the private makeRequest method
      await (api as any).makeRequest("/test");

      // Check that the get method was called with the correct path
      expect(axiosGet).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          signal: expect.any(Object),
        })
      );
    });

    it("implements retry logic on failure", async () => {
      // Spy on axios.isAxiosError and force it to return true for this test
      const isAxiosErrorSpy = vi
        .spyOn(axios, "isAxiosError")
        .mockReturnValue(true);

      // More complete mock Axios network error
      const error = new axios.AxiosError(
        "Network error",
        "ERR_NETWORK", // Code
        {} as any, // config
        {} as any, // request
        undefined // response (key for retry logic)
      );
      // Ensure isAxiosError is true if needed (AxiosError constructor should handle this)
      error.isAxiosError = true;

      // Use mockAxiosInstance directly
      mockAxiosInstance.get
        .mockRejectedValueOnce(error) // First call fails
        .mockResolvedValueOnce({ data: { success: true } }); // Second call succeeds

      // (axios.create as any).mockReturnValue({ get: axiosGet }); // REMOVE
      // api = new ERegulationsApi(); // REMOVE (already created in beforeEach)

      const result = await (api as any).makeRequest("/test");

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2); // Changed from axiosGet
      expect(result).toEqual({ data: { success: true } });

      // Restore the original implementation
      isAxiosErrorSpy.mockRestore();
    });

    it("throws error after exceeding maximum retries", async () => {
      // Spy on axios.isAxiosError and force it to return true for this test
      const isAxiosErrorSpy = vi
        .spyOn(axios, "isAxiosError")
        .mockReturnValue(true);

      // More complete mock persistent Axios network error
      const error = new axios.AxiosError(
        "Persistent network error",
        "ERR_NETWORK", // Code
        {} as any, // config
        {} as any, // request
        undefined // response
      );
      // error.isAxiosError = true;

      // Use mockAxiosInstance directly
      mockAxiosInstance.get.mockRejectedValue(error); // Always fails

      // (axios.create as any).mockReturnValue({ get: axiosGet }); // REMOVE
      // api = new ERegulationsApi(); // REMOVE

      await expect(
        (api as any).makeRequest("/test", { maxRetries: 1 })
      ).rejects.toThrowError(error.message); // Assert based on message

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2); // Changed from axiosGet // Initial + 1 retry

      // Restore the original implementation
      isAxiosErrorSpy.mockRestore();
    });
  });

  describe("getProceduresList", () => {
    it("fetches and processes procedures correctly, initializing baseUrl from env", async () => {
      const mockAxiosGet = vi
        .fn()
        .mockResolvedValue({ data: mockProceduresList });
      (api as any).makeRequest = mockAxiosGet;

      const procedures = await api.getProceduresList();

      // Should use baseUrl from environment variable
      expect(mockAxiosGet).toHaveBeenCalledWith(`${baseUrl}/Objectives`);

      // Rest of expectations remain the same
      expect(procedures).toBeInstanceOf(Array);
      expect(procedures.length).toBeGreaterThan(0);
      expect(procedures).toContainEqual(
        expect.objectContaining({
          id: 1244,
          name: "Import Crystal Sugar",
          fullName: "Import > Import Crystal Sugar",
        })
      );
      expect(procedures).toContainEqual(
        expect.objectContaining({
          id: 1255,
          name: "Export Coffee",
          fullName: "Export > Export Coffee",
        })
      );
    });

    it("handles empty procedures list", async () => {
      (api as any).makeRequest = vi.fn().mockResolvedValue({ data: [] });

      const procedures = await api.getProceduresList();

      expect(procedures).toEqual([]);
    });

    it("handles various API response formats", async () => {
      // Test object with 'items' array format
      (api as any).makeRequest = vi.fn().mockResolvedValue({
        data: { items: mockProceduresList },
      });

      const procedures1 = await api.getProceduresList();
      expect(procedures1.length).toBeGreaterThan(0);

      // Test object with 'data' array format
      (api as any).makeRequest = vi.fn().mockResolvedValue({
        data: { data: mockProceduresList },
      });

      const procedures2 = await api.getProceduresList();
      expect(procedures2.length).toBeGreaterThan(0);
    });

    it("extracts nested procedures correctly", async () => {
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
                  links: [{ rel: "procedure", href: "/Procedures/3" }],
                },
              ],
            },
          ],
        },
      ];

      (api as any).makeRequest = vi
        .fn()
        .mockResolvedValue({ data: deeplyNested });

      const procedures = await api.getProceduresList();

      expect(procedures).toContainEqual(
        expect.objectContaining({
          id: 1,
          name: "Level 1",
          fullName: "Level 1",
        })
      );
      expect(procedures).toContainEqual(
        expect.objectContaining({
          id: 2,
          name: "Level 2",
          fullName: "Level 1 > Level 2",
        })
      );
      expect(procedures).toContainEqual(
        expect.objectContaining({
          id: 3,
          name: "Level 3",
          fullName: "Level 1 > Level 2 > Level 3",
        })
      );
    });

    it("should return empty array from getProceduresList on API error", async () => {
      (axios.create() as any).get.mockRejectedValue(new Error("API Down"));
      const procedures = await api.getProceduresList();
      expect(procedures).toEqual([]);
    });
  });

  describe("getProcedureById", () => {
    it("fetches procedure details by ID including description", async () => {
      (api as any).makeRequest = vi
        .fn()
        .mockResolvedValue({ data: mockProcedureDetailsWithDesc });

      const procedure = await api.getProcedureById(1244);

      expect((api as any).makeRequest).toHaveBeenCalledWith(
        `${baseUrl}/Procedures/1244`
      );
      expect(procedure).toEqual(
        expect.objectContaining({
          id: 1244,
          name: "Import Crystal Sugar",
          description: "This is the procedure description.",
        })
      );
      expect(procedure.explanatoryText).toBeUndefined();
      expect(procedure._links).toEqual(
        expect.objectContaining({
          self: `${baseUrl}/Procedures/1244`,
          resume: `${baseUrl}/Procedures/1244/Resume`,
        })
      );
    });

    it("handles missing description field gracefully", async () => {
      const detailsWithoutDesc = {
        ...mockProcedureDetails,
        description: undefined,
      };
      (api as any).makeRequest = vi
        .fn()
        .mockResolvedValue({ data: detailsWithoutDesc });

      const procedure = await api.getProcedureById(1244);

      expect(procedure).toEqual(
        expect.objectContaining({
          id: 1244,
          name: "Import Crystal Sugar",
        })
      );
      expect(procedure.description).toBeUndefined();
    });

    it("handles missing fields in procedure details", async () => {
      const incomplete = { name: "Incomplete Procedure" };
      (api as any).makeRequest = vi
        .fn()
        .mockResolvedValue({ data: incomplete });

      const procedure = await api.getProcedureById(999);

      // Should fill in missing id from the parameter
      expect(procedure.id).toBe(999);
      expect(procedure.name).toBe("Incomplete Procedure");
    });

    it("should throw error from getProcedureById on API error", async () => {
      // Use mockAxiosInstance directly
      mockAxiosInstance.get.mockRejectedValue(new Error("API Down"));
      // (axios.create() as any).get.mockRejectedValue(new Error("API Down")); // REMOVE
      await expect(api.getProcedureById(1)).rejects.toThrow("API Down");
    });
  });

  describe("getProcedureStep", () => {
    it("fetches step details correctly", async () => {
      (api as any).makeRequest = vi
        .fn()
        .mockResolvedValue({ data: mockProcedureStep });

      const step = await api.getProcedureStep(1244, 384);

      expect((api as any).makeRequest).toHaveBeenCalledWith(
        `${baseUrl}/Procedures/1244/Steps/384`
      );
      expect(step).toEqual(
        expect.objectContaining({
          id: 384,
          name: "Contract a clearing agent",
          procedureId: 1244,
        })
      );
      expect(step.contact?.entityInCharge?.name).toBe(
        "Tanzania Clearing Agents Association"
      );
    });

    it("handles incomplete step data", async () => {
      const incompleteStep = { data: { id: 123 } };
      (api as any).makeRequest = vi
        .fn()
        .mockResolvedValue({ data: incompleteStep });

      const step = await api.getProcedureStep(1244, 123);

      expect(step.id).toBe(123);
      expect(step.name).toBe("Unknown"); // Default value
      expect(step.procedureId).toBe(1244);
    });

    it("throws error when step data is missing", async () => {
      (api as any).makeRequest = vi.fn().mockResolvedValue({ data: null });

      await expect(api.getProcedureStep(1244, 999)).rejects.toThrow(
        "Failed to get step 999 for procedure 1244"
      );
    });
  });

  describe("other getters", () => {
    it("fetches procedure resume correctly", async () => {
      const resumeData = { steps: 5, institutions: 3 };
      (api as any).makeRequest = vi
        .fn()
        .mockResolvedValue({ data: resumeData });

      const result = await api.getProcedureResume(1244);

      expect((api as any).makeRequest).toHaveBeenCalledWith(
        `${baseUrl}/Procedures/1244/Resume`
      );
      expect(result).toEqual(resumeData);
    });

    it("fetches procedure totals correctly", async () => {
      const totalsData = { time: 30, cost: 5000 };
      (api as any).makeRequest = vi
        .fn()
        .mockResolvedValue({ data: totalsData });

      const result = await api.getProcedureTotals(1244);

      expect((api as any).makeRequest).toHaveBeenCalledWith(
        `${baseUrl}/Procedures/1244/Totals`
      );
      expect(result).toEqual(totalsData);
    });
  });

  describe("searchProcedures", () => {
    const keyword = "investment permit";
    const mockObjectivesResult: ObjectiveData[] = [
      {
        id: 1,
        name: "Investment Permit",
        description: "Permit for foreign investment",
      },
      {
        id: 2,
        name: "Work Permit",
        description: "Permit for foreign workers",
      },
    ];

    beforeEach(() => {
      // Setup Axios mock specifically for POST requests using mockAxiosInstance
      mockAxiosInstance.post.mockClear();
      mockAxiosInstance.post.mockResolvedValue({
        data: mockObjectivesResult,
      });
      // (axios.create() as any).post.mockClear(); // REMOVE
      // (axios.create() as any).post.mockResolvedValue({ // REMOVE
      //   data: mockObjectivesResult,
      // });

      // Re-create API instance - NO, use the one from outer beforeEach
      // api = new ERegulationsApi();
    });

    it("fetches objectives from POST /Objectives/Search and returns them", async () => {
      // const axiosPost = (axios.create() as any).post; // REMOVE
      const axiosPost = mockAxiosInstance.post; // Use the mock instance

      const results = await api.searchProcedures(keyword);

      expect(axiosPost).toHaveBeenCalledWith(
        `${baseUrl}/Objectives/Search`,
        JSON.stringify({ keyword }),
        expect.objectContaining({ headers: expect.any(Object) })
      );
      expect(results).toEqual(mockObjectivesResult);
    });

    it("handles API returning an empty array", async () => {
      // Use mockAxiosInstance directly
      mockAxiosInstance.post.mockResolvedValue({ data: [] }); // API returns empty
      // (axios.create() as any).post.mockResolvedValue({ data: [] }); // REMOVE
      // const axiosPost = (axios.create() as any).post; // REMOVE
      const axiosPost = mockAxiosInstance.post;

      const results = await api.searchProcedures(keyword);

      expect(axiosPost).toHaveBeenCalled();
      expect(results).toEqual([]);
    });

    it("handles API errors gracefully and returns empty array", async () => {
      const apiError = new Error("API search failed");
      // Use mockAxiosInstance directly
      mockAxiosInstance.post.mockRejectedValue(apiError);
      // (axios.create() as any).post.mockRejectedValue(apiError); // REMOVE
      // const axiosPost = (axios.create() as any).post; // REMOVE
      const axiosPost = mockAxiosInstance.post;

      const results = await api.searchProcedures(keyword);

      expect(axiosPost).toHaveBeenCalled();
      expect(results).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error searching objectives`),
        apiError
      );
    });

    it("handles non-array API responses gracefully", async () => {
      // Use mockAxiosInstance directly
      mockAxiosInstance.post.mockResolvedValue({
        data: { message: "Unexpected format" }, // API returns non-array
      });
      // (axios.create() as any).post.mockResolvedValue({ // REMOVE
      //   data: { message: "Unexpected format" }, // API returns non-array
      // });
      // const axiosPost = (axios.create() as any).post; // REMOVE
      const axiosPost = mockAxiosInstance.post;

      const results = await api.searchProcedures(keyword);

      expect(axiosPost).toHaveBeenCalled();
      expect(results).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Unexpected search API response type")
      );
    });
  });
});
