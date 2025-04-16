import {
  DataFormatter,
  FormattedProcedureDetails,
  ProcedureData,
} from "./types.js";

/**
 * Formats procedure data in a way optimized for LLMs with context length constraints
 */
export class ProcedureFormatter
  implements DataFormatter<ProcedureData, FormattedProcedureDetails>
{
  /**
   * Format procedure data for LLM consumption
   * @param procedure The procedure data to format
   * @returns Formatted procedure text and essential data
   */
  public format(procedure: ProcedureData): FormattedProcedureDetails {
    if (!procedure) {
      return {
        text: "No procedure data available",
        data: {},
      };
    }

    // Extract and format the text representation
    const formattedText = this.formatText(procedure);

    // Extract essential data only if requested
    const essentialData = this.extractEssentialData(procedure);

    return {
      text: formattedText,
      data: essentialData,
    };
  }

  /**
   * Extract only the essential data needed for LLM reasoning
   * @param procedure The full procedure data
   * @returns A simplified object with essential fields
   */
  private extractEssentialData(procedure: ProcedureData): any {
    return {
      id: procedure.id,
      name: procedure.fullName || procedure.name,
      isOnline: procedure.isOnline || false,
      description:
        procedure.data?.description || procedure.explanatoryText || null,
      additionalInfo: procedure.data?.additionalInfo,
      steps:
        procedure.data?.blocks?.[0]?.steps?.map((step) => ({
          id: step.id,
          name: step.name,
          isOnline: step.isOnline || false,
          entityName: step.contact?.entityInCharge?.name,
        })) || [],
    };
  }

  /**
   * Format procedure data as human-readable text
   * @param procedure The procedure data to format
   * @returns Formatted text optimized for LLM context window
   */
  private formatText(procedure: ProcedureData): string {
    // Sets for tracking unique entities to avoid repetition
    const institutions = new Set<string>();
    const requirements = new Set<string>();
    let totalTimeAtCounter = 0;
    let totalWaitingTime = 0;
    let totalProcessingDays = 0;
    let totalCost = 0;
    let percentageCosts: { name: string; value: number; unit: string }[] = [];

    // Get name and ID from full procedure data structure
    const name =
      procedure.fullName ||
      procedure.name ||
      (procedure.data && procedure.data.name) ||
      "Unknown";
    const id = procedure.data?.id || procedure.id || "Unknown";

    // Start with compact header
    let result = `PROCEDURE: ${name} (ID:${id})\n`;

    // Add URL only if available (save context space)
    if (procedure.data?.url) {
      result += `URL: ${procedure.data.url}\n`;
    }

    // Add description if available, always full length now
    const description = procedure.data?.description;
    if (description) {
      // Always use the full description
      const descriptionText = description;
      result += `DESC: ${descriptionText}\n`;
    }

    // Add additionalInfo if available
    const additionalInfoText = procedure.data?.additionalInfo;
    if (additionalInfoText) {
      result += `INFO: ${additionalInfoText}\n`;
    }

    result += "\nSTEPS:\n";
    let stepNumber = 1;

    // Handle blocks section which contains the steps
    if (procedure.data?.blocks && procedure.data.blocks.length) {
      procedure.data.blocks.forEach((block: any) => {
        if (block.steps && block.steps.length) {
          block.steps.forEach((step: any) => {
            // Compact step header
            result += `${stepNumber}. ${step.name} (STEP ID:${step.id})`;

            // Add online indicator with minimal text
            if (step.online?.url || step.isOnline) {
              result += " [ONLINE]";
              // Only add URL if it's specifically provided
              if (step.online?.url) {
                result += ` ${step.online.url}`;
              }
            }
            result += "\n";

            // Add entity information in compact format
            if (step.contact?.entityInCharge) {
              const entity = step.contact.entityInCharge;
              institutions.add(entity.name);
              result += `   Entity: ${entity.name}\n`;
            }

            // Add requirements with minimal formatting
            if (step.requirements && step.requirements.length > 0) {
              result += "   Requirements:";
              // Use inline format for requirements to save space
              step.requirements.forEach((req: any) => {
                if (!requirements.has(req.name)) {
                  requirements.add(req.name);
                  result += ` ${req.name};`;
                }
              });
              result += "\n";
            }

            // Add timeframes in compact format
            if (step.timeframe) {
              const tf = step.timeframe;
              if (tf.waitingTimeUntilNextStep?.days?.max) {
                const days = tf.waitingTimeUntilNextStep.days.max;
                result += `   Time: ~${days} days\n`;
                totalProcessingDays += days;
              }

              // Accumulate counter time without adding to output
              if (tf.timeSpentAtTheCounter?.minutes?.max) {
                totalTimeAtCounter += tf.timeSpentAtTheCounter.minutes.max;
              }
              if (tf.waitingTimeInLine?.minutes?.max) {
                totalWaitingTime += tf.waitingTimeInLine.minutes.max;
              }
            }

            // Add costs in compact format
            if (step.costs && step.costs.length > 0) {
              result += "   Cost:";
              step.costs.forEach((cost: any) => {
                if (cost.value) {
                  if (cost.operator === "percentage") {
                    result += ` ${cost.value}% ${cost.parameter || ""};`;
                    percentageCosts.push({
                      name: cost.comments || "Fee",
                      value: cost.value,
                      unit: cost.unit || "",
                    });
                  } else {
                    result += ` ${cost.value} ${cost.unit};`;
                    //if (cost.unit === 'TZS') {
                    totalCost += parseFloat(cost.value);
                    //}
                  }
                }
              });
              result += "\n";
            }

            stepNumber++;
          });
        }
      });
    }

    // Add final documents section if available - compact format
    const finalResults =
      procedure.data?.blocks?.[0]?.steps?.flatMap(
        (step: any) =>
          step.results?.filter((result: any) => result.isFinalResult) || []
      ) || [];

    if (finalResults.length > 0) {
      result += "\nFINAL DOCUMENTS:";
      finalResults.forEach((doc: any) => {
        result += ` ${doc.name};`;
      });
      result += "\n";
    }

    // Add summary section with totals in compact format
    result += "\nSUMMARY:\n";
    result += `Steps: ${stepNumber - 1} | Institutions: ${
      institutions.size
    } | Requirements: ${requirements.size}\n`;

    // Calculate overall totals
    const totalMinutes = totalTimeAtCounter + totalWaitingTime;
    const totalTime = totalProcessingDays + totalMinutes / (60 * 24); // Convert minutes to days

    if (totalTime > 0) {
      // Round to 1 decimal place for cleaner output
      result += `Est. time: ${totalTime.toFixed(1)} days`;
      if (totalMinutes > 0) {
        result += ` (includes ${totalMinutes} minutes at counters)`;
      }
      result += "\n";
    }

    if (totalCost > 0) {
      // Use compact number formatting
      result += `Fixed costs: ${totalCost.toLocaleString()} TZS\n`;
    }

    if (percentageCosts.length > 0) {
      result += "Variable costs:";
      percentageCosts.forEach((cost) => {
        result += ` ${cost.name}: ${cost.value}%${
          cost.unit ? " " + cost.unit : ""
        };`;
      });
      result += "\n";
    }

    return result;
  }
}
