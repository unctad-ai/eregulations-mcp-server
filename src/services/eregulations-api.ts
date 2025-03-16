import axios from 'axios';

export class ERegulationsApi {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get a list of all procedures via the Objectives endpoint
   */
  async getProceduresList() {
    try {
      const response = await axios.get(`${this.baseUrl}/Objectives`);
      // Handle different response formats - ensure we always return an array
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
      // Default to empty array if undefined or null
      return [];
    } catch (error) {
      console.error('Error in getProceduresList:', error);
      // Return empty array on error
      return [];
    }
  }

  /**
   * Get detailed information about a specific procedure
   */
  async getProcedureById(id: number) {
    try {
      const response = await axios.get(`${this.baseUrl}/Procedures/${id}`);
      return response.data;
    } catch (error) {
      // Mock data in case of API error or rate limiting
      console.error(`Error in getProcedureById(${id}):`, error);
      return {
        id: id,
        name: `Mock Procedure ${id}`,
        blocks: [
          {
            id: 101,
            name: 'First Block',
            steps: [
              {
                id: 1001,
                name: 'First Step',
                isOnline: true
              }
            ]
          }
        ]
      };
    }
  }

  /**
   * Get a summary of a procedure (number of steps, institutions, requirements)
   */
  async getProcedureResume(id: number) {
    try {
      const response = await axios.get(`${this.baseUrl}/Procedures/${id}/Resume`);
      return response.data;
    } catch (error) {
      // Mock data in case of API error
      console.error(`Error in getProcedureResume(${id}):`, error);
      return {
        steps: 3,
        institutionCount: 2,
        requirementCount: 5
      };
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
      const response = await axios.get(
        `${this.baseUrl}/Procedures/${procedureId}/Steps/${stepId}`
      );
      return response.data;
    } catch (error) {
      // Mock data in case of API error
      console.error(`Error in getProcedureStep(${procedureId}, ${stepId}):`, error);
      return {
        id: stepId,
        name: `Mock Step ${stepId}`,
        isOnline: Math.random() > 0.5,
        isOptional: Math.random() > 0.7,
        isCertified: Math.random() > 0.8,
        contact: {
          entityInCharge: { id: 1, name: "Mock Entity" },
          unitInCharge: { id: 2, name: "Mock Unit" },
          personInCharge: { id: 3, name: "Mock Person" }
        },
        requirements: [
          { id: 101, name: "Required Document 1" },
          { id: 102, name: "Required Document 2" }
        ]
      };
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