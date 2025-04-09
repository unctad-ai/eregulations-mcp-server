export enum PromptName {
  LIST_PROCEDURES = "listProcedures",
  GET_PROCEDURE_DETAILS = "getProcedureDetails",
  GET_PROCEDURE_STEP = "getProcedureStep",
  SEARCH_PROCEDURES = "searchProcedures",
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
A list of available procedures with their IDs, names, and basic information. Use this tool to discover what procedures are available in the system and to find procedureIds needed for other tools.

## Example Response
\`\`\`
Found 147 procedures:

1. EXPORT > Zanzibar > Commodities > Cloves (Karafuu) > Buying cloves at Zanzibar State Trading Corporation (ZSTC) (ID:725)
2. EXPORT > Zanzibar > Commodities > Fish and fishery products (Samaki) (Zanzibar) > Clearance procedures > Clearance through port of Malindi (ID:794)
3. EXPORT > Zanzibar > Commodities > Fish and fishery products (Samaki) (Zanzibar) > Full procedure view- for a first time trader > Export of fish and fishery products through port of Zanzibar (ID:796)
4. EXPORT > Zanzibar > Commodities > Fruits (Zanzibar) > Clearance procedures > Clearance of fruits through Abeid Aman Karuma international Airpot (ID:1189)
5. EXPORT > Zanzibar > Commodities > Seaweeds (Mwani) > Clearance procedures > Seaweeds export clearance through Malindi port (ID:733)
\`\`\`

The response shows each procedure with:
- Its hierarchical categorization (e.g., EXPORT > Zanzibar > Commodities...)
- The specific name of the procedure
- The procedure ID in parentheses (e.g., ID:725)
`,

  [PromptName.GET_PROCEDURE_DETAILS]: `# Get Procedure Details
Get comprehensive information about a specific procedure by its ID.

## Usage
\`\`\`json
{
  "name": "getProcedureDetails",
  "arguments": {
    "procedureId": 725  // Replace with the ID of the procedure you want to retrieve
  }
}
\`\`\`

## Parameters
- \`procedureId\` (number, required): The numeric ID of the procedure to retrieve

## Returns
Detailed information about the requested procedure, including:
- Basic procedure information (name, description, responsible institution)
- Complete list of steps with their sequence
- Requirements, documents, and forms needed
- Contact information
- Timelines and costs

## Example Response
\`\`\`
PROCEDURE: Procedure 725 (ID:725)
URL: https://tanzania.tradeportal.org/procedure/725

STEPS:
1. Submit application for buying cloves (STEP ID:2787)
   Entity: Zanzibar State Trading Corporation (ZSTC) 
   Requirements: Application letter for buying cloves;
2. Pay for cloves (STEP ID:2788)
   Entity: The People's Bank of Zanzibar (PBZ)
   Requirements: Profoma invoice - ZSTC;
3. Submit payment slip (STEP ID:2789)
   Entity: Zanzibar State Trading Corporation (ZSTC) 
   Requirements: Swift copy; Stamped bank deposit slip;
4. Submit shipping instruction (STEP ID:2791)
   Entity: Zanzibar State Trading Corporation (ZSTC) 
   Requirements: Shipping instruction;
   Time: ~3 days
5. Obtain documents and consignment (STEP ID:2790)
   Entity: Zanzibar State Trading Corporation (ZSTC) 

FINAL DOCUMENTS: ZSTC Packing list; Certificate of origin from ZCCIA; Bill of lading; Clove consignment; Phytosanitary certificate (Zanzibar); Commercial invoice from ZSTC;

SUMMARY:
Steps: 5 | Institutions: 2 | Requirements: 5
Est. time: 3.0 days (includes 50 minutes at counters)
\`\`\`

The response provides:
- Procedure identification (name and ID)
- A sequential list of steps with:
  - Step name and ID (important for using getProcedureStep)
  - The responsible entity/institution
  - Required documents for each step
  - Time estimates where available
- Final documents received upon completion
- A summary with total step count, number of institutions, requirements, and time estimates

## Notes
- Use \`listProcedures\` first to find valid procedure IDs
- The response includes both human-readable text and structured JSON data
- If an invalid procedureId is provided, an error message will be returned
`,

  [PromptName.GET_PROCEDURE_STEP]: `# Get Procedure Step
Get detailed information about a specific step within a procedure.

## Usage
\`\`\`json
{
  "name": "getProcedureStep",
  "arguments": {
    "procedureId": 725,  // ID of the procedure
    "stepId": 2791       // ID of the step within that procedure
  }
}
\`\`\`

## Parameters
- \`procedureId\` (number, required): The numeric ID of the procedure
- \`stepId\` (number, required): The numeric ID of the specific step to retrieve

## Returns
Comprehensive details about a specific step, including:
- Step name and description
- Requirements and documentation needed for this step
- Contact information (office, officials, hours)
- Location information
- Fees or costs for this specific step
- Processing time
- Legal references

## Example Response
\`\`\`
STEP: Submit shipping instruction (ID:2791)
STATUS: Certified
CONTACT:
Entity: Zanzibar State Trading Corporation (ZSTC) 
Phone: +255 242 230 271 | Email: info@zstcznz.org | Web: https://www.zstcznz.org/
Address: P.O.Box 26, Maisara Street
Unit: Department of Trade - ZSTC
Contact: Issa H. Ramadhan (Marketing Officer)
REQUIREMENTS:
- Shipping instruction  (1 copy)
TIMEFRAME: 5min at counter + 3 days processing
LEGAL REFS: The Zanzibar State Trade Corporation  Act, 11 of 2011
\`\`\`

The response provides:
- Step identification (name and ID)
- Official status of the step
- Detailed contact information:
  - Entity/organization name
  - Contact details (phone, email, website)
  - Physical address
  - Department/unit responsible
  - Specific personnel contact
- Document requirements with quantity specifications
- Timeframe breakdown (counter time and processing time)
- Legal references and regulations governing this step

## Notes
- Use \`getProcedureDetails\` first to identify valid step IDs within a procedure
- The response includes both formatted text and structured JSON data
- If either the procedureId or stepId is invalid, an error message will be returned
`,

  [PromptName.SEARCH_PROCEDURES]: `# Search Procedures
Search for procedures in the eRegulations system by keyword or phrase.

## Usage
\`\`\`json
{
  "name": "searchProcedures",
  "arguments": {
    "keyword": "permit"  // Replace with your search term
  }
}
\`\`\`

## Parameters
- \`keyword\` (string, required): The keyword or phrase to search for

## Returns
A list of procedures matching the search criteria, with their IDs, names, and basic information. Use this tool to find relevant procedures based on keywords.

## Example Response
\`\`\`
Found 5 procedures for "permit":

1. EXPORT > Tanzania Mainland > Commodities > Fish and fishery products (Samaki) > Quality control procedures > Application for export permit (ID:251)
2. IMPORT > Tanzania Mainland > Commodities > Agricultural inputs > Pesticides > Apply for import permit (ID:324)
3. IMPORT > Tanzania Mainland > Commodities > Plants and plant products > Application for plant import permit (ID:465)
4. EXPORT > Tanzania Mainland > Commodities > Plants and plant products > Application for phytosanitary certificate/export permit (ID:478)
5. IMPORT > Zanzibar > Commodities > Plants and plant products > Apply for plant import permit (ID:811)
\`\`\`

The response shows each matching procedure with:
- Its hierarchical categorization (e.g., EXPORT > Tanzania Mainland > Commodities...)
- The specific name of the procedure
- The procedure ID in parentheses (e.g., ID:251)

## Notes
- Use specific terms related to the procedure you're looking for
- Once you find a relevant procedure ID, use \`getProcedureDetails\` to get comprehensive information about it
- If your search returns too many results, try using more specific keywords
- If your search returns no results, try using more general terms or synonyms
`,
};