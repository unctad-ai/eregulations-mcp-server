import type { ERegulationsApi } from "../../../services/eregulations-api.js";

/**
 * Base interface for data formatters
 * All formatters should implement this interface
 */
export interface DataFormatter<T, R> {
  format(data: T): R;
}

/**
 * Procedure data interface
 * Represents the key properties we expect in procedure data
 */
export interface ProcedureData {
  id: number;
  name: string;
  fullName?: string;
  explanatoryText?: string;
  isOnline?: boolean;
  parentName?: string | null; // Updated to allow null
  data?: {
    id?: number;
    name?: string;
    url?: string;
    description?: string;
    additionalInfo?: string;
    blocks?: {
      steps?: StepData[];
    }[];
  };
  resume?: any;
  totals?: any;
  [key: string]: any;
}

/**
 * Step data interface
 * Represents the key properties we expect in step data
 */
export interface StepData {
  id?: number;
  name?: string;
  procedureId?: number;
  procedureName?: string;
  isOptional?: boolean;
  isCertified?: boolean;
  isParallel?: boolean;
  isOnline?: boolean;
  online?: {
    url?: string;
  };
  contact?: {
    entityInCharge?: {
      name: string;
      firstPhone?: string;
      secondPhone?: string;
      firstEmail?: string;
      secondEmail?: string;
      firstWebsite?: string;
      secondWebsite?: string;
      address?: string;
      scheduleComments?: string;
    };
    unitInCharge?: {
      name: string;
    };
    personInCharge?: {
      name: string;
      profession?: string;
    };
  };
  requirements?: {
    name: string;
    comments?: string;
    nbOriginal?: number;
    nbCopy?: number;
    nbAuthenticated?: number;
  }[];
  results?: {
    name: string;
    comments?: string;
    isFinalResult?: boolean;
  }[];
  timeframe?: {
    timeSpentAtTheCounter?: {
      minutes?: {
        max: number;
      };
    };
    waitingTimeInLine?: {
      minutes?: {
        max: number;
      };
    };
    waitingTimeUntilNextStep?: {
      days?: {
        max: number;
      };
    };
    comments?: string;
  };
  costs?: {
    value?: number;
    unit?: string;
    operator?: string;
    parameter?: string;
    comments?: string;
    paymentDetails?: string;
  }[];
  additionalInfo?: {
    text: string;
  };
  laws?: {
    name: string;
  }[];
  [key: string]: any;
}

/**
 * Objective data interface (based on ObjectiveWithDescriptionBaseModel)
 */
export interface ObjectiveData {
  id: number;
  name: string;
  description?: string;
  links?: (ApiLink | null)[]; // Add optional links array, allowing nulls
}

/**
 * Interface for formatted procedure list response
 */
export interface FormattedProcedureList {
  text: string;
  data: any[];
}

/**
 * Interface for formatted procedure details response
 */
export interface FormattedProcedureDetails {
  text: string;
  data: any;
}

/**
 * Interface for formatted procedure step response
 */
export interface FormattedProcedureStep {
  text: string;
  data: any;
}

/**
 * Interface representing the formatted output of data formatters
 */
export interface FormattedObjectiveList {
  text: string; // Human-readable summary
  data: any[]; // Simplified structured data (id, name, description?)
}

/**
 * Basic structure for API link objects
 */
export interface ApiLink {
  rel: string;
  href: string;
}
