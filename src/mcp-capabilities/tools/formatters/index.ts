import { ProcedureFormatter } from "./procedure-formatter.js";
import { ProcedureListFormatter } from "./procedure-list-formatter.js";
import { StepFormatter } from "./step-formatter.js";
import { SearchProceduresFormatter } from "./search-procedures-formatter.js";

// Export necessary types
export * from "./types.js";

// Create instances of formatters
const procedure = new ProcedureFormatter();
const procedureList = new ProcedureListFormatter();
const step = new StepFormatter();
const searchProcedures = new SearchProceduresFormatter();

/**
 * Export a central object containing all formatters
 */
export const formatters = {
  procedure,
  procedureList,
  step,
  searchProcedures,
};
