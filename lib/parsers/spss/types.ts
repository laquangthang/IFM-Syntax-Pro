import type { ParsedQuestion } from '@/lib/types'

export interface SPSSVariable {
  originalVar: string
  label: string
  questionId: string
  variableType: 'SA' | 'MA' | 'Grid' | 'Loop' | 'Rank' | 'Sum' | 'Unknown'
  optionCode?: number
  subIndex?: number
  optionLabel?: string
}

export interface SPSSParseResult {
  questions: ParsedQuestion[]
  variables: SPSSVariable[]
  oldVariableMapping: Record<string, string[]>
}
