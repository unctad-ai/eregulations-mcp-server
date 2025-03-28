import { ERegulationsApi } from "../../../services/eregulations-api.js";
import { createListProceduresHandler } from "./list-procedures.js";
import { createGetProcedureDetailsHandler } from "./get-procedure-details.js";
import { createGetProcedureStepHandler } from "./get-procedure-step.js";
import type { ToolHandler } from "./types.js";

export function createHandlers(api: ERegulationsApi): ToolHandler[] {
  return [
    createListProceduresHandler(api),
    createGetProcedureDetailsHandler(api),
    createGetProcedureStepHandler(api),
  ];
}

export type { ToolHandler } from "./types.js";