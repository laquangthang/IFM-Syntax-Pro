/**
 * SPSS Excel Parser - Single entry point for Excel-based data ingestion
 * Input: Excel file with 2 columns (variable name, label)
 * Output: ParsedQuestion[] + variables + oldVariableMapping (syntax via lib/syntaxGenerator)
 */

export {
  parseSPSSExcel,
  type SPSSParseResult,
  type SPSSVariable,
} from './spss'
