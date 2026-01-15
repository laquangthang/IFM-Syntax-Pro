import { ParsedQuestion } from './geminiParser'
import { OldVariableMapping } from '@/store/surveyStore'

/**
 * Get all child variables for a question
 * - SA, MA, OE, Numeric: Only 1 variable (Q1)
 * - SA_Grid, MA_Grid, OE_Grid, Rank_Fixed, Rank_Upto: Multiple variables (Q1_1, Q1_2, ...)
 */
export function getChildVariables(
  question: ParsedQuestion,
  oldVariableMapping: OldVariableMapping
): { varNames: string[], varLabels: string[] } {
  const varNames: string[] = []
  const varLabels: string[] = []
  
  // Single variable questions: SA, MA, OE, Numeric
  // These only have 1 variable regardless of number of codes
  const singleVariableTypes = ['SA', 'MA', 'OE', 'Numeric']
  
  if (singleVariableTypes.includes(question.type)) {
    // Just return the question ID as the variable name
    varNames.push(question.id)
    varLabels.push(question.label)
    return { varNames, varLabels }
  }
  
  // Grid and Rank questions: Multiple variables (Q1_1, Q1_2, ...)
  // Check if question has oldVariableMapping
  const oldVars = oldVariableMapping[question.id]
  
  if (oldVars && oldVars.length > 0) {
    // Use oldVariableMapping to determine number of variables
    // Format: Q24_1, Q24_2, ..., Q24_99 for Grid/Rank questions
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
      question.rows.forEach((row, index) => {
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
  } else if (question.rows && question.rows.length > 0) {
    // Grid questions: generate from rows
    question.rows.forEach((row, index) => {
      const code = index + 1
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
  variablesByCode: { [code: string]: string[] } // e.g., { 'R1': ['Q8_1R1', 'Q8_2R1', ...], 'R2': [...] }
  numBrands: number
  brandNames: string[]
  codes: string[] // e.g., ['R1', 'R2', ..., 'R99']
  indexVarName: string // e.g., 'Vat_Lieu', 'Khu_Vuc'
} {
  const variablesByCode: { [code: string]: string[] } = {}
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
  const firstQuestion = gridQuestions[0]
  
  // Get rows (brands) from first question
  const rows = firstQuestion.rows || []
  numBrands = rows.length
  
  // Get brand names from rows
  rows.forEach(row => {
    brandNames.push(row.label)
  })

  // Get columns (codes) from first question
  const columns = firstQuestion.columns || []
  
  // Generate codes (R1, R2, ..., R99)
  columns.forEach(col => {
    const code = typeof col.code === 'number' ? col.code : parseInt(String(col.code).replace('_O', ''), 10)
    if (!isNaN(code)) {
      const codeStr = `R${code}`
      codes.push(codeStr)
      variablesByCode[codeStr] = []
    }
  })

  // Create a mapping from row code to row order for sorting
  const rowOrderMap = new Map<string | number, number>()
  rows.forEach((row, index) => {
    const rowCode = row.code
    rowOrderMap.set(rowCode, index)
  })

  // Generate variables for each question
  gridQuestions.forEach(question => {
    const oldVars = oldVariableMapping[question.id] || []
    
    // If we have oldVariableMapping, use it to extract pattern
    if (oldVars.length > 0) {
      // Create a mapping from brandIndex to row order based on first code (R1)
      // Extract all variables for R1 to determine row order
      const varPattern = new RegExp(`${question.id}_(\\d+)R(\\d+)`, 'i')
      const r1Vars: { brandIndex: number; var: string }[] = []
      
      oldVars.forEach(oldVar => {
        const match = oldVar.match(varPattern)
        if (match && match[2] === '1') { // Only R1 to determine order
          const brandIndex = parseInt(match[1], 10)
          r1Vars.push({ brandIndex, var: oldVar })
        }
      })
      
      // Create brandIndex to rowOrder mapping based on R1 order
      const brandIndexToRowOrder = new Map<number, number>()
      r1Vars.forEach((item, index) => {
        brandIndexToRowOrder.set(item.brandIndex, index)
      })
      
      // Now process all variables
      oldVars.forEach(oldVar => {
        const match = oldVar.match(varPattern)
        if (match) {
          const brandIndex = parseInt(match[1], 10)
          const codeNum = match[2]
          const codeStr = `R${codeNum}`
          
          if (variablesByCode[codeStr]) {
            // Get row order from brandIndexToRowOrder map
            const rowOrder = brandIndexToRowOrder.get(brandIndex) ?? brandIndex
            
            variablesByCode[codeStr].push({ var: oldVar, brandIndex, rowOrder })
          }
        }
      })
    } else {
      // Generate from rows and columns
      rows.forEach((row, rowIndex) => {
        const brandIndex = typeof row.code === 'number' ? row.code : (rowIndex + 1)
        columns.forEach(col => {
          const code = typeof col.code === 'number' ? col.code : parseInt(String(col.code).replace('_O', ''), 10)
          if (!isNaN(code)) {
            const codeStr = `R${code}`
            const varName = `${question.id}_${brandIndex}R${code}`
            if (variablesByCode[codeStr]) {
              variablesByCode[codeStr].push({ var: varName, brandIndex, rowOrder: rowIndex })
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
