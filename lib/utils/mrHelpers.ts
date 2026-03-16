/**
 * MR (Multiple Response) and question structure helpers
 * Single source of truth for "Other" detection and option filtering.
 * Other is detected via codeType === 'Other' from parser (Othr suffix in variable name).
 */

import { ParsedQuestion, QuestionOption } from '../types'

/**
 * Check if options array contains an "Other" option (codeType === 'Other' or code ends with _O)
 */
export function hasOtherInOptions(options: QuestionOption[]): boolean {
  if (!options || options.length === 0) return false
  return options.some(opt => opt.codeType === 'Other' || String(opt.code).endsWith('_O'))
}

/**
 * Check if rows array contains an "Other" row
 */
export function hasOtherInRows(rows: QuestionOption[]): boolean {
  if (!rows || rows.length === 0) return false
  return rows.some(r => r.codeType === 'Other')
}

/**
 * Check if a question has an "Other" option (for SA, MA, OE, SA_Grid, OE_Grid)
 */
export function hasOtherOption(question: ParsedQuestion): boolean {
  return hasOtherInOptions(question.options || [])
}

/**
 * Get main options excluding "Other" (codeType !== 'Other' and not _O suffix)
 */
export function getMainOptions(options: QuestionOption[]): QuestionOption[] {
  if (!options || options.length === 0) return []
  return options.filter(opt => opt.codeType !== 'Other' && !String(opt.code).endsWith('_O'))
}

/**
 * Get output variable names for paired Other options (dynamic _O naming).
 * Used for UI display of predicted output (e.g. Q1R14_O, H5_O).
 */
export function getOtherOutputVariableNames(question: ParsedQuestion): string[] {
  const id = question.id
  const result: string[] = []

  if (question.type === 'SA' || question.type === 'OE') {
    if (hasOtherOption(question)) result.push(`${id}_O`)
    return result
  }

  if (question.type === 'MA' && question.options) {
    question.options
      .filter(opt => opt.codeType === 'Other')
      .forEach(opt => {
        const code = typeof opt.code === 'number' ? opt.code : parseInt(String(opt.code).replace(/_O$/, ''), 10)
        if (!isNaN(code)) result.push(`${id}R${code}_O`)
      })
    return result
  }

  if (question.type === 'SA_Grid' && question.options) {
    question.options
      .filter(opt => opt.codeType === 'Other')
      .forEach(opt => {
        const code = typeof opt.code === 'number' ? opt.code : String(opt.code)
        result.push(`${id}_${code}_O`)
      })
    return result
  }

  if (question.type === 'MA_Grid' && question.columns && question.rows) {
    const otherRows = question.rows.filter(r => r.codeType === 'Other')
    question.columns.forEach(col => {
      const colCode = typeof col.code === 'number' ? col.code : col.code
      otherRows.forEach(row => {
        const rowCode = typeof row.code === 'number' ? row.code : parseInt(String(row.code).replace(/_O$/, ''), 10)
        if (!isNaN(rowCode)) result.push(`${id}_${colCode}R${rowCode}_O`)
      })
    })
    return result
  }

  return result
}
