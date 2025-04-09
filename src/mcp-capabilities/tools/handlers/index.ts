import { ERegulationsApi } from "../../../services/eregulations-api.js";
import { createGetProcedureDetailsHandler } from "./get-procedure-details.js";
import { createGetProcedureStepHandler } from "./get-procedure-step.js";
import { createListProceduresHandler } from "./list-procedures.js";
import { createSearchProceduresHandler } from "./search-procedures.js";
import type { ToolHandler } from "./types.js";

/**
 * Creates all available tool handlers
 * @param api The eRegulations API instance
 * @returns An array of ToolHandler objects
 */
export function createHandlers(api: ERegulationsApi): ToolHandler[] {
  return [
    createListProceduresHandler(api),
    createGetProcedureDetailsHandler(api),
    createGetProcedureStepHandler(api),
    createSearchProceduresHandler(api),
  ];
}

export type { ToolHandler } from "./types.js";
