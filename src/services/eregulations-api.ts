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
    const response = await axios.get(`${this.baseUrl}/Objectives`);
    return response.data;
  }

  /**
   * Get detailed information about a specific procedure
   */
  async getProcedureById(id: number) {
    const response = await axios.get(`${this.baseUrl}/Procedures/${id}`);
    return response.data;
  }

  /**
   * Get a summary of a procedure (number of steps, institutions, requirements)
   */
  async getProcedureResume(id: number) {
    const response = await axios.get(`${this.baseUrl}/Procedures/${id}/Resume`);
    return response.data;
  }

  /**
   * Get a detailed procedure resume
   */
  async getProcedureDetailedResume(id: number) {
    const response = await axios.get(`${this.baseUrl}/Procedures/${id}/ResumeDetail`);
    return response.data;
  }

  /**
   * Get information about a specific step within a procedure
   */
  async getProcedureStep(procedureId: number, stepId: number) {
    const response = await axios.get(
      `${this.baseUrl}/Procedures/${procedureId}/Steps/${stepId}`
    );
    return response.data;
  }

  /**
   * Get procedure totals (costs and time)
   */
  async getProcedureTotals(id: number) {
    const response = await axios.get(`${this.baseUrl}/Procedures/${id}/Totals`);
    return response.data;
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
    const response = await axios.post(`${this.baseUrl}/Objectives/SearchByFilters`, filters);
    return response.data;
  }
}