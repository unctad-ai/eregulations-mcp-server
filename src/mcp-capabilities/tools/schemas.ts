import { z } from "zod";

export enum ToolName {
  LIST_PROCEDURES = "listProcedures",
  GET_PROCEDURE_DETAILS = "getProcedureDetails",
  GET_PROCEDURE_STEP = "getProcedureStep",
  SEARCH_PROCEDURES = "searchProcedures",
}

export const ListProceduresSchema = z.object({
  // Remove max_items and max_length
});

export const GetProcedureDetailsSchema = z.object({
  procedureId: z
    .number()
    .int()
    .positive()
    .describe("ID of the procedure to retrieve"),
});

export const GetProcedureStepSchema = z.object({
  procedureId: z.number().describe("ID of the procedure"),
  stepId: z.number().describe("ID of the step within the procedure"),
});

export const SearchProceduresSchema = z.object({
  keyword: z
    .string()
    .describe("The keyword or phrase to search for procedures"),
});
