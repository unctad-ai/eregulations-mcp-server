import axios from 'axios';
import { logger } from '../utils/logger.js';
import { TTLCache } from '../utils/cache.js';

/**
 * Cache TTL constants in milliseconds
 */
const CACHE_TTL = {
  PROCEDURES_LIST: 24 * 60 * 60 * 1000,
  PROCEDURE_DETAILS: 8 * 60 * 60 * 1000,
  PROCEDURE_COMPONENTS: 4 * 60 * 60 * 1000,
  FILTERS: 24 * 60 * 60 * 1000,
  SEARCH_RESULTS: 1 * 60 * 60 * 1000
};

export class ERegulationsApi {
  private baseUrl: string;
  private cache: TTLCache;
  private cacheEnabled: boolean;

  constructor(baseUrl: string, cacheEnabled: boolean = true) {
    this.baseUrl = baseUrl;
    this.cache = new TTLCache();
    this.cacheEnabled = cacheEnabled;
    
    // Periodically clean expired cache entries every 30 minutes
    if (cacheEnabled) {
      setInterval(() => {
        const removed = this.cache.cleanExpired();
        if (removed > 0) {
          logger.debug(`Cache cleanup: removed ${removed} expired items`);
        }
      }, 30 * 60 * 1000);
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
      logger.error(`Error fetching data for ${cacheKey}:`, error);
      throw error;
    }
  }

  /**
   * Helper function to extract all procedures recursively
   */
  private extractAllProcedures(procedures: any[]): any[] {
    const allProcedures: any[] = [];
    
    const processProcedure = (proc: any, parentName?: string): void => {
      if (!proc) return;
      
      // Check if this is a real procedure by looking at the links
      const isProcedure = proc.links?.some((link: any) => link.rel === "procedure");
      
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
        proc.subMenus.forEach((submenu: any) => processProcedure(submenu, fullName));
      }
      
      // Process children recursively (some APIs use childs instead of subMenus)
      if (Array.isArray(proc.childs)) {
        proc.childs.forEach((child: any) => processProcedure(child, fullName));
      }
    };
    
    procedures.forEach(proc => processProcedure(proc));
    
    // Sort procedures by their full path for better organization
    return allProcedures.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  /**
   * Get a list of all procedures via the Objectives endpoint
   */
  async getProceduresList() {
    const cacheKey = 'procedures_list';
    return this.fetchWithCache(cacheKey, async () => {
      logger.log('Fetching procedures from API...');
      const response = await axios.get(`${this.baseUrl}/Objectives`);
      let procedures: any[] = [];

      // Add debug logging for the raw response
      logger.debug('Raw API response:', JSON.stringify(response.data, null, 2).slice(0, 500) + '...');

      // Handle different response formats - ensure we always have an array to process
      if (Array.isArray(response.data)) {
        procedures = response.data;
      } else if (response.data && typeof response.data === 'object') {
        // If it's an object with items/results/data property that's an array
        const possibleArrayProps = ['items', 'results', 'data', 'procedures', 'objectives'];
        for (const prop of possibleArrayProps) {
          if (Array.isArray(response.data[prop])) {
            procedures = response.data[prop];
            break;
          }
        }
        // If it's an object but we can't find a property that's an array, wrap it in an array
        if (procedures.length === 0) {
          procedures = [response.data];
        }
      }

      logger.log(`Found ${procedures.length} top-level procedures`);
      
      // Process all procedures recursively
      return this.extractAllProcedures(procedures);
    }, CACHE_TTL.PROCEDURES_LIST);
  }

  private async getUrlFromLinks(id: number, procedures?: any[]): Promise<string | null> {
    try {
      // If procedures list is not provided, fetch it
      if (!procedures) {
        procedures = await this.getProceduresList();
      }
      
      // Find the procedure by ID
      const procedure = procedures.find((p: any) => p.id === id);
      if (!procedure) {
        logger.log(`No procedure found with ID ${id}`);
        // If we can't find the procedure in the list, construct the URL directly
        return `${this.baseUrl}/Procedures/${id}`;
      }
      
      // Find the procedure link
      const procedureLink = procedure.links?.find((link: any) => link.rel === "procedure");
      if (!procedureLink) {
        logger.log(`No procedure link found in procedure ${id}, using direct URL`);
        return `${this.baseUrl}/Procedures/${id}`;
      }
      
      return procedureLink.href;
    } catch (error) {
      logger.error('Error getting URL from links:', error);
      // Fallback to direct URL construction
      return `${this.baseUrl}/Procedures/${id}`;
    }
  }

  /**
   * Get detailed information about a specific procedure
   */
  async getProcedureById(id: number) {
    const cacheKey = `procedure_${id}`;
    return this.fetchWithCache(cacheKey, async () => {
      logger.log(`Fetching procedure details for ID ${id}...`);
      
      // First try to get the correct URL from the procedure's links
      const url = await this.getUrlFromLinks(id);
      if (!url) {
        throw new Error(`Could not construct URL for procedure ${id}`);
      }
      
      logger.log(`Making API request to: ${url}`);
      
      // Use the URL with necessary headers
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      // Add URL info to the response data
      return {
        ...response.data,
        _links: {
          self: url,
          resume: `${url}/Resume`,
          totals: `${url}/Totals`,
          abc: `${url}/ABC`
        }
      };
    }, CACHE_TTL.PROCEDURE_DETAILS);
  }

  /**
   * Get a summary of a procedure (number of steps, institutions, requirements)
   */
  async getProcedureResume(id: number) {
    const cacheKey = `procedure_resume_${id}`;
    return this.fetchWithCache(cacheKey, async () => {
      logger.log(`Fetching procedure resume for ID ${id}...`);
      const response = await axios.get(`${this.baseUrl}/Procedures/${id}/Resume`);
      return response.data;
    }, CACHE_TTL.PROCEDURE_COMPONENTS);
  }

  /**
   * Get a detailed procedure resume
   */
  async getProcedureDetailedResume(id: number) {
    const cacheKey = `procedure_detailed_resume_${id}`;
    return this.fetchWithCache(cacheKey, async () => {
      const response = await axios.get(`${this.baseUrl}/Procedures/${id}/ResumeDetail`);
      return response.data;
    }, CACHE_TTL.PROCEDURE_COMPONENTS);
  }

  /**
   * Get information about a specific step within a procedure
   */
  async getProcedureStep(procedureId: number, stepId: number) {
    const cacheKey = `procedure_${procedureId}_step_${stepId}`;
    return this.fetchWithCache(cacheKey, async () => {
      logger.log(`Fetching step ${stepId} for procedure ${procedureId}...`);
      
      // First get the procedure to verify it exists and get its URL
      const procedure = await this.getProcedureById(procedureId);
      if (!procedure) {
        throw new Error(`Could not find procedure with ID ${procedureId}`);
      }
      
      // Find the step within the procedure blocks
      if (procedure.data?.blocks) {
        for (const block of procedure.data.blocks) {
          if (block.steps) {
            const step = block.steps.find((s: any) => s.id === stepId);
            if (step) {
              // Enrich step data with additional context
              return {
                ...step,
                procedureId,
                procedureName: procedure.data.name,
                _links: {
                  self: step.links?.find((link: any) => link.rel === "step")?.href,
                  procedure: procedure._links?.self
                }
              };
            }
          }
        }
      }
      
      throw new Error(`Step ${stepId} not found in procedure ${procedureId}`);
    }, CACHE_TTL.PROCEDURE_COMPONENTS);
  }

  /**
   * Get procedure totals (costs and time)
   */
  async getProcedureTotals(id: number) {
    const cacheKey = `procedure_totals_${id}`;
    return this.fetchWithCache(cacheKey, async () => {
      const response = await axios.get(`${this.baseUrl}/Procedures/${id}/Totals`);
      return response.data;
    }, CACHE_TTL.PROCEDURE_COMPONENTS);
  }

  /**
   * Get the administrative burden calculation of a procedure
   */
  async getProcedureABC(id: number) {
    const cacheKey = `procedure_abc_${id}`;
    return this.fetchWithCache(cacheKey, async () => {
      const response = await axios.get(`${this.baseUrl}/Procedures/${id}/ABC`);
      return response.data;
    }, CACHE_TTL.PROCEDURE_COMPONENTS);
  }

  /**
   * Get available filters
   */
  async getFilters() {
    const cacheKey = 'filters';
    return this.fetchWithCache(cacheKey, async () => {
      const response = await axios.get(`${this.baseUrl}/Filters`);
      return response.data?.data || [];
    }, CACHE_TTL.FILTERS);
  }

  /**
   * Get options for a specific filter
   */
  async getFilterOptions(filterId: number) {
    const cacheKey = `filter_options_${filterId}`;
    return this.fetchWithCache(cacheKey, async () => {
      const response = await axios.get(`${this.baseUrl}/Filters/${filterId}/Options`);
      return response.data?.data || [];
    }, CACHE_TTL.FILTERS);
  }

  /**
   * Search procedures by filters
   */
  async searchByFilters(filters: Array<{ filterId: number; filterOptionId: number }>) {
    const cacheKey = `search_filters_${JSON.stringify(filters)}`;
    return this.fetchWithCache(cacheKey, async () => {
      const response = await axios.post(`${this.baseUrl}/Objectives/SearchByFilters`, filters);
      
      if (response.data?.exactMatchObjectives?.length > 0) {
        return response.data.exactMatchObjectives;
      }
      if (response.data?.filteredMatches?.length > 0) {
        return response.data.filteredMatches;
      }
      return [];
    }, CACHE_TTL.SEARCH_RESULTS);
  }

  /**
   * Search procedures by name (client-side implementation)
   */
  async searchByName(query: string) {
    if (!query) {
      return this.getProceduresList();
    }
    
    const cacheKey = `search_name_${query.toLowerCase()}`;
    return this.fetchWithCache(cacheKey, async () => {
      // Get all procedures and filter client-side
      const procedures = await this.getProceduresList();
      if (!Array.isArray(procedures)) {
        return [];
      }
      
      return procedures.filter((proc: any) => {
        if (typeof proc.name === 'string') {
          return proc.name.toLowerCase().includes(query.toLowerCase());
        }
        return false;
      });
    }, CACHE_TTL.SEARCH_RESULTS);
  }
}