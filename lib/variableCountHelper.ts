import { ParsedQuestion } from './geminiParser'

/**
 * Calculate the number of output variables needed for a question
 * This helps determine how many old variables the user needs to provide
 */

function hasOtherSpecify(label: string): boolean {
  const lower = label.toLowerCase()
  // Only match if it has explicit "(ghi rõ)" pattern, not just the word "khác" or "other" alone
  return lower.includes('(ghi rõ)') || lower.includes('(vui lòng ghi rõ)') || lower.includes('(specify)') || 
         (lower.includes('other') && (lower.includes('(specify)') || lower.includes('ghi rõ'))) ||
         (lower.includes('khác') && (lower.includes('(ghi rõ)') || lower.includes('ghi rõ')))
}

export function getVariableCountForQuestion(question: ParsedQuestion): number {
  switch (question.type) {
    case 'SA':
    case 'OE': {
      // 1 variable (or 2 if has "Other (ghi rõ)")
      const hasOther = question.options?.some(opt => hasOtherSpecify(opt.label)) || false
      return hasOther ? 2 : 1
    }

    case 'MA': {
      // One variable per code (excluding _O options) + 1 if has Other
      const options = question.options || []
      const mainOptions = options.filter(opt => !String(opt.code).endsWith('_O'))
      const hasOther = mainOptions.some(opt => hasOtherSpecify(opt.label))
      return mainOptions.length + (hasOther ? 1 : 0)
    }

    case 'SA_Grid':
    case 'OE_Grid': {
      // One variable per option (excluding _O) + 1 if has Other
      const options = question.options || []
      const mainOptions = options.filter(opt => !String(opt.code).endsWith('_O'))
      const hasOther = mainOptions.some(opt => hasOtherSpecify(opt.label))
      return mainOptions.length + (hasOther ? 1 : 0)
    }

    case 'MA_Grid': {
      // Variables = columns × rows + Other variables if exists
      const columns = question.columns || []
      const rows = question.rows || []
      const mainRows = rows.filter(r => !String(r.code).endsWith('_O'))
      const hasOtherRow = mainRows.some(r => hasOtherSpecify(r.label))
      
      const baseCount = columns.length * mainRows.length
      const otherCount = hasOtherRow ? columns.length : 0
      return baseCount + otherCount
    }

    case 'Rank_Fixed':
    case 'Rank_Upto': {
      // One variable per option (excluding _O)
      const options = question.options || []
      const mainOptions = options.filter(opt => !String(opt.code).endsWith('_O'))
      return mainOptions.length
    }

    default:
      return 0
  }
}



