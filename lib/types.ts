/**
 * Type definitions for parsed survey questions and survey state
 */

/** Mapping of question ID to array of original variable names (from SPSS Excel) */
export interface OldVariableMapping {
  [questionId: string]: string[]
}

export interface QuestionOption {
  code: string | number
  label: string
  codeType?: 'Normal' | 'Exclusive' | 'Trap' | 'Other' | 'Terminate' | 'string' | 'number'
  /** Raw Excel variable name for the text companion column (e.g. var589O1740Othr). Paired with base option. */
  openEndedRawVariable?: string
}

export interface QuestionLogic {
  type?: 'Ask All' | 'Piping' | 'Normal'
  piping_source?: string | null // e.g., "Q8" or null
  /** Codes excluded from piping (e.g. [3] = no edge from Q7R3). Enables 1-to-1 binding when user deletes a single piping edge. */
  piping_excluded_codes?: (string | number)[]
  terminate_if?: string | null
  ask_if_condition?: string | null // e.g., "IF (Q5R6 = 6 OR Q5R7 = 7)" - condition for ASK IF connections
}

export interface ParsedQuestion {
  id: string // Q1, Q2, Q3A, etc.
  type: 'SA' | 'MA' | 'SA_Grid' | 'MA_Grid' | 'Rank_Fixed' | 'Rank_Upto' | 'OE' | 'OE_Grid' | 'Numeric' | 'Sum'
  instruction?: string // Original instruction text (Note, SCRIPT, etc.)
  label: string
  options?: QuestionOption[]
  rows?: QuestionOption[] // For Grid questions
  columns?: QuestionOption[] // For Grid questions (empty for OE_Grid)
  limit?: number // For Rank questions
  logic?: QuestionLogic
  // For SA_Grid: map row index (as string) to options for that row
  // e.g., { "1": [{code: 1, label: "Option 1"}, ...], "2": [...], ... }
  rowOptionsMap?: Record<string, QuestionOption[]>
  /** baseVariable -> textVariable (e.g. { 'var718O2212': 'var718O2212Othr' }). Used for grid pairing to prevent index shifting. */
  textCompanions?: Record<string, string>
  /** SA questions with multiple open-ended fields (e.g. Q3, Q23). Companion vars in order for Rename to Q3_1_O, Q3_2_O. */
  saTextCompanions?: string[]
}
