import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ERegulationsApi } from '../services/eregulations-api.js';

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('ERegulationsApi', () => {
  let api: ERegulationsApi;
  
  beforeEach(() => {
    api = new ERegulationsApi('https://api-tanzania.tradeportal.org');
    vi.resetAllMocks();
  });

  describe('getProceduresList', () => {
    it('should fetch list of procedures', async () => {
      const mockResponse = {
        data: [
          { id: 1, name: 'Procedure 1' },
          { id: 2, name: 'Procedure 2' }
        ]
      };

      const axios = await import('axios');
      axios.default.get = vi.fn().mockResolvedValue(mockResponse);

      const result = await api.getProceduresList();
      expect(result).toEqual(mockResponse.data);
      expect(axios.default.get).toHaveBeenCalledWith(
        'https://api-tanzania.tradeportal.org/Objectives'
      );
    });
  });

  describe('getProcedureById', () => {
    it('should fetch procedure by ID', async () => {
      const mockResponse = {
        data: {
          id: 1,
          name: 'Procedure 1',
          blocks: [
            { 
              id: 101,
              name: 'Block 1',
              steps: [
                { id: 1001, name: 'Step 1' }
              ]
            }
          ]
        }
      };

      const axios = await import('axios');
      axios.default.get = vi.fn().mockResolvedValue(mockResponse);

      const result = await api.getProcedureById(1);
      expect(result).toEqual(mockResponse.data);
      expect(axios.default.get).toHaveBeenCalledWith(
        'https://api-tanzania.tradeportal.org/Procedures/1'
      );
    });
  });

  describe('getProcedureResume', () => {
    it('should fetch procedure resume by ID', async () => {
      const mockResponse = {
        data: {
          id: 1,
          name: 'Procedure 1',
          steps: 5,
          institutions: 3,
          requirements: 7
        }
      };

      const axios = await import('axios');
      axios.default.get = vi.fn().mockResolvedValue(mockResponse);

      const result = await api.getProcedureResume(1);
      expect(result).toEqual(mockResponse.data);
      expect(axios.default.get).toHaveBeenCalledWith(
        'https://api-tanzania.tradeportal.org/Procedures/1/Resume'
      );
    });
  });

  describe('getProcedureStep', () => {
    it('should fetch procedure step details', async () => {
      const mockResponse = {
        data: {
          id: 1001,
          name: 'Step 1',
          requirements: [
            { id: 1, name: 'Requirement 1' }
          ],
          contact: {
            entityInCharge: { id: 1, name: 'Entity 1' }
          }
        }
      };

      const axios = await import('axios');
      axios.default.get = vi.fn().mockResolvedValue(mockResponse);

      const result = await api.getProcedureStep(1, 1001);
      expect(result).toEqual(mockResponse.data);
      expect(axios.default.get).toHaveBeenCalledWith(
        'https://api-tanzania.tradeportal.org/Procedures/1/Steps/1001'
      );
    });
  });
});