/**
 * Type definitions for parsed survey questions
 */

export interface QuestionOption {
  code: string | number
  label: string // Single string (Vietnamese only)
  codeType?: 'Normal' | 'Exclusive' | 'Trap' | 'Other' | 'Terminate' | 'string' | 'number'
}

export interface QuestionLogic {
  type?: 'Ask All' | 'Piping' | 'Normal'
  piping_source?: string | null // e.g., "Q8" or null
  terminate_if?: string | null
  ask_if_condition?: string | null // e.g., "IF (Q5R6 = 6 OR Q5R7 = 7)" - condition for ASK IF connections
}

export interface ParsedQuestion {
  id: string // Q1, Q2, Q3A, etc.
  type: 'SA' | 'MA' | 'SA_Grid' | 'MA_Grid' | 'Rank_Fixed' | 'Rank_Upto' | 'OE' | 'OE_Grid' | 'Numeric'
  instruction?: string // Original instruction text (Note, SCRIPT, etc.)
  label: string // Clean question text (Vietnamese only, single string)
  options?: QuestionOption[]
  rows?: QuestionOption[] // For Grid questions
  columns?: QuestionOption[] // For Grid questions (empty for OE_Grid)
  limit?: number // For Rank questions
  logic?: QuestionLogic
  // For SA_Grid: map row index (as string) to options for that row
  // e.g., { "1": [{code: 1, label: "Option 1"}, ...], "2": [...], ... }
  rowOptionsMap?: Record<string, QuestionOption[]>
}
