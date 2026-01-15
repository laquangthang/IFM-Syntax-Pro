import { ParsedQuestion, QuestionOption } from './geminiParser'
import { OldVariableMapping } from '@/store/surveyStore'

/**
 * Generate SPSS syntax for clean label based on question type
 * Old variable names should be provided via oldVariableMapping
 */

interface SyntaxOutput {
  renameStatements: string[]
  varLabStatements: string[]
  recodeStatements: string[]
  valLabStatements: string[]
}

/**
 * Check if option has "(ghi rõ)" or "Other" pattern
 */
function hasOtherSpecify(label: string): boolean {
  const lower = label.toLowerCase()
  // Only match if it has explicit "(ghi rõ)" pattern, not just the word "khác" or "other" alone
  return lower.includes('(ghi rõ)') || lower.includes('(vui lòng ghi rõ)') || lower.includes('(specify)') || 
         (lower.includes('other') && (lower.includes('(specify)') || lower.includes('ghi rõ'))) ||
         (lower.includes('khác') && (lower.includes('(ghi rõ)') || lower.includes('ghi rõ')))
}

/**
 * Get code suffix for variable name (handles both number and string codes)
 */
function getCodeSuffix(code: string | number): string {
  if (typeof code === 'string' && code.includes('_')) {
    return code // Already has format like "99_O"
  }
  return String(code)
}

/**
 * Generate syntax for SA/OE questions
 */
function generateSAOESyntax(question: ParsedQuestion, oldVariables: string[] = []): SyntaxOutput {
  const output: SyntaxOutput = {
    renameStatements: [],
    varLabStatements: [],
    recodeStatements: [],
    valLabStatements: [],
  }

  // SA/OE: 1 variable (or 2 if has "Other (ghi rõ)")
  const hasOther = question.options?.some(opt => hasOtherSpecify(opt.label)) || false

  // Main variable
  const oldVar1 = oldVariables[0] || 'varXXX'
  output.renameStatements.push(`Rename Variables ${oldVar1} = ${question.id}.`)
  output.varLabStatements.push(`Var lab ${question.id}"${question.id}. ${question.label}".`)

  // If has Other, add second variable with _O suffix
  if (hasOther) {
    const otherOption = question.options?.find(opt => hasOtherSpecify(opt.label))
    if (otherOption) {
      const oldVar2 = oldVariables[1] || `${oldVar1}Othr`
      output.renameStatements.push(`Rename Variables ${oldVar2} = ${question.id}_O.`)
      output.varLabStatements.push(`Var lab ${question.id}_O"${question.id}_O. ${question.label}".`)
    }
  }

  return output
}

/**
 * Generate syntax for MA questions
 */
function generateMASyntax(question: ParsedQuestion, oldVariables: string[] = []): SyntaxOutput {
  const output: SyntaxOutput = {
    renameStatements: [],
    varLabStatements: [],
    recodeStatements: [],
    valLabStatements: [],
  }

  if (!question.options || question.options.length === 0) return output

  const options = question.options
  const hasOther = options.some(opt => hasOtherSpecify(opt.label))

  // MA: One variable per code (Q1R1, Q1R2, etc.)
  // Exclude _O options (they are handled separately)
  const mainOptions = options.filter(opt => !String(opt.code).endsWith('_O'))
  
  mainOptions.forEach((option, index) => {
    const newVarName = `${question.id}R${option.code}`
    const oldVar = oldVariables[index] || `varXXXO${1000 + index}`
    output.renameStatements.push(`Rename Variables ${oldVar} = ${newVarName}.`)
    output.varLabStatements.push(`Var lab ${newVarName}"${question.id}. ${option.label}".`)
    
    // Recode: (0=sysmis)(1=code) into newVarName
    output.recodeStatements.push(`Recode ${newVarName}(0=sysmis)(1=${option.code}) into ${newVarName}.`)
    
    // If this option has "Khác (ghi rõ)", add _O variable right after this code
    // Format: {oldVar}Othr → {questionId}R{code}_O
    // Only VAR LAB, no VAL LAB and RECODE
    if (hasOtherSpecify(option.label)) {
      const otherVarName = `${question.id}R${option.code}_O`
      const oldVarOther = `${oldVar}Othr`
      output.renameStatements.push(`Rename Variables ${oldVarOther} = ${otherVarName}.`)
      output.varLabStatements.push(`Var lab ${otherVarName}"${question.id}. ${option.label}".`)
      // Note: No RECODE and VAL LAB for Other variable
    }
  })

  // Value labels for all codes (Q1R1 to Q1R99)
  if (mainOptions.length > 0) {
    const firstVar = `${question.id}R${mainOptions[0].code}`
    const lastVar = `${question.id}R${mainOptions[mainOptions.length - 1].code}`
    output.valLabStatements.push(`Val lab ${firstVar} to ${lastVar}`)
    mainOptions.forEach(option => {
      output.valLabStatements.push(`${option.code}"${option.label}"`)
    })
    output.valLabStatements[output.valLabStatements.length - 1] += '.'
  }

  return output
}

/**
 * Generate syntax for SA_Grid questions
 * SA_Grid uses options as codes (Q5_1, Q5_2, etc.)
 */
function generateSAGridSyntax(question: ParsedQuestion, oldVariables: string[] = []): SyntaxOutput {
  const output: SyntaxOutput = {
    renameStatements: [],
    varLabStatements: [],
    recodeStatements: [],
    valLabStatements: [],
  }

  if (!question.options || question.options.length === 0) return output

  // SA_Grid: One variable per code (Q5_1, Q5_2, etc.)
  // Exclude _O options
  const mainOptions = question.options.filter(opt => !String(opt.code).endsWith('_O'))
  
  mainOptions.forEach((option, index) => {
    const newVarName = `${question.id}_${option.code}`
    const oldVar = oldVariables[index] || `varXXXO${1000 + index}`
    output.renameStatements.push(`Rename Variables ${oldVar} = ${newVarName}.`)
    output.varLabStatements.push(`Var lab ${newVarName}"${question.id}. ${option.label}".`)
    
    // If this option has "Khác (ghi rõ)", add _O variable right after this code
    // Format: {oldVar}Othr → {questionId}_{code}_O
    // Only VAR LAB, no VAL LAB and RECODE
    if (hasOtherSpecify(option.label)) {
      const otherVarName = `${question.id}_${option.code}_O`
      const oldVarOther = `${oldVar}Othr`
      output.renameStatements.push(`Rename Variables ${oldVarOther} = ${otherVarName}.`)
      output.varLabStatements.push(`Var lab ${otherVarName}"${question.id}. ${option.label}".`)
      // Note: No RECODE and VAL LAB for Other variable
    }
  })

  return output
}

/**
 * Generate syntax for MA_Grid questions
 * MA_Grid: Variables = columns × rows (Q8_1R1, Q8_1R2, Q8_2R1, etc.)
 * Format: Q{id}_{columnCode}R{rowCode}
 */
function generateMAGridSyntax(question: ParsedQuestion, oldVariables: string[] = []): SyntaxOutput {
  const output: SyntaxOutput = {
    renameStatements: [],
    varLabStatements: [],
    recodeStatements: [],
    valLabStatements: [],
  }

  // MA_Grid: Variables = columns × rows
  const columns = question.columns || []
  const rows = question.rows || []

  if (columns.length === 0 || rows.length === 0) return output

  // Filter out _O rows
  const mainRows = rows.filter(r => !String(r.code).endsWith('_O'))
  const hasOtherRow = mainRows.some(r => hasOtherSpecify(r.label))
  const otherRow = mainRows.find(r => hasOtherSpecify(r.label))

  let varIndex = 0
  columns.forEach((col) => {
    mainRows.forEach((row) => {
      const newVarName = `${question.id}_${col.code}R${row.code}`
      const oldVar = oldVariables[varIndex] || `varXXXO${1000 + varIndex}`
      output.renameStatements.push(`Rename Variables ${oldVar} = ${newVarName}.`)
      output.varLabStatements.push(`Var lab ${newVarName}"${question.id}. ${col.label} - ${row.label}".`)
      
      // Recode: (0=sysmis)(1=row.code) into newVarName
      output.recodeStatements.push(`Recode ${newVarName}(0=sysmis)(1=${row.code}) into ${newVarName}.`)
      
      // If this row has "Khác (ghi rõ)", add _O variable right after this row
      // Format: {oldVar}Othr → {questionId}_{colCode}R{rowCode}_O
      // Only VAR LAB, no VAL LAB and RECODE
      if (hasOtherSpecify(row.label)) {
        const otherVarName = `${question.id}_${col.code}R${row.code}_O`
        const oldVarOther = `${oldVar}Othr`
        output.renameStatements.push(`Rename Variables ${oldVarOther} = ${otherVarName}.`)
        output.varLabStatements.push(`Var lab ${otherVarName}"${question.id}. ${col.label} - ${row.label}".`)
        // Note: No RECODE and VAL LAB for Other variable
        varIndex++ // Increment index for Other variable
      }
      
      varIndex++
    })
  })

  // Value labels per column (same row labels for each column)
  // Format: Val lab Q8_1R1 to Q8_1R99 1"Row label 1" 2"Row label 2" ...
  columns.forEach(col => {
    if (mainRows.length > 0) {
      const firstVar = `${question.id}_${col.code}R${mainRows[0].code}`
      const lastVar = `${question.id}_${col.code}R${mainRows[mainRows.length - 1].code}`
      output.valLabStatements.push(`Val lab ${firstVar} to ${lastVar}`)
      mainRows.forEach(row => {
        output.valLabStatements.push(`${row.code}"${row.label}"`)
      })
      output.valLabStatements[output.valLabStatements.length - 1] += '.'
    }
  })

  return output
}

/**
 * Generate syntax for Rank questions
 * Rank: Similar to SA_Grid format (Q15_1, Q15_2, etc.), but with value labels "Rank 1", "Rank 2", etc.
 */
function generateRankSyntax(question: ParsedQuestion, oldVariables: string[] = []): SyntaxOutput {
  const output: SyntaxOutput = {
    renameStatements: [],
    varLabStatements: [],
    recodeStatements: [],
    valLabStatements: [],
  }

  if (!question.options || question.options.length === 0) return output

  // Rank: Format like SA_Grid (Q15_1, Q15_2, etc.), with value labels "Rank 1", "Rank 2", etc.
  const mainOptions = question.options.filter(opt => !String(opt.code).endsWith('_O'))
  
  mainOptions.forEach((option, index) => {
    const newVarName = `${question.id}_${option.code}`
    const oldVar = oldVariables[index] || `varXXXO${1000 + index}`
    output.renameStatements.push(`Rename Variables ${oldVar} = ${newVarName}.`)
    output.varLabStatements.push(`Var lab ${newVarName}"${question.id}. ${option.label}".`)
  })

  // Value labels: "Rank 1", "Rank 2", ... 
  // If Rank all: n = số code
  // If Rank Fixed/Upto: n = limit
  const maxRank = question.limit || mainOptions.length

  if (mainOptions.length > 0) {
    const firstVar = `${question.id}_${mainOptions[0].code}`
    const lastVar = `${question.id}_${mainOptions[mainOptions.length - 1].code}`
    output.valLabStatements.push(`Val lab ${firstVar} to ${lastVar}`)
    for (let i = 1; i <= maxRank; i++) {
      output.valLabStatements.push(`${i}"Rank ${i}"`)
    }
    output.valLabStatements[output.valLabStatements.length - 1] += '.'
  }

  return output
}

/**
 * Generate SPSS syntax for a single question
 * @param question - The question to generate syntax for
 * @param oldVariables - Array of old variable names in order (one per output variable)
 */
export function generateQuestionSyntax(
  question: ParsedQuestion,
  oldVariables: string[] = []
): SyntaxOutput {
  switch (question.type) {
    case 'SA':
      return generateSASyntax(question, oldVariables)
    
    case 'OE':
      return generateOESyntax(question, oldVariables)
    
    case 'MA':
      return generateMASyntax(question, oldVariables)
    
    case 'SA_Grid':
      return generateSAGridSyntax(question, oldVariables)
    
    case 'MA_Grid':
      return generateMAGridSyntax(question, oldVariables)
    
    case 'Rank_Fixed':
    case 'Rank_Upto':
      return generateRankSyntax(question, oldVariables)
    
    case 'OE_Grid':
      // OE_Grid: Only rows, similar to SA_Grid but for open-ended
      return generateSAGridSyntax(question, oldVariables)
    
    default:
      return {
        renameStatements: [],
        varLabStatements: [],
        recodeStatements: [],
        valLabStatements: [],
      }
  }
}

/**
 * Generate complete SPSS syntax for all questions
 */
export function generateCompleteSyntax(
  questions: ParsedQuestion[],
  oldVariableMapping: OldVariableMapping = {} // Mapping of question.id to array of old variable names
): string {
  const lines: string[] = []
  
  lines.push('* Encoding: UTF-8.')
  lines.push('')
  lines.push('* Clean Label Syntax - Auto Generated')
  lines.push('')

  questions.forEach((question) => {
    // Comment with question ID
    lines.push(`*${question.id}.`)
    lines.push('')

    // Get old variables for this question (empty array if not provided)
    const oldVariables = oldVariableMapping[question.id] || []

    // Generate syntax for this question
    const syntax = generateQuestionSyntax(question, oldVariables)

    // Add rename statements
    if (syntax.renameStatements.length > 0) {
      syntax.renameStatements.forEach(stmt => {
        lines.push(stmt)
      })
      lines.push('')
    }

    // Add variable label statements
    if (syntax.varLabStatements.length > 0) {
      syntax.varLabStatements.forEach(stmt => {
        lines.push(stmt)
      })
      lines.push('')
    }

    // Add recode statements
    if (syntax.recodeStatements.length > 0) {
      syntax.recodeStatements.forEach(stmt => {
        lines.push(stmt)
      })
      lines.push('')
    }

    // Add value label statements
    if (syntax.valLabStatements.length > 0) {
      syntax.valLabStatements.forEach(stmt => {
        lines.push(stmt)
      })
      lines.push('')
      lines.push('')
    }
  })

  return lines.join('\n')
}

