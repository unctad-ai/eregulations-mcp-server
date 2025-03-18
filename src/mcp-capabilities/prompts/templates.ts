export enum PromptName {
  LIST_PROCEDURES = "listProcedures",
  GET_PROCEDURE_DETAILS = "getProcedureDetails",
  GET_PROCEDURE_STEP = "getProcedureStep",
}

export const PROMPT_TEMPLATES = {
  [PromptName.LIST_PROCEDURES]: `# List Procedures
Get a list of all available procedures in the eRegulations system.

## Usage
\`\`\`json
{
  "name": "listProcedures"
}
\`\`\`

## Returns
A list of procedures with their IDs, names, and basic details.`,

  [PromptName.GET_PROCEDURE_DETAILS]: `# Get Procedure Details
Get detailed information about a specific procedure by its ID.

## Usage
\`\`\`json
{
  "name": "getProcedureDetails",
  "arguments": {
    "procedureId": 725  // Replace with the ID of the procedure you want to retrieve
  }
}
\`\`\`

## Notes
- Use listProcedures first to find valid procedure IDs
- Returns complete information about steps, requirements, timelines and costs`,

  [PromptName.GET_PROCEDURE_STEP]: `# Get Procedure Step
Get information about a specific step within a procedure.

## Usage
\`\`\`json
{
  "name": "getProcedureStep",
  "arguments": {
    "procedureId": 725,  // ID of the procedure
    "stepId": 2787      // ID of the step within that procedure
  }
}
\`\`\`

## Notes
- Use getProcedureDetails first to find valid step IDs within a procedure
- Returns detailed information about a specific step including requirements and contact information`,
};