import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ERegulationsApi } from '../services/eregulations-api.js';

// Mock axios with proper create method
const mockGet = vi.fn();
vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: mockGet
    })
  }
}));

describe('ERegulationsApi', () => {
  let api: ERegulationsApi;
  const baseUrl = 'http://test.api';

  beforeEach(() => {
    // Reset mock between tests
    mockGet.mockReset();
    api = new ERegulationsApi(baseUrl, false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getProceduresList', () => {
    it('should fetch list of procedures', async () => {
      const mockData = [
        {
          id: 1,
          name: "Test Procedure",
          links: [{ rel: "procedure", href: "http://test.api/procedures/1" }]
        }
      ];

      mockGet.mockResolvedValueOnce({ data: mockData });

      const procedures = await api.getProceduresList();

      expect(procedures).toHaveLength(1);
      expect(procedures[0]).toMatchObject({
        id: 1,
        name: "Test Procedure"
      });
    });
  });

  describe('getProcedureById', () => {
    it('should fetch procedure by ID', async () => {
      const mockData = {
        id: 1,
        name: "Test Procedure",
        data: {
          blocks: [{
            steps: [{
              id: 1,
              name: "Test Step"
            }]
          }]
        }
      };

      // Mock the procedure list call first
      mockGet.mockResolvedValueOnce({ data: [{
        id: 1,
        links: [{ rel: "procedure", href: "http://test.api/procedures/1" }]
      }]});

      // Then mock the procedure details call
      mockGet.mockResolvedValueOnce({ data: mockData });

      const procedure = await api.getProcedureById(1);

      expect(procedure).toMatchObject({
        id: 1,
        name: "Test Procedure"
      });
    });
  });

  describe('getProcedureResume', () => {
    it('should fetch procedure resume by ID', async () => {
      const mockData = {
        stepCount: 5,
        totalTime: "10 days"
      };

      mockGet.mockResolvedValueOnce({ data: mockData });

      const resume = await api.getProcedureResume(1);

      expect(resume).toMatchObject(mockData);
    });
  });

  describe('getProcedureStep', () => {
    it('should fetch procedure step details', async () => {
      const mockData = {
        data: {
          id: 1,
          name: "Test Step",
          isOnline: true
        }
      };

      mockGet.mockResolvedValueOnce({ data: mockData });

      const step = await api.getProcedureStep(1, 1);

      expect(step).toMatchObject({
        id: 1,
        name: "Test Step",
        isOnline: true
      });
    });
  });
});