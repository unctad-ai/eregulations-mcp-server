import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ERegulationsApi } from '../services/eregulations-api.js';
import type { Procedure, Step } from '../services/eregulations-api.js';
import axios from 'axios';

// Mock axios
const mockGet = vi.fn();
vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: mockGet,
      defaults: { timeout: 1000 }
    })
  }
}));

describe('ERegulationsApi', () => {
  let api: ERegulationsApi;
  const baseUrl = 'http://test.api';

  beforeEach(() => {
    mockGet.mockReset();
    api = new ERegulationsApi(baseUrl, false); // Disable cache
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getProceduresList', () => {
    it('should fetch and process list of procedures', async () => {
      const mockData = {
        data: [
          {
            id: 1,
            name: "Test Procedure",
            links: [{ rel: "procedure", href: "http://test.api/procedures/1" }]
          },
          {
            id: 2,
            name: "Parent Procedure",
            subMenus: [
              {
                id: 3,
                name: "Child Procedure",
                links: [{ rel: "procedure", href: "http://test.api/procedures/3" }]
              }
            ]
          }
        ]
      };

      mockGet.mockResolvedValueOnce(mockData);

      const procedures = await api.getProceduresList();

      expect(procedures).toHaveLength(2);
      expect(procedures[0]).toMatchObject({
        id: 1,
        name: "Test Procedure",
        isProcedure: true
      });
      expect(procedures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 3,
            name: "Child Procedure",
            fullName: "Parent Procedure > Child Procedure",
            parentName: "Parent Procedure"
          })
        ])
      );
    });

    it('should handle empty response', async () => {
      mockGet.mockResolvedValueOnce({ data: [] });
      const procedures = await api.getProceduresList();
      expect(procedures).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error');
      mockGet.mockRejectedValueOnce(error);
      await expect(api.getProceduresList()).rejects.toThrow('API Error');
    });
  });

  describe('getProcedureById', () => {
    it('should fetch complete procedure details', async () => {
      const mockData = {
        data: {
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
        }
      };

      mockGet.mockResolvedValueOnce(mockData);

      const procedure = await api.getProcedureById(1);

      expect(procedure).toMatchObject({
        id: 1,
        name: "Test Procedure",
        _links: expect.objectContaining({
          self: expect.stringContaining('/Procedures/1'),
          resume: expect.stringContaining('/Resume'),
          totals: expect.stringContaining('/Totals'),
          abc: expect.stringContaining('/ABC')
        })
      });
    });

    it('should handle missing procedure data', async () => {
      mockGet.mockResolvedValueOnce({ data: {} });
      const procedure = await api.getProcedureById(1);
      expect(procedure).toMatchObject({
        id: 1,
        name: 'Procedure 1'
      });
    });

    it('should handle API errors', async () => {
      mockGet.mockRejectedValueOnce(new Error('Not Found'));
      await expect(api.getProcedureById(999)).rejects.toThrow();
    });
  });

  describe('getProcedureResume', () => {
    it('should fetch procedure resume with correct data', async () => {
      const mockData = {
        data: {
          stepCount: 5,
          totalTime: "10 days",
          institutions: 3,
          requirements: 8
        }
      };

      mockGet.mockResolvedValueOnce(mockData);
      const resume = await api.getProcedureResume(1);
      expect(resume).toMatchObject(mockData.data);
    });

    it('should return null for missing resume data', async () => {
      mockGet.mockResolvedValueOnce({ data: null });
      const resume = await api.getProcedureResume(1);
      expect(resume).toBeNull();
    });

    it('should handle API errors in resume fetch', async () => {
      mockGet.mockRejectedValueOnce(new Error('Resume not found'));
      await expect(api.getProcedureResume(999)).rejects.toThrow();
    });
  });

  describe('getProcedureStep', () => {
    it('should fetch complete step details', async () => {
      const mockData = {
        data: {
          data: {
            id: 1,
            name: "Submit Application",
            isOnline: true,
            requirements: [
              { name: "ID Document", nbOriginal: 1 }
            ],
            contact: {
              entityInCharge: {
                name: "Test Department"
              }
            }
          }
        }
      };

      mockGet.mockResolvedValueOnce(mockData);
      const step = await api.getProcedureStep(1, 1);

      expect(step).toMatchObject({
        id: 1,
        name: "Submit Application",
        isOnline: true,
        procedureId: 1,
        requirements: expect.arrayContaining([
          expect.objectContaining({
            name: "ID Document"
          })
        ])
      });
    });

    it('should handle missing step data', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: {} } });
      const step = await api.getProcedureStep(1, 1);
      expect(step).toMatchObject({
        id: 1,
        name: 'Unknown',
        procedureId: 1
      });
    });

    it('should handle API errors in step fetch', async () => {
      mockGet.mockRejectedValueOnce(new Error('Step not found'));
      await expect(api.getProcedureStep(1, 999)).rejects.toThrow();
    });
  });
});