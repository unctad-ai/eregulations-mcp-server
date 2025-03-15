# eRegulations API Notes

## Overview
The eRegulations platform provides a comprehensive API for accessing information about administrative procedures, requirements, costs, and regulatory information. This document captures the key endpoints and data structures observed in the Tanzania instance of the eRegulations API.

## API Base URL
- Base URL: https://api-tanzania.tradeportal.org/
- API Version: v1

## Key Endpoints

### Procedure Endpoints
The Procedure endpoints are central to the eRegulations platform, providing detailed information about administrative procedures:

- `GET /Procedures/{id}` - Get complete information of a procedure by ID
  - Returns procedure object with blocks, steps, and online information
  - Data type of ID: integer

- `GET /Procedures/{id}/Totals` - Get procedure totals (likely costs and time)

- `GET /Procedures/{id}/Resume` - Get a procedure resume (summary)

- `GET /Procedures/{id}/ResumeDetail` - Get a detailed procedure resume

- `GET /Procedures/{id}/ABC` - Get procedure ABC (possibly Activity-Based Costing)

- `GET /Procedures/{id}/ABC/Levels` - Get staff levels of the step list

- `GET /Procedures/{id}/ABC/Zones` - Get zones of the institution list

- `GET /Procedures/{id}/ABC/Requirements` - Get requirements total costs

- `GET /Procedures/{id}/ABC/Full` - Get detailed ABC

- `GET /Procedures/{procedureId}/{menuId}` - Get procedure associated with a menu

- `GET /Procedures/{procedureId}/Steps/{stepId}` - Get a step associated with a procedure

- `GET /Procedures/{procedureId}/Steps/{stepId}/ABC` - Get ABC of a step

### Other Key Endpoints
The API also includes endpoints for other entities:

- Category
- Contact
- Country
- CountryParameters
- DocumentCost
- Filter
- Form
- Law
- Layout
- Menu
- Objective
- Person
- Unit

## Data Structure
From the example response for the Procedure endpoint, we can see the following structure:

```json
{
  "url": "string",
  "additionalInfo": "string",
  "blocks": [
    {
      "steps": [
        {
          "online": {
            "url": "string",
            "type": 0
          }
        }
      ]
    }
  ]
}
```

This suggests that:
- Procedures contain blocks
- Blocks contain steps
- Steps may have online components with URLs and types
- There are likely additional fields not shown in this basic example

## Observations for MCP Integration
1. The API is RESTful with clear endpoint structure
2. Procedures are the central entity with hierarchical data (blocks > steps)
3. Multiple views of procedures are available (resume, detailed, ABC analysis)
4. The API provides detailed cost and requirement information
5. Integration with menus suggests a presentation layer connection

## Next Steps
- Explore more endpoints to understand the complete data model
- Determine authentication requirements for the API
- Identify the most relevant endpoints for answering user questions about procedures
- Design a data processing pipeline to transform API responses into MCP-compatible formats
