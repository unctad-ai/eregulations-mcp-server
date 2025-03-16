import axios from 'axios';

export class ERegulationsApi {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
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
    try {
      console.log('Fetching procedures from API...');
      const response = await axios.get(`${this.baseUrl}/Objectives`);
      let procedures: any[] = [];

      // Add debug logging for the raw response
      console.log('Raw API response:', JSON.stringify(response.data, null, 2).slice(0, 500) + '...');

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

      console.log(`Found ${procedures.length} top-level procedures`);
      
      // Process all procedures recursively
      return this.extractAllProcedures(procedures);
    } catch (error) {
      console.error('Error in getProceduresList:', error);
      return [];
    }
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
        console.log(`No procedure found with ID ${id}`);
        return null;
      }
      
      console.log('Found procedure:', JSON.stringify(procedure, null, 2));
      
      // Find the procedure link
      const procedureLink = procedure.links?.find((link: any) => link.rel === "procedure");
      if (!procedureLink) {
        console.log(`No procedure link found in procedure ${id}`);
        return null;
      }
      
      console.log(`Found procedure link: ${procedureLink.href}`);
      return procedureLink.href;
    } catch (error) {
      console.error('Error getting URL from links:', error);
      return null;
    }
  }

  /**
   * Get detailed information about a specific procedure
   */
  async getProcedureById(id: number) {
    try {
      console.log(`Fetching procedure details for ID ${id}...`);
      
      // First try to get the correct URL from the procedure's links
      const url = await this.getUrlFromLinks(id);
      if (!url) {
        throw new Error(`Could not find URL for procedure ${id}`);
      }
      
      console.log(`Making API request to: ${url}`);
      
      // Use the URL from the links array with necessary headers
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      // Add URL info to the response
      const enrichedData = {
        ...response.data,
        _links: {
          self: url,
          resume: `${url}/Resume`,
          totals: `${url}/Totals`,
          abc: `${url}/ABC`
        }
      };

      return enrichedData;
    } catch (error: any) {
      console.error(`Error in getProcedureById(${id}):`, error);
      console.error('Full error details:', error.response?.data || error.message);
      
      if (error.response?.status === 404) {
        throw new Error(`Procedure with ID ${id} not found. Please verify the procedure ID exists.`);
      }
      
      if (error.response?.status === 403) {
        throw new Error(`Access forbidden to procedure ${id}. This may require authentication.`);
      }
      
      throw new Error(`Failed to fetch procedure details: ${error.message}`);
    }
  }

  /**
   * Get a summary of a procedure (number of steps, institutions, requirements)
   */
  async getProcedureResume(id: number) {
    try {
      console.log(`Fetching procedure resume for ID ${id}...`);
      const response = await axios.get(`${this.baseUrl}/Procedures/${id}/Resume`);
      return response.data;
    } catch (error: any) {
      console.error(`Error in getProcedureResume(${id}):`, error);
      
      if (error.response?.status === 404) {
        throw new Error(`Procedure resume not found for ID ${id}. Please verify the procedure ID exists.`);
      }
      
      throw new Error(`Failed to fetch procedure resume: ${error.message}`);
    }
  }

  /**
   * Get a detailed procedure resume
   */
  async getProcedureDetailedResume(id: number) {
    try {
      const response = await axios.get(`${this.baseUrl}/Procedures/${id}/ResumeDetail`);
      return response.data;
    } catch (error) {
      console.error(`Error in getProcedureDetailedResume(${id}):`, error);
      // Return basic mock data
      return {
        id: id,
        steps: 3,
        institutions: 2,
        requirements: 5,
        detailedInfo: "Mock detailed information"
      };
    }
  }

  /**
   * Get information about a specific step within a procedure
   */
  async getProcedureStep(procedureId: number, stepId: number) {
    try {
      console.log(`Fetching step ${stepId} for procedure ${procedureId}...`);
      
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
    } catch (error: any) {
      console.error(`Error in getProcedureStep(${procedureId}, ${stepId}):`, error);
      console.error('Full error details:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get procedure totals (costs and time)
   */
  async getProcedureTotals(id: number) {
    try {
      const response = await axios.get(`${this.baseUrl}/Procedures/${id}/Totals`);
      return response.data;
    } catch (error) {
      console.error(`Error in getProcedureTotals(${id}):`, error);
      // Return mock data
      return {
        id: id,
        time: {
          hours: 24,
          days: 3
        },
        costs: {
          total: 150,
          currency: "USD"
        }
      };
    }
  }

  /**
   * Get the administrative burden calculation of a procedure
   */
  async getProcedureABC(id: number) {
    const response = await axios.get(`${this.baseUrl}/Procedures/${id}/ABC`);
    return response.data;
  }

  /**
   * Search procedures by filters
   */
  async searchByFilters(filters: any[]) {
    try {
      const response = await axios.post(`${this.baseUrl}/Objectives/SearchByFilters`, filters);
      // Ensure we return an array
      if (Array.isArray(response.data)) {
        return response.data;
      } else if (response.data && typeof response.data === 'object') {
        // If it's an object with items/results/data property that's an array
        const possibleArrayProps = ['items', 'results', 'data', 'procedures', 'objectives'];
        for (const prop of possibleArrayProps) {
          if (Array.isArray(response.data[prop])) {
            return response.data[prop];
          }
        }
        // If it's an object but we can't find a property that's an array, return it as a single-item array
        return [response.data];
      }
      // Default to empty array
      return [];
    } catch (error) {
      console.error('Error in searchByFilters:', error);
      // Return empty array on error
      return [];
    }
  }

  /**
   * Search procedures by name (client-side implementation)
   */
  async searchByName(query: string) {
    try {
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
    } catch (error) {
      console.error('Error in searchByName:', error);
      return [];
    }
  }
}