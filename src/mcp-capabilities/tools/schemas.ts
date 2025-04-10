import { z } from "zod";

export enum ToolName {
  LIST_PROCEDURES = "listProcedures",
  GET_PROCEDURE_DETAILS = "getProcedureDetails",
  GET_PROCEDURE_STEP = "getProcedureStep",
  SEARCH_PROCEDURES = "searchProcedures",
}

export const ListProceduresSchema = z.object({
  max_items: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Optional maximum number of procedures to include in the formatted text output."
    ),
  max_length: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Optional maximum length for procedure descriptions in the formatted text output."
    ),
});

export const GetProcedureDetailsSchema = z.object({
  procedureId: z.number().describe("ID of the procedure to retrieve"),
  max_length: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Optional maximum length for the main procedure description in the formatted text output."
    ),
});

export const GetProcedureStepSchema = z.object({
  procedureId: z.number().describe("ID of the procedure"),
  stepId: z.number().describe("ID of the step within the procedure"),
});

export const SearchProceduresSchema = z.object({
  keyword: z
    .string()
    .describe("The keyword or phrase to search for procedures"),
  max_items: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Optional maximum number of procedures to include in the formatted text output."
    ),
  max_length: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Optional maximum length for procedure descriptions in the formatted text output."
    ),
});
