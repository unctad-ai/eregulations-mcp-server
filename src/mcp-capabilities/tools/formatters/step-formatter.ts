import { DataFormatter, FormattedProcedureStep, StepData } from './types.js';

/**
 * Formats step data in a way optimized for LLMs with context length constraints
 */
export class StepFormatter implements DataFormatter<StepData, FormattedProcedureStep> {
  /**
   * Format step data for LLM consumption
   * @param step The step data to format
   * @returns Formatted step text and essential data
   */
  public format(step: StepData): FormattedProcedureStep {
    if (!step) {
      return {
        text: "No step data available",
        data: {}
      };
    }
    
    // Extract and format the text representation
    const formattedText = this.formatText(step);
    
    // Extract essential data for structured representation
    const essentialData = this.extractEssentialData(step);
    
    return {
      text: formattedText,
      data: essentialData
    };
  }

  /**
   * Extract only the essential data needed for LLM reasoning
   * @param step The full step data
   * @returns A simplified object with essential fields
   */
  private extractEssentialData(step: StepData): any {
    return {
      id: step.id,
      name: step.name,
      procedureId: step.procedureId,
      isOnline: step.isOnline || (step.online && !!step.online.url) || false,
      entityName: step.contact?.entityInCharge?.name,
      // Only include these if present
      ...(step.online?.url ? { onlineUrl: step.online.url } : {}),
      ...(step.requirements ? { 
        requirementCount: step.requirements.length,
        requirements: step.requirements.map(r => r.name)
      } : {}),
      ...(step.costs ? {
        costCount: step.costs.length,
        hasCosts: step.costs.length > 0
      } : {})
    };
  }

  /**
   * Format step data as human-readable text
   * @param step The step data to format
   * @returns Formatted text optimized for LLM context window
   */
  private formatText(step: StepData): string {
    // Start with compact header
    let result = `STEP: ${step.name || 'Unnamed'} (ID:${step.id || 'Unknown'})\n`;
    if (step.procedureName) {
      result += `PROCEDURE: ${step.procedureName} (ID:${step.procedureId})\n`;
    }
    
    // Online completion indicator
    if (step.online?.url || step.isOnline) {
      result += "ONLINE: Yes";
      if (step.online?.url) {
        result += ` (${step.online.url})`;
      }
      result += '\n';
    }
    
    // Step metadata in compact format
    const metadata = [];
    if (step.isOptional) metadata.push("Optional");
    if (step.isCertified) metadata.push("Certified");
    if (step.isParallel) metadata.push("Parallel");
    if (metadata.length > 0) {
      result += `STATUS: ${metadata.join(', ')}\n`;
    }
    
    // Contact information in compact format
    if (step.contact) {
      result += "CONTACT:\n";
      if (step.contact.entityInCharge) {
        const entity = step.contact.entityInCharge;
        result += `Entity: ${entity.name}\n`;
        
        // Combine contact details to save space
        const contactDetails = [];
        if (entity.firstPhone) contactDetails.push(`Phone: ${entity.firstPhone}`);
        if (entity.firstEmail) contactDetails.push(`Email: ${entity.firstEmail}`);
        if (entity.firstWebsite) contactDetails.push(`Web: ${entity.firstWebsite}`);
        
        if (contactDetails.length > 0) {
          result += `${contactDetails.join(' | ')}\n`;
        }
        
        // Only include address if available
        if (entity.address) {
          result += `Address: ${entity.address}\n`;
        }
      }
      
      // Add unit/person info only if name is provided (save space)
      if (step.contact.unitInCharge?.name) {
        result += `Unit: ${step.contact.unitInCharge.name}\n`;
      }
      if (step.contact.personInCharge?.name) {
        result += `Contact: ${step.contact.personInCharge.name}`;
        if (step.contact.personInCharge.profession) {
          result += ` (${step.contact.personInCharge.profession})`;
        }
        result += '\n';
      }
    }
    
    // Requirements in compact format
    if (step.requirements?.length) {
      result += "REQUIREMENTS:\n";
      step.requirements.forEach((req: any) => {
        // Combine all requirement details in one line
        let reqLine = `- ${req.name}`;
        
        if (req.nbOriginal || req.nbCopy || req.nbAuthenticated) {
          const copies = [];
          if (req.nbOriginal) copies.push(`${req.nbOriginal} orig`);
          if (req.nbCopy) copies.push(`${req.nbCopy} copy`);
          if (req.nbAuthenticated) copies.push(`${req.nbAuthenticated} auth`);
          reqLine += ` (${copies.join(', ')})`;
        }
        
        result += reqLine + '\n';
        
        // Only add comments if they provide valuable information
        if (req.comments) {
          result += `  Note: ${req.comments}\n`;
        }
      });
    }
    
    // Results/outputs in compact format
    if (step.results?.length) {
      result += "OUTPUTS:\n";
      step.results.forEach((res: any) => {
        result += `- ${res.name}${res.isFinalResult ? " [FINAL]" : ""}\n`;
      });
    }
    
    // Timeframes in compact format
    if (step.timeframe) {
      result += "TIMEFRAME: ";
      const tf = step.timeframe;
      const times = [];
      
      if (tf.timeSpentAtTheCounter?.minutes?.max) {
        times.push(`${tf.timeSpentAtTheCounter.minutes.max}min at counter`);
      }
      if (tf.waitingTimeInLine?.minutes?.max) {
        times.push(`${tf.waitingTimeInLine.minutes.max}min wait`);
      }
      if (tf.waitingTimeUntilNextStep?.days?.max) {
        times.push(`${tf.waitingTimeUntilNextStep.days.max} days processing`);
      }
      
      if (times.length > 0) {
        result += times.join(' + ') + '\n';
      } else {
        result += "Not specified\n";
      }
    }
    
    // Costs in compact format
    if (step.costs?.length) {
      result += "COSTS:\n";
      step.costs.forEach((cost: any) => {
        if (cost.value) {
          if (cost.operator === 'percentage') {
            result += `- ${cost.value}% ${cost.parameter || ''}`;
          } else {
            result += `- ${cost.value} ${cost.unit}`;
          }
          
          if (cost.comments) {
            result += ` (${cost.comments})`;
          }
          result += '\n';
        }
      });
    }
    
    // Only include legal references if present
    if (step.laws?.length) {
      result += "LEGAL REFS: ";
      result += step.laws.map((law: any) => law.name).join(' | ') + '\n';
    }
    
    return result;
  }
}