import axios, { AxiosRequestConfig, AxiosResponse, AxiosInstance } from "axios";
import { logger } from "../utils/logger.js";
import { SqliteCache } from "../utils/db-cache.js";

/**
 * Cache TTL constants in milliseconds
 */
const CACHE_TTL = {
  PROCEDURES_LIST: 30 * 24 * 60 * 60 * 1000, // 30 days
  PROCEDURE_DETAILS: 7 * 24 * 60 * 60 * 1000, // 7 days
  PROCEDURE_COMPONENTS: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Default request configuration
 */
const REQUEST_CONFIG = {
  TIMEOUT: 60000, // 60 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // 2 seconds
};

/**
 * API link structure
 */
interface ApiLink {
  href: string;
  rel: string;
  method?: string;
}

/**
 * Basic File model structure (assumed)
 */
interface FileModel {
  url?: string;
  name?: string;
  contentType?: string;
}

/**
 * Base structure for Objective models
 */
interface ObjectiveBaseModel {
  id: number;
  name: string;
  links?: ApiLink[];
}

/**
 * Objective model with description and extended details
 */
interface ObjectiveWithDescriptionModel extends ObjectiveBaseModel {
  description?: string;
  order?: number;
  subMenus?: ObjectiveBaseModel[];
  icon?: FileModel;
}

/**
 * Objective model with description (base version for search results)
 */
interface ObjectiveWithDescriptionBaseModel extends ObjectiveBaseModel {
  description?: string;
}

/**
 * Procedure entity structure
 */
interface Procedure {
  id: number;
  name: string;
  description?: string;
  fullName?: string;
  parentName?: string | null;
  isProcedure?: boolean;
  explanatoryText?: string;
  isOnline?: boolean;
  links?: ApiLink[];
  subMenus?: Procedure[];
  childs?: Procedure[];
  data?: {
    id?: number;
    name?: string;
    url?: string;
    blocks?: {
      steps?: Step[];
    }[];
  };
  _links?: Record<string, string>;
}

/**
 * Step entity structure
 */
interface Step {
  id: number;
  name: string;
  procedureId?: number;
  procedureName?: string;
  isOptional?: boolean;
  isCertified?: boolean;
  isParallel?: boolean;
  isOnline?: boolean;
  online?: {
    url?: string;
  };
  contact?: {
    entityInCharge?: {
      name: string;
      firstPhone?: string;
      secondPhone?: string;
      firstEmail?: string;
      secondEmail?: string;
      firstWebsite?: string;
      secondWebsite?: string;
      address?: string;
      scheduleComments?: string;
    };
    unitInCharge?: {
      name: string;
    };
    personInCharge?: {
      name: string;
      profession?: string;
    };
  };
  requirements?: {
    name: string;
    comments?: string;
    nbOriginal?: number;
    nbCopy?: number;
    nbAuthenticated?: number;
  }[];
  results?: {
    name: string;
    comments?: string;
    isFinalResult?: boolean;
  }[];
  timeframe?: {
    timeSpentAtTheCounter?: {
      minutes?: {
        max: number;
      };
    };
    waitingTimeInLine?: {
      minutes?: {
        max: number;
      };
    };
    waitingTimeUntilNextStep?: {
      days?: {
        max: number;
      };
    };
    comments?: string;
  };
  costs?: {
    value?: number;
    unit?: string;
    operator?: string;
    parameter?: string;
    comments?: string;
    paymentDetails?: string;
  }[];
  additionalInfo?: {
    text: string;
  };
  laws?: {
    name: string;
  }[];
  _links?: ApiLink[];
}

/**
 * Custom request config that extends AxiosRequestConfig
 */
interface RequestConfig extends AxiosRequestConfig {
  maxRetries?: number;
  retryDelay?: number;
}

export class ERegulationsApi {
  private baseUrl: string | null = null;
  private cache: SqliteCache | null = null;
  private cacheEnabled: boolean;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private axiosInstance: AxiosInstance;

  constructor(cacheEnabled: boolean = true) {
    this.cacheEnabled = cacheEnabled;

    // Create a single axios instance to reuse
    this.axiosInstance = axios.create({
      timeout: REQUEST_CONFIG.TIMEOUT,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0",
      },
    });

    // We'll initialize the cache on first use when the baseUrl is known
    // This ensures we have the correct namespace from the beginning

    if (!cacheEnabled) {
      logger.warn(
        "Cache is disabled. All requests will be made to the server."
      );
    }
  }

  /**
   * Initialize and get the cache instance
   * @returns The SqliteCache instance
   */
  private getCache(): SqliteCache {
    if (!this.cache) {
      // Get the base URL to use as namespace
      const baseUrl = this.getBaseUrl();
      const namespace = `api-cache-${baseUrl}`;

      logger.debug(
        `Initializing cache with namespace based on API URL: ${namespace}`
      );
      this.cache = new SqliteCache(namespace);

      // Set up periodic cache cleanup if enabled
      if (this.cacheEnabled && !this.cleanupInterval) {
        this.cleanupInterval = setInterval(() => {
          const removed = this.cache!.cleanExpired();
          if (removed > 0) {
            logger.debug(`Cache cleanup: removed ${removed} expired items`);
          }
        }, 24 * 60 * 60 * 1000); // Once per day
      }

      // Clear cache if it's disabled
      if (!this.cacheEnabled) {
        this.cache.clear();
      }
    }

    return this.cache;
  }

  /**
   * Sets the API base URL manually
   * @param url The base URL for the eRegulations API
   */
  setBaseUrl(url: string): void {
    if (!url) {
      throw new Error("Base URL cannot be empty");
    }

    // Ensure the URL has the proper protocol prefix
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    logger.log(`Manually setting API URL: ${url}`);
    this.baseUrl = url;

    // Update the cache namespace with the new URL
    this.cache?.updateNamespace(url);
  }

  /**
   * Get the base URL for the API, initializing it if necessary
   * @returns The base URL for the API
   * @throws Error if the base URL cannot be determined
   */
  private getBaseUrl(): string {
    if (!this.baseUrl) {
      const apiUrl = process.env.EREGULATIONS_API_URL;
      if (!apiUrl) {
        throw new Error(
          "No EREGULATIONS_API_URL set. Please set the EREGULATIONS_API_URL environment variable or use setBaseUrl() method."
        );
      }

      // Ensure the URL has the proper protocol prefix
      let urlWithProtocol = apiUrl;
      if (
        !urlWithProtocol.startsWith("http://") &&
        !urlWithProtocol.startsWith("https://")
      ) {
        urlWithProtocol = "https://" + urlWithProtocol;
      }

      logger.log(`Initializing API with URL: ${urlWithProtocol}`);
      this.baseUrl = urlWithProtocol;

      // Now that we have the real baseUrl, update the cache namespace
      this.cache?.updateNamespace(urlWithProtocol);
    }

    return this.baseUrl;
  }

  /**
   * Helper function to make HTTP requests with retry logic
   * @param url The URL to fetch
   * @param config Optional axios config
   * @returns The HTTP response
   */
  private async makeRequest<T = unknown>(
    url: string,
    config: RequestConfig = {}
  ): Promise<AxiosResponse<T>> {
    // Validate that we have a URL to work with
    if (!url) {
      throw new Error("URL is required for API requests");
    }

    // Ensure URL has protocol - only for absolute URLs, not for relative paths (which typically start with /)
    if (
      !url.startsWith("/") &&
      !url.startsWith("http://") &&
      !url.startsWith("https://")
    ) {
      url = "https://" + url;
      logger.log(`Added https:// protocol to URL: ${url}`);
    }

    let retries = 0;
    const maxRetries = config.maxRetries || REQUEST_CONFIG.MAX_RETRIES;
    const retryDelay = config.retryDelay || REQUEST_CONFIG.RETRY_DELAY;

    // Create a single controller for all retry attempts
    const controller = new AbortController();
    const signal = controller.signal;

    try {
      // Attach the signal to the config
      const requestConfig = {
        ...config,
        signal,
        // Add stricter response type validation
        transformResponse: [
          (data: string) => {
            try {
              return data ? JSON.parse(data) : null;
            } catch (error) {
              logger.error(`Error parsing JSON response from ${url}:`, error);
              logger.debug(
                `Raw response data: ${
                  data ? data.slice(0, 500) : "null or empty"
                }`
              );
              // Return a safe value to prevent further errors
              return {
                error: "Invalid JSON response",
                rawLength: data?.length || 0,
              };
            }
          },
        ],
      };

      while (retries <= maxRetries) {
        try {
          return await this.axiosInstance.get<T>(url, requestConfig);
        } catch (error) {
          if (retries >= maxRetries) {
            logger.error(
              `Request to ${url} failed after ${retries + 1} attempts`
            );
            throw error;
          }
          retries++;
          logger.warn(
            `Request to ${url} failed (attempt ${retries}/${
              maxRetries + 1
            }), retrying in ${retryDelay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }

      // This should never be reached due to the throw in the loop, but TypeScript needs it
      throw new Error(
        `Failed to make request to ${url} after ${maxRetries + 1} attempts`
      );
    } finally {
      // Ensure we always abort the controller to clean up event listeners
      if (!signal.aborted) {
        controller.abort();
      }
    }
  }

  private async fetchWithCache<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    // Get the cache instance (will initialize it if needed)
    const cache = this.getCache();

    if (this.cacheEnabled) {
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        logger.log(`Returning data for ${cacheKey} from cache`);
        return cachedData;
      }
    }

    try {
      const data = await fetchFn();
      if (this.cacheEnabled) {
        cache.set(cacheKey, data, ttl);
        logger.debug(`Cached data for ${cacheKey}`);
      }
      return data;
    } catch (error) {
      // Check if we have cached data even if it's expired
      if (this.cacheEnabled) {
        const cachedData = cache.get(cacheKey, true); // Get even if expired
        if (cachedData) {
          logger.warn(
            `Error fetching fresh data for ${cacheKey}, returning stale cache: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          return cachedData;
        }
      }
      logger.error(`Error fetching data for ${cacheKey}:`, error);
      throw error;
    }
  }

  /**
   * Helper function to extract all procedures recursively
   */
  private extractAllProcedures(procedures: Procedure[]): Procedure[] {
    const allProcedures: Procedure[] = [];

    if (!Array.isArray(procedures)) {
      logger.error(
        `Expected an array of procedures but got: ${typeof procedures}`
      );
      return [];
    }

    const processProcedure = (proc: Procedure, parentName?: string): void => {
      if (!proc || typeof proc !== "object") {
        logger.debug(`Invalid procedure object: ${proc}`);
        return;
      }

      try {
        // Safely access procedure properties
        const procName =
          typeof proc.name === "string"
            ? proc.name
            : `Unnamed #${proc.id || "unknown"}`;
        const procId = typeof proc.id === "number" ? proc.id : undefined;

        // Check if this is a real procedure by looking at the links
        const hasLinks = Array.isArray(proc.links);
        const isProcedure =
          hasLinks &&
          proc.links?.some(
            (link: ApiLink) =>
              link && typeof link === "object" && link.rel === "procedure"
          );

        // Add parent context to the name if available
        const fullName = parentName ? `${parentName} > ${procName}` : procName;

        // Only add if it has a valid ID
        if (procId) {
          allProcedures.push({
            ...proc,
            name: procName,
            id: procId,
            fullName,
            parentName: parentName || null,
            isProcedure: isProcedure || false,
          });
        }

        // Process submenus recursively
        if (Array.isArray(proc.subMenus)) {
          proc.subMenus.forEach((submenu: Procedure) => {
            if (submenu && typeof submenu === "object") {
              processProcedure(submenu, fullName);
            }
          });
        }

        // Process children recursively (some APIs use childs instead of subMenus)
        if (Array.isArray(proc.childs)) {
          proc.childs.forEach((child: Procedure) => {
            if (child && typeof child === "object") {
              processProcedure(child, fullName);
            }
          });
        }
      } catch (error) {
        logger.error(`Error processing procedure: ${error}`);
      }
    };

    // Process all procedures with error handling
    procedures.forEach((proc) => {
      try {
        processProcedure(proc);
      } catch (error) {
        logger.error(`Error in extractAllProcedures: ${error}`);
      }
    });

    logger.log(`Extracted ${allProcedures.length} procedures from API data`);

    // Sort procedures by their full path for better organization
    return allProcedures.sort((a, b) =>
      (a.fullName || "").localeCompare(b.fullName || "")
    );
  }

  /**
   * Get a list of all procedures via the Objectives endpoint
   */
  async getProceduresList(): Promise<Procedure[]> {
    const cacheKey = "procedures_list";
    return this.fetchWithCache<Procedure[]>(
      cacheKey,
      async () => {
        logger.log("Fetching procedures from API...");

        // Get the base URL at execution time, not at initialization time
        const baseUrl = this.getBaseUrl();

        try {
          // Use our robust request method instead of direct axios.get
          const response = await this.makeRequest<unknown>(
            `${baseUrl}/Objectives`
          );
          let procedures: Procedure[] = [];

          // Handle response data safely
          if (!response || !response.data) {
            logger.warn("Empty response from API when fetching procedures");
            return [];
          }

          // Add debug logging for the raw response
          if (typeof response.data === "object") {
            try {
              const preview = JSON.stringify(response.data).slice(0, 200);
              logger.debug(`Raw API response preview: ${preview}...`);
            } catch (error) {
              logger.warn("Could not stringify API response for debugging");
            }
          }

          // Handle different response formats - ensure we always have an array to process
          if (Array.isArray(response.data)) {
            logger.log("API response is an array");
            procedures = response.data as Procedure[];
          } else if (response.data && typeof response.data === "object") {
            logger.log(
              "API response is an object, looking for array properties"
            );

            // If it's an object with items/results/data property that's an array
            const possibleArrayProps = [
              "items",
              "results",
              "data",
              "procedures",
              "objectives",
            ];
            const data = response.data as Record<string, unknown>;

            let foundArrayProp = false;
            for (const prop of possibleArrayProps) {
              if (Array.isArray(data[prop])) {
                procedures = data[prop] as Procedure[];
                logger.log(`Found procedures array in response.${prop}`);
                foundArrayProp = true;
                break;
              }
            }

            // If it's an object but we can't find a property that's an array, wrap it in an array
            if (!foundArrayProp) {
              logger.log(
                "No array property found, treating entire response as a single procedure"
              );
              procedures = [response.data as Procedure];
            }
          } else {
            logger.warn(
              `Unexpected API response type: ${typeof response.data}`
            );
            return [];
          }

          logger.log(
            `Found ${procedures.length} top-level items in API response`
          );

          // Process all procedures recursively
          return this.extractAllProcedures(procedures);
        } catch (error) {
          logger.error("Error fetching procedures list:", error);
          return [];
        }
      },
      CACHE_TTL.PROCEDURES_LIST
    );
  }

  /**
   * Get detailed information about a specific procedure
   */
  async getProcedureById(id: number): Promise<Procedure> {
    if (!id || id <= 0) {
      throw new Error("Procedure ID is required");
    }
    const cacheKey = `procedure_${id}`;
    return this.fetchWithCache<Procedure>(
      cacheKey,
      async () => {
        logger.log(`Fetching procedure details for ID ${id}...`);

        // Get the base URL at execution time
        const baseUrl = this.getBaseUrl();

        // First try to get the correct URL from the procedure's links
        const url = `${baseUrl}/Procedures/${id}`;
        logger.log(`Making API request to: ${url}`);

        // Use our robust request method
        const response = await this.makeRequest<Record<string, unknown>>(url);

        if (!response || !response.data) {
          throw new Error(`Failed to get data for procedure ${id}`);
        }

        const data = response.data as Record<string, unknown>;

        // Ensure we have the required fields for a Procedure
        if (!data.id || !data.name) {
          logger.warn(
            `API response for procedure ${id} is missing required fields`
          );
        }

        // Add URL info to the response data
        return {
          id: Number(data.id) || id,
          name: String(data.name || `Procedure ${id}`),
          ...data,
          _links: {
            self: url,
            resume: `${url}/Resume`,
            totals: `${url}/Totals`,
            abc: `${url}/ABC`,
          },
        } as Procedure;
      },
      CACHE_TTL.PROCEDURE_DETAILS
    );
  }

  /**
   * Get a summary of a procedure (number of steps, institutions, requirements)
   */
  async getProcedureResume(id: number): Promise<unknown> {
    if (!id || id <= 0) {
      throw new Error("Procedure ID is required");
    }
    const cacheKey = `procedure_resume_${id}`;
    return this.fetchWithCache<unknown>(
      cacheKey,
      async () => {
        logger.log(`Fetching procedure resume for ID ${id}...`);
        // Access baseUrl at execution time
        const baseUrl = this.getBaseUrl();
        const response = await this.makeRequest<unknown>(
          `${baseUrl}/Procedures/${id}/Resume`
        );
        if (!response) {
          return null;
        }
        return response.data;
      },
      CACHE_TTL.PROCEDURE_COMPONENTS
    );
  }

  /**
   * Get a detailed procedure resume
   */
  async getProcedureDetailedResume(id: number): Promise<unknown> {
    if (!id || id <= 0) {
      throw new Error("Procedure ID is required");
    }
    const cacheKey = `procedure_detailed_resume_${id}`;
    return this.fetchWithCache<unknown>(
      cacheKey,
      async () => {
        // Access baseUrl at execution time
        const baseUrl = this.getBaseUrl();
        const response = await this.makeRequest<unknown>(
          `${baseUrl}/Procedures/${id}/ResumeDetail`
        );
        if (!response) {
          return null;
        }
        return response.data;
      },
      CACHE_TTL.PROCEDURE_COMPONENTS
    );
  }

  /**
   * Get information about a specific step within a procedure
   */
  async getProcedureStep(procedureId: number, stepId: number): Promise<Step> {
    if (!procedureId || procedureId <= 0) {
      throw new Error("Procedure ID is required");
    }
    if (!stepId || stepId <= 0) {
      throw new Error("Step ID is required");
    }
    const cacheKey = `procedure_${procedureId}_step_${stepId}`;
    return this.fetchWithCache<Step>(
      cacheKey,
      async () => {
        logger.log(`Fetching step ${stepId} for procedure ${procedureId}...`);

        // Access baseUrl at execution time
        const baseUrl = this.getBaseUrl();

        // Use the dedicated step endpoint to get complete step information
        interface StepResponse {
          data?: Step;
          links?: ApiLink[];
        }

        const response = await this.makeRequest<StepResponse>(
          `${baseUrl}/Procedures/${procedureId}/Steps/${stepId}`
        );

        if (!response || !response.data) {
          throw new Error(
            `Failed to get step ${stepId} for procedure ${procedureId}`
          );
        }

        const stepData = response.data;

        // Add additional context to the step data
        return {
          id: stepId,
          name: "Unknown", // Default value if step data is incomplete
          ...(stepData.data || {}),
          procedureId,
          _links: stepData.links,
        };
      },
      CACHE_TTL.PROCEDURE_COMPONENTS
    );
  }

  /**
   * Get procedure totals (costs and time)
   */
  async getProcedureTotals(id: number): Promise<unknown> {
    if (!id || id <= 0) {
      throw new Error("Procedure ID is required");
    }
    const cacheKey = `procedure_totals_${id}`;
    return this.fetchWithCache<unknown>(
      cacheKey,
      async () => {
        // Access baseUrl at execution time
        const baseUrl = this.getBaseUrl();
        const response = await this.makeRequest<unknown>(
          `${baseUrl}/Procedures/${id}/Totals`
        );
        if (!response) {
          return null;
        }
        return response.data;
      },
      CACHE_TTL.PROCEDURE_COMPONENTS
    );
  }

  /**
   * Search for procedures by keyword
   * @param keyword The search keyword/phrase
   * @returns An array of matching procedures
   */
  async searchProcedures(
    keyword: string
  ): Promise<ObjectiveWithDescriptionBaseModel[]> {
    if (!keyword || typeof keyword !== "string") {
      throw new Error("Search keyword is required");
    }

    const cacheKey = `search_objectives_${encodeURIComponent(
      keyword.toLowerCase()
    )}`;

    return this.fetchWithCache<ObjectiveWithDescriptionBaseModel[]>(
      cacheKey,
      async () => {
        logger.log(`Searching objectives with keyword "${keyword}"...`);

        // Get the base URL at execution time
        const baseUrl = this.getBaseUrl();

        try {
          // Use POST for the search endpoint as specified in the API docs
          const url = `${baseUrl}/Objectives/Search`;

          // Create a specific axios instance for this POST request
          const response = await this.axiosInstance.post<
            ObjectiveWithDescriptionBaseModel[]
          >(url, JSON.stringify(keyword), {
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            timeout: REQUEST_CONFIG.TIMEOUT,
          });

          if (!response || !response.data) {
            logger.warn(`No objectives found for search keyword "${keyword}"`);
            return [];
          }

          // API should return ObjectiveWithDescriptionBaseModel[] directly
          if (Array.isArray(response.data)) {
            logger.log(
              `Found ${response.data.length} objective search results for "${keyword}"`
            );
            // No need to map or add searchKeyword, return data directly
            return response.data;
          } else {
            // Log unexpected responses, but still try to return an empty array
            logger.warn(
              `Unexpected search API response type for objectives: ${typeof response.data}. Expected Array.`
            );
            return [];
          }
        } catch (error) {
          logger.error(
            `Error searching objectives with keyword "${keyword}":`,
            error
          );
          // Don't expose internal errors directly, return empty array
          return [];
        }
      },
      CACHE_TTL.PROCEDURES_LIST
    );
  }

  /**
   * Cleanup resources when instance is no longer needed
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close the database connection
    this.cache?.close();
  }
}
