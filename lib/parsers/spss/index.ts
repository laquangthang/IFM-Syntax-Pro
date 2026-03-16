/**
 * SPSS Excel Parser - Single entry point
 * Input: Excel file with 2 columns (variable name, label)
 * Output: ParsedQuestion[] + variables + oldVariableMapping (no syntax - use lib/syntaxGenerator)
 */

export { parseSPSSExcel } from './parser'
export type { SPSSVariable, SPSSParseResult } from './types'
