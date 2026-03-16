import { ParsedQuestion } from './types'
import { OldVariableMapping } from '@/lib/types'
import { hasOtherOption } from './utils/mrHelpers'

/**
 * Get all child variables for a question
 * - SA, MA, OE, Numeric: Only 1 variable (Q1), or Q1 + Q1_O for SA with Other
 * - SA_Grid, MA_Grid, OE_Grid, Rank_Fixed, Rank_Upto: Multiple variables (Q1_1, Q1_2, ...)
 */
export function getChildVariables(
  question: ParsedQuestion,
  oldVariableMapping: OldVariableMapping
): { varNames: string[], varLabels: string[] } {
  const varNames: string[] = []
  const varLabels: string[] = []
  
  // SA with Other: base + text companion (H5, H5_O)
  if (question.type === 'SA' && hasOtherOption(question)) {
    varNames.push(question.id)
    varLabels.push(question.label)
    varNames.push(`${question.id}_O`)
    varLabels.push(`${question.id}_O. ${question.label} (Other text)`)
    return { varNames, varLabels }
  }
  
  // Single variable questions: SA (no Other), OE, Numeric (MA has per-option variables)
  const singleVariableTypes = ['SA', 'OE', 'Numeric']
  
  if (singleVariableTypes.includes(question.type)) {
    varNames.push(question.id)
    varLabels.push(question.label)
    return { varNames, varLabels }
  }
  
  // MA: per-option variables (Q1R1, Q1R2, ...) and for Other options also Q1R{n}_O
  if (question.type === 'MA' && question.options?.length) {
    question.options.forEach((option) => {
      const code = typeof option.code === 'number' ? option.code : parseInt(String(option.code).replace(/_O$/, ''), 10)
      if (isNaN(code)) return
      const baseName = `${question.id}R${code}`
      varNames.push(baseName)
      varLabels.push(`${question.id}. ${option.label}`)
      if (option.codeType === 'Other' && option.openEndedRawVariable) {
        varNames.push(`${baseName}_O`)
        varLabels.push(`${question.id}. ${option.label} (Other text)`)
      }
    })
    return { varNames, varLabels }
  }
  
  // MA_Grid: Use {QuestionID}_{ColumnCode}R{RowCode} syntax (e.g. H9_1R1, H9_1R2, ..., H9_2R1)
  // Columns = brands, Rows = attributes. Generate in column-major order.
  if (question.type === 'MA_Grid' && question.columns && question.columns.length > 0 && question.rows && question.rows.length > 0) {
    const columns = question.columns
    const rows = question.rows
    columns.forEach((col) => {
      const colCode = typeof col.code === 'number' ? col.code : String(col.code)
      rows.forEach((row) => {
        const rowCode = typeof row.code === 'number' ? row.code : parseInt(String(row.code).replace(/[^0-9]/g, ''), 10)
        if (!isNaN(Number(rowCode))) {
          varNames.push(`${question.id}_${colCode}R${rowCode}`)
          varLabels.push(`${question.id}. ${col.label} - ${row.label}`)
        }
      })
    })
    return { varNames, varLabels }
  }

  // SA_Grid: One variable per row (Q24_1, Q24_2, ...)
  if (question.type === 'SA_Grid' && question.rows && question.rows.length > 0) {
    question.rows.forEach((row, index) => {
      const code = typeof row.code === 'number' ? row.code : index + 1
      varNames.push(`${question.id}_${code}`)
      varLabels.push(`${question.id}. ${row.label}`)
    })
    return { varNames, varLabels }
  }

  // Grid and Rank questions (fallback): Use oldVariableMapping or options
  const oldVars = oldVariableMapping[question.id]
  
  if (oldVars && oldVars.length > 0) {
    // Use oldVariableMapping to determine number of variables
    // Format: Q24_1, Q24_2, ..., Q24_99 for Rank and other multi-variable types
    oldVars.forEach((_, index) => {
      const code = index + 1
      varNames.push(`${question.id}_${code}`)
    })
    
    // Generate labels from question options or use question label
    if (question.options && question.options.length > 0) {
      question.options.forEach((option) => {
        // Skip _O suffix options (they are duplicates)
        if (typeof option.code === 'string' && option.code.endsWith('_O')) {
          return
        }
        const label = `${question.id}. ${option.label}`
        varLabels.push(label)
      })
      // If we have more oldVars than options, fill remaining with question label
      while (varLabels.length < oldVars.length) {
        varLabels.push(question.label)
      }
    } else if (question.rows && question.rows.length > 0) {
      // For Grid questions, use rows for labels
      question.rows.forEach((row) => {
        const label = `${question.id}. ${row.label}`
        varLabels.push(label)
      })
      // If we have more oldVars than rows, fill remaining with question label
      while (varLabels.length < oldVars.length) {
        varLabels.push(question.label)
      }
    } else {
      // If no options/rows, use question label for each variable
      oldVars.forEach(() => {
        varLabels.push(question.label)
      })
    }
  } else if (question.rows && question.rows.length > 0 && question.type !== 'MA_Grid') {
    // Grid questions (SA_Grid etc): generate from rows - one per row
    question.rows.forEach((row, index) => {
      const code = typeof row.code === 'number' ? row.code : index + 1
      varNames.push(`${question.id}_${code}`)
      varLabels.push(`${question.id}. ${row.label}`)
    })
  } else if (question.options && question.options.length > 0) {
    // Rank questions or other multi-variable types: generate from options
    question.options.forEach((option, index) => {
      // Skip _O suffix options
      if (typeof option.code === 'string' && option.code.endsWith('_O')) {
        return
      }
      
      // Use index + 1 for variable name (Q24_1, Q24_2, ...)
      const code = index + 1
      varNames.push(`${question.id}_${code}`)
      varLabels.push(`${question.id}. ${option.label}`)
    })
  } else {
    // Fallback: just use question ID
    varNames.push(question.id)
    varLabels.push(question.label)
  }
  
  return { varNames, varLabels }
}

/**
 * Get Grid question variables for Restruct
 * Returns variables organized by code (R1, R2, ...) across all brands
 * Example: Q8_1R1, Q8_2R1, ..., Q8_99R1 for R1
 */
export function getGridVariablesForRestruct(
  questions: ParsedQuestion[],
  oldVariableMapping: OldVariableMapping
): {
  // NOTE: during construction we temporarily store objects for sorting, then normalize to string[].
  variablesByCode: { [code: string]: Array<string | { var: string; brandIndex: number; rowOrder: number }> }
  numBrands: number
  brandNames: string[]
  codes: string[] // e.g., ['R1', 'R2', ..., 'R99']
  indexVarName: string // e.g., 'Vat_Lieu', 'Khu_Vuc'
} {
  const variablesByCode: { [code: string]: Array<string | { var: string; brandIndex: number; rowOrder: number }> } = {}
  const brandNames: string[] = []
  const codes: string[] = []
  let numBrands = 0
  let indexVarName = 'INDEX_VAR'

  // Get Grid questions only
  const gridQuestions = questions.filter(
    q => q.type === 'SA_Grid' || q.type === 'MA_Grid'
  )

  if (gridQuestions.length === 0) {
    return { variablesByCode, numBrands, brandNames, codes, indexVarName }
  }

  // Use first question to determine structure
  // MA_Grid: columns = brands (Q8_1, Q8_2...), rows = attributes (R1, R2...)
  // Variable format: Q8_{colCode}R{rowCode} e.g. Q8_1R1, Q8_2R1
  const firstQuestion = gridQuestions[0]
  
  // Columns = brands (first dimension in variable name)
  const columns = firstQuestion.columns || []
  numBrands = columns.length
  
  // Brand names from columns
  columns.forEach(col => {
    brandNames.push(col.label)
  })

  // Rows = attributes (R1, R2, R3... - second dimension)
  const rows = firstQuestion.rows || []
  
  // Generate codes (R1, R2, ..., R99) from rows
  rows.forEach(row => {
    const code = typeof row.code === 'number' ? row.code : parseInt(String(row.code).replace(/[^0-9]/g, ''), 10)
    if (!isNaN(code)) {
      const codeStr = `R${code}`
      codes.push(codeStr)
      variablesByCode[codeStr] = []
    }
  })

  // Create a mapping from column (brand) code to row order for sorting
  const columnOrderMap = new Map<string | number, number>()
  columns.forEach((col, index) => {
    const colCode = typeof col.code === 'number' ? col.code : parseInt(String(col.code), 10)
    columnOrderMap.set(colCode, index)
  })

  // Generate variables for each question
  gridQuestions.forEach(question => {
    const oldVars = oldVariableMapping[question.id] || []
    
    // Variable pattern: Q8_{colCode}R{rowCode} - colCode=brand, rowCode=attribute
    const varPattern = new RegExp(`${question.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_(\\d+)R(\\d+)`, 'i')
    
    // If we have oldVariableMapping with NEW-style names (Q8_1R1), extract structure
    const hasNewStyleNames = oldVars.some(v => varPattern.test(v))
    
    if (hasNewStyleNames && oldVars.length > 0) {
      // Extract all variables for R1 to determine column (brand) order
      const r1Vars: { brandIndex: number; var: string }[] = []
      oldVars.forEach(oldVar => {
        const match = oldVar.match(varPattern)
        if (match && match[2] === '1') {
          const brandIndex = parseInt(match[1], 10)
          r1Vars.push({ brandIndex, var: oldVar })
        }
      })
      r1Vars.sort((a, b) => a.brandIndex - b.brandIndex)
      const brandIndexToRowOrder = new Map<number, number>()
      r1Vars.forEach((item, index) => {
        brandIndexToRowOrder.set(item.brandIndex, index)
      })
      
      oldVars.forEach(oldVar => {
        const match = oldVar.match(varPattern)
        if (match) {
          const brandIndex = parseInt(match[1], 10)
          const codeNum = match[2]
          const codeStr = `R${codeNum}`
          const rowOrder = brandIndexToRowOrder.get(brandIndex) ?? brandIndex
          if (variablesByCode[codeStr]) {
            variablesByCode[codeStr].push({ var: oldVar, brandIndex, rowOrder })
          }
        }
      })
    } else {
      // Generate from question structure (columns=brands, rows=attributes)
      columns.forEach((col, colIndex) => {
        const brandIndex = typeof col.code === 'number' ? col.code : (colIndex + 1)
        rows.forEach((row, rowIndex) => {
          const code = typeof row.code === 'number' ? row.code : parseInt(String(row.code).replace(/[^0-9]/g, ''), 10)
          if (!isNaN(code)) {
            const codeStr = `R${code}`
            const varName = `${question.id}_${brandIndex}R${code}`
            if (variablesByCode[codeStr]) {
              variablesByCode[codeStr].push({ var: varName, brandIndex, rowOrder: colIndex })
            }
          }
        })
      })
    }
  })

  // Sort variables by row order (not brandIndex) for each code
  Object.keys(variablesByCode).forEach(code => {
    const vars = variablesByCode[code] as any[]
    if (vars.length > 0 && typeof vars[0] === 'object' && 'rowOrder' in vars[0]) {
      vars.sort((a, b) => a.rowOrder - b.rowOrder)
      variablesByCode[code] = vars.map(v => v.var)
    }
  })

  // Sort codes numerically
  codes.sort((a, b) => {
    const numA = parseInt(a.replace('R', ''), 10)
    const numB = parseInt(b.replace('R', ''), 10)
    return numA - numB
  })

  // Generate index variable name from first question label
  if (firstQuestion.label) {
    // Extract meaningful name from label (first few words)
    const words = firstQuestion.label.split(/\s+/).slice(0, 2)
    indexVarName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('_').replace(/[^a-zA-Z0-9_]/g, '')
    if (!indexVarName) indexVarName = 'INDEX_VAR'
  }

  return { variablesByCode, numBrands, brandNames, codes, indexVarName }
}
