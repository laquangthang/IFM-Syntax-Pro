import { ParsedQuestion } from './types'
import { hasOtherOption, hasOtherInOptions, hasOtherInRows, getMainOptions } from './utils/mrHelpers'

/**
 * Calculate the number of output variables needed for a question.
 * Other (Khác) is detected solely via codeType === 'Other' from parser (Othr suffix in variable name).
 */

export function getVariableCountForQuestion(question: ParsedQuestion): number {
  switch (question.type) {
    case 'SA':
    case 'OE': {
      const hasOther = hasOtherOption(question)
      return hasOther ? 2 : 1
    }

    case 'MA': {
      const options = question.options || []
      const mainOptions = getMainOptions(options)
      const hasOther = hasOtherInOptions(options)
      return mainOptions.length + (hasOther ? 1 : 0)
    }

    case 'SA_Grid':
    case 'OE_Grid': {
      const options = question.options || []
      const mainOptions = getMainOptions(options)
      const hasOther = hasOtherInOptions(options)
      return mainOptions.length + (hasOther ? 1 : 0)
    }

    case 'MA_Grid': {
      const columns = question.columns || []
      const rows = question.rows || []
      const mainRows = rows.filter(r => r.codeType !== 'Other')
      const hasOtherRow = hasOtherInRows(rows)
      
      const baseCount = columns.length * mainRows.length
      const otherCount = hasOtherRow ? columns.length : 0
      return baseCount + otherCount
    }

    case 'Rank_Fixed':
    case 'Rank_Upto': {
      const options = question.options || []
      const mainOptions = getMainOptions(options)
      return mainOptions.length
    }

    default:
      return 0
  }
}



