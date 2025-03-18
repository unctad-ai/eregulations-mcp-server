import axios, { AxiosRequestConfig, AxiosResponse, AxiosInstance } from 'axios';
import { logger } from '../utils/logger.js';
import { SqliteCache } from '../utils/db-cache.js';

/**
 * Cache TTL constants in milliseconds
 */
const CACHE_TTL = {
  PROCEDURES_LIST: 30 * 24 * 60 * 60 * 1000, // 30 days
  PROCEDURE_DETAILS: 24 * 60 * 60 * 1000, // 24 hours
  PROCEDURE_COMPONENTS: 8 * 60 * 60 * 1000, // 8 hours
};

/**
 * Default request configuration
 */
const REQUEST_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000 // 1 second
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
 * Procedure entity structure
 */
interface Procedure {
  id: number;
  name: string;
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
  private baseUrl: string;
  private cache: SqliteCache;
  private cacheEnabled: boolean;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private axiosInstance: AxiosInstance;

  constructor(baseUrl: string, cacheEnabled: boolean = true) {
    this.baseUrl = baseUrl;
    this.cacheEnabled = cacheEnabled;
    
    // Create a single axios instance to reuse
    this.axiosInstance = axios.create({
      timeout: REQUEST_CONFIG.TIMEOUT,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    // Initialize the SQLite-based cache with the baseUrl for isolation
    this.cache = new SqliteCache(baseUrl);
    
    // Periodically clean expired cache entries everyday
    if (cacheEnabled) {
      this.cleanupInterval = setInterval(() => {
        const removed = this.cache.cleanExpired();
        if (removed > 0) {
          logger.debug(`Cache cleanup: removed ${removed} expired items`);
        }
      }, 24 * 60 * 60 * 1000);
    } else {
      this.cache.clear();
      logger.warn('Cache is disabled. All requests will be made to the server.');
    }
  }

  /**
   * Helper function to make HTTP requests with retry logic
   * @param url The URL to fetch
   * @param config Optional axios config
   * @returns The HTTP response
   */
  private async makeRequest<T = unknown>(url: string, config: RequestConfig = {}): Promise<AxiosResponse<T>> {
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
        signal
      };
      
      while (retries <= maxRetries) {
        try {
          return await this.axiosInstance.get<T>(url, requestConfig);
        } catch (error) {
          if (retries >= maxRetries) {
            logger.error(`Request to ${url} failed after ${retries + 1} attempts`);
            throw error;
          }
          retries++;
          logger.warn(`Request to ${url} failed (attempt ${retries}/${maxRetries + 1}), retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
      
      // This should never be reached due to the throw in the loop, but TypeScript needs it
      throw new Error(`Failed to make request to ${url} after ${maxRetries + 1} attempts`);
    } finally {
      // Ensure we always abort the controller to clean up event listeners
      if (!signal.aborted) {
        controller.abort();
      }
    }
  }

  private async fetchWithCache<T>(cacheKey: string, fetchFn: () => Promise<T>, ttl: number): Promise<T> {
    if (this.cacheEnabled) {
      const cachedData = this.cache.get(cacheKey);
      if (cachedData) {
        logger.log(`Returning data for ${cacheKey} from cache`);
        return cachedData;
      }
    }
    try {
      const data = await fetchFn();
      if (this.cacheEnabled) {
        this.cache.set(cacheKey, data, ttl);
        logger.debug(`Cached data for ${cacheKey}`);
      }
      return data;
    } catch (error) {
      // Check if we have cached data even if it's expired
      if (this.cacheEnabled) {
        const cachedData = this.cache.get(cacheKey, true); // Get even if expired
        if (cachedData) {
          logger.warn(`Error fetching fresh data for ${cacheKey}, returning stale cache: ${error instanceof Error ? error.message : String(error)}`);
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
    
    const processProcedure = (proc: Procedure, parentName?: string): void => {
      if (!proc) return;
      
      // Check if this is a real procedure by looking at the links
      const isProcedure = proc.links?.some((link: ApiLink) => link.rel === "procedure");
      
      // Add parent context to the name if available
      const fullName = parentName ? `${parentName} > ${proc.name}` : proc.name;
      
      // Only add if it's a procedure (has procedure link)
      if (isProcedure && proc.name && proc.id) {
        allProcedures.push({
          ...proc,
          fullName,
          parentName: parentName || null,
          isProcedure: true
        });
      }
      
      // Process submenus recursively
      if (Array.isArray(proc.subMenus)) {
        proc.subMenus.forEach((submenu: Procedure) => processProcedure(submenu, fullName));
      }
      
      // Process children recursively (some APIs use childs instead of subMenus)
      if (Array.isArray(proc.childs)) {
        proc.childs.forEach((child: Procedure) => processProcedure(child, fullName));
      }
    };
    
    procedures.forEach(proc => processProcedure(proc));
    
    // Sort procedures by their full path for better organization
    return allProcedures.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  }

  /**
   * Get a list of all procedures via the Objectives endpoint
   */
  async getProceduresList(): Promise<Procedure[]> {
    const cacheKey = 'procedures_list';
    return this.fetchWithCache<Procedure[]>(cacheKey, async () => {
      logger.log('Fetching procedures from API...');
      
      // Use our robust request method instead of direct axios.get
      const response = await this.makeRequest<unknown>(`${this.baseUrl}/Objectives`);
      let procedures: Procedure[] = [];

      // Add debug logging for the raw response
      if (response && response.data) {
        logger.debug('Raw API response:', JSON.stringify(response.data, null, 2).slice(0, 500) + '...');

        // Handle different response formats - ensure we always have an array to process
        if (Array.isArray(response.data)) {
          procedures = response.data as Procedure[];
        } else if (response.data && typeof response.data === 'object') {
          // If it's an object with items/results/data property that's an array
          const possibleArrayProps = ['items', 'results', 'data', 'procedures', 'objectives'];
          const data = response.data as Record<string, unknown>;
          
          for (const prop of possibleArrayProps) {
            if (Array.isArray(data[prop])) {
              procedures = data[prop] as Procedure[];
              break;
            }
          }
          // If it's an object but we can't find a property that's an array, wrap it in an array
          if (procedures.length === 0) {
            procedures = [response.data as Procedure];
          }
        }
      }

      logger.log(`Found ${procedures.length} top-level procedures`);
      
      // Process all procedures recursively
      return this.extractAllProcedures(procedures);
    }, CACHE_TTL.PROCEDURES_LIST);
  }

  /**
   * Get detailed information about a specific procedure
   */
  async getProcedureById(id: number): Promise<Procedure> {
    const cacheKey = `procedure_${id}`;
    return this.fetchWithCache<Procedure>(cacheKey, async () => {
      logger.log(`Fetching procedure details for ID ${id}...`);
      
      // First try to get the correct URL from the procedure's links
      const url = `${this.baseUrl}/Procedures/${id}`;
      logger.log(`Making API request to: ${url}`);
      
      // Use our robust request method
      const response = await this.makeRequest<Record<string, unknown>>(url);
      
      if (!response || !response.data) {
        throw new Error(`Failed to get data for procedure ${id}`);
      }
      
      const data = response.data as Record<string, unknown>;
      
      // Ensure we have the required fields for a Procedure
      if (!data.id || !data.name) {
        logger.warn(`API response for procedure ${id} is missing required fields`);
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
          abc: `${url}/ABC`
        }
      } as Procedure;
    }, CACHE_TTL.PROCEDURE_DETAILS);
  }

  /**
   * Get a summary of a procedure (number of steps, institutions, requirements)
   */
  async getProcedureResume(id: number): Promise<unknown> {
    const cacheKey = `procedure_resume_${id}`;
    return this.fetchWithCache<unknown>(cacheKey, async () => {
      logger.log(`Fetching procedure resume for ID ${id}...`);
      const response = await this.makeRequest<unknown>(`${this.baseUrl}/Procedures/${id}/Resume`);
      if (!response) {
        return null;
      }
      return response.data;
    }, CACHE_TTL.PROCEDURE_COMPONENTS);
  }

  /**
   * Get a detailed procedure resume
   */
  async getProcedureDetailedResume(id: number): Promise<unknown> {
    const cacheKey = `procedure_detailed_resume_${id}`;
    return this.fetchWithCache<unknown>(cacheKey, async () => {
      const response = await this.makeRequest<unknown>(`${this.baseUrl}/Procedures/${id}/ResumeDetail`);
      if (!response) {
        return null;
      }
      return response.data;
    }, CACHE_TTL.PROCEDURE_COMPONENTS);
  }

  /**
   * Get information about a specific step within a procedure
   */
  async getProcedureStep(procedureId: number, stepId: number): Promise<Step> {
    const cacheKey = `procedure_${procedureId}_step_${stepId}`;
    return this.fetchWithCache<Step>(cacheKey, async () => {
      logger.log(`Fetching step ${stepId} for procedure ${procedureId}...`);
      
      // Use the dedicated step endpoint to get complete step information
      interface StepResponse {
        data?: Step;
        links?: ApiLink[];
      }
      
      const response = await this.makeRequest<StepResponse>(`${this.baseUrl}/Procedures/${procedureId}/Steps/${stepId}`);
      
      if (!response || !response.data) {
        throw new Error(`Failed to get step ${stepId} for procedure ${procedureId}`);
      }
      
      const stepData = response.data;
      
      // Add additional context to the step data
      return {
        id: stepId,
        name: 'Unknown', // Default value if step data is incomplete
        ...(stepData.data || {}),
        procedureId,
        _links: stepData.links
      };
    }, CACHE_TTL.PROCEDURE_COMPONENTS);
  }

  /**
   * Get procedure totals (costs and time)
   */
  async getProcedureTotals(id: number): Promise<unknown> {
    const cacheKey = `procedure_totals_${id}`;
    return this.fetchWithCache<unknown>(cacheKey, async () => {
      const response = await this.makeRequest<unknown>(`${this.baseUrl}/Procedures/${id}/Totals`);
      if (!response) {
        return null;
      }
      return response.data;
    }, CACHE_TTL.PROCEDURE_COMPONENTS);
  }

  /**
   * Get the administrative burden calculation of a procedure
   */
  async getProcedureABC(id: number): Promise<unknown> {
    const cacheKey = `procedure_abc_${id}`;
    return this.fetchWithCache<unknown>(cacheKey, async () => {
      const response = await this.makeRequest<unknown>(`${this.baseUrl}/Procedures/${id}/ABC`);
      if (!response) {
        return null;
      }
      return response.data;
    }, CACHE_TTL.PROCEDURE_COMPONENTS);
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
    this.cache.close();
  }
}