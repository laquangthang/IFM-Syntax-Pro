import { ParsedQuestion, QuestionOption } from './types'
import { OldVariableMapping } from '@/lib/types'
import { hasOtherOption, getMainOptions } from './utils/mrHelpers'

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
 * Other (Khác) is detected solely via codeType === 'Other' from parser (Othr suffix in variable name).
 * No fuzzy label guessing.
 */

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

  const baseVar = oldVariables[0] || 'varXXX'
  output.renameStatements.push(`Rename Variables ${baseVar} = ${question.id}.`)
  output.varLabStatements.push(`Var lab ${question.id}"${question.id}. ${question.label}".`)

  const uniqueCompanions = [...new Set(question.saTextCompanions || [])]
  if (uniqueCompanions.length > 0) {
    if (uniqueCompanions.length === 1) {
      output.renameStatements.push(`Rename Variables ${uniqueCompanions[0]} = ${question.id}_O.`)
      output.varLabStatements.push(`Var lab ${question.id}_O"${question.id}_O. ${question.label}".`)
    } else {
      uniqueCompanions.forEach((companion, idx) => {
        const suffix = `_${idx + 1}_O`
        output.renameStatements.push(`Rename Variables ${companion} = ${question.id}${suffix}.`)
        output.varLabStatements.push(`Var lab ${question.id}${suffix}"${question.id}_${idx + 1}O. ${question.label}".`)
      })
    }
  } else {
    const otherOpt = question.options?.find(opt => opt.codeType === 'Other')
    const companion = question.textCompanions?.[baseVar] || otherOpt?.openEndedRawVariable || undefined
    if (companion) {
      output.renameStatements.push(`Rename Variables ${companion} = ${question.id}_O.`)
      output.varLabStatements.push(`Var lab ${question.id}_O"${question.id}_O. ${question.label}".`)
    }
  }

  return output
}

/**
 * Generate syntax for SA (Single Answer)
 * Alias to SA/OE generator (kept for backward compatibility)
 */
function generateSASyntax(question: ParsedQuestion, oldVariables: string[] = []): SyntaxOutput {
  return generateSAOESyntax(question, oldVariables)
}

/**
 * Generate syntax for OE (Open Ended)
 * Alias to SA/OE generator (kept for backward compatibility)
 */
function generateOESyntax(question: ParsedQuestion, oldVariables: string[] = []): SyntaxOutput {
  return generateSAOESyntax(question, oldVariables)
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
  const mainOptions = options.filter(opt => opt.codeType !== 'Other')
  const otherOption = options.find(opt => opt.codeType === 'Other')

  let varIndex = 0
  options.forEach((option) => {
    const baseVar = oldVariables[varIndex] || `varXXXO${1000 + varIndex}`
    const baseVarName = `${question.id}R${option.code}`
    const otherVarName = `${baseVarName}_O`

    output.renameStatements.push(`Rename Variables ${baseVar} = ${baseVarName}.`)
    // CRITICAL: ONLY output _O rename if textCompanions or openEndedRawVariable explicitly exists. NO fallback to oldVariables[varIndex+1].
    const companion = question.textCompanions?.[baseVar] || (option.codeType === 'Other' && option.openEndedRawVariable) || undefined
    if (companion) {
      output.renameStatements.push(`Rename Variables ${companion} = ${otherVarName}.`)
    }

    output.varLabStatements.push(`Var lab ${baseVarName}"${question.id}. ${option.label}".`)
    if (companion) {
      output.varLabStatements.push(`Var lab ${otherVarName}"${question.id}. ${option.label} (Other text)".`)
    }
    output.recodeStatements.push(`Recode ${baseVarName}(0=sysmis)(1=${option.code}) into ${baseVarName}.`)

    varIndex++
  })

  if (mainOptions.length > 0 || otherOption) {
    // CRITICAL: SPSS 'to' is positional - first and last variable in dataset order, NOT min/max code
    const firstCode = options[0].code
    const lastCode = options[options.length - 1].code
    const firstVar = `${question.id}R${firstCode}`
    const lastVar = `${question.id}R${lastCode}`
    output.valLabStatements.push(`Val lab ${firstVar} to ${lastVar}`)
    mainOptions.forEach(option => {
      output.valLabStatements.push(`${option.code}"${option.label}"`)
    })
    if (otherOption) {
      output.valLabStatements.push(`${otherOption.code}"${otherOption.label}"`)
    }
    output.valLabStatements[output.valLabStatements.length - 1] += '.'
  }

  return output
}

/**
 * Generate syntax for SA_Grid questions
 * When rawVariables exists: iterate directly (100% 1-to-1 mapping, never skip variables)
 * Otherwise: SA_Grid uses options as codes (Q5_1, Q5_2, etc.)
 */
function generateSAGridSyntax(question: ParsedQuestion, oldVariables: string[] = []): SyntaxOutput {
  const output: SyntaxOutput = {
    renameStatements: [],
    varLabStatements: [],
    recodeStatements: [],
    valLabStatements: [],
  }

  // CRITICAL: When rawVariables exists, iterate directly - never skip variables
  if (question.rawVariables && question.rawVariables.length > 0) {
    question.rawVariables.forEach((v) => {
      output.renameStatements.push(`Rename Variables ${v.rawVar} = ${v.generatedId}.`)
      const cleanLabel = (v.label || '').replace(/"/g, '""')
      output.varLabStatements.push(`Var lab ${v.generatedId}"${v.generatedId}. ${cleanLabel}".`)
    })
    return output
  }

  // SA_Grid with rows (from Case 1 merge: var200..var206 :Q18 → Q18_1..Q18_11)
  const rowItems = question.rows && question.rows.length > 0 ? question.rows : question.options
  if (!rowItems || rowItems.length === 0) return output

  let varIndex = 0
  rowItems.forEach((option) => {
    const baseVar = oldVariables[varIndex] || `varXXXO${1000 + varIndex}`
    const baseVarName = `${question.id}_${option.code}`
    const otherVarName = `${baseVarName}_O`

    output.renameStatements.push(`Rename Variables ${baseVar} = ${baseVarName}.`)
    // CRITICAL: ONLY output _O rename if textCompanions or openEndedRawVariable explicitly exists. NO fallback to oldVariables[varIndex+1].
    const companion = question.textCompanions?.[baseVar] || (option.codeType === 'Other' && option.openEndedRawVariable) || undefined
    if (companion) {
      output.renameStatements.push(`Rename Variables ${companion} = ${otherVarName}.`)
    }

    output.varLabStatements.push(`Var lab ${baseVarName}"${question.id}. ${option.label}".`)
    if (companion) {
      output.varLabStatements.push(`Var lab ${otherVarName}"${question.id}. ${option.label} (Other text)".`)
    }

    varIndex++
  })

  return output
}

/**
 * Generate syntax for MA_Grid questions
 * When rawVariables exists: iterate directly (100% 1-to-1 mapping)
 * Otherwise: MA_Grid: Variables = columns × rows (Q8_1R1, Q8_1R2, etc.)
 */
function generateMAGridSyntax(question: ParsedQuestion, oldVariables: string[] = []): SyntaxOutput {
  const output: SyntaxOutput = {
    renameStatements: [],
    varLabStatements: [],
    recodeStatements: [],
    valLabStatements: [],
  }

  if (question.rawVariables && question.rawVariables.length > 0) {
    question.rawVariables.forEach((v) => {
      output.renameStatements.push(`Rename Variables ${v.rawVar} = ${v.generatedId}.`)
      const cleanLabel = (v.label || '').replace(/"/g, '""')
      output.varLabStatements.push(`Var lab ${v.generatedId}"${v.generatedId}. ${cleanLabel}".`)
    })
    return output
  }

  // MA_Grid: Variables = columns × rows
  const columns = question.columns || []
  const rows = question.rows || []

  if (columns.length === 0 || rows.length === 0) return output

  let varIndex = 0
  columns.forEach((col) => {
    rows.forEach((row) => {
      const baseVar = oldVariables[varIndex] || `varXXXO${1000 + varIndex}`
      const baseVarName = `${question.id}_${col.code}R${row.code}`
      const otherVarName = `${baseVarName}_O`

      output.renameStatements.push(`Rename Variables ${baseVar} = ${baseVarName}.`)
      // CRITICAL: Check textCompanions for base variable - if companion exists, output _O rename immediately
      const companion = question.textCompanions?.[baseVar] || (row.codeType === 'Other' && row.openEndedRawVariable) || undefined
      if (companion) {
        output.renameStatements.push(`Rename Variables ${companion} = ${otherVarName}.`)
      }

      output.varLabStatements.push(`Var lab ${baseVarName}"${question.id}. ${col.label} - ${row.label}".`)
      if (companion) {
        output.varLabStatements.push(`Var lab ${otherVarName}"${question.id}. ${col.label} - ${row.label} (Other text)".`)
      }
      output.recodeStatements.push(`Recode ${baseVarName}(0=sysmis)(1=${row.code}) into ${baseVarName}.`)

      varIndex++
    })
  })

  // Value labels per column (same row labels for each column)
  columns.forEach(col => {
    if (rows.length > 0) {
      const firstVar = `${question.id}_${col.code}R${rows[0].code}`
      const lastVar = `${question.id}_${col.code}R${rows[rows.length - 1].code}`
      output.valLabStatements.push(`Val lab ${firstVar} to ${lastVar}`)
      rows.forEach(row => {
        output.valLabStatements.push(`${row.code}"${row.label}"`)
      })
      output.valLabStatements[output.valLabStatements.length - 1] += '.'
    }
  })

  return output
}

/**
 * Generate syntax for Numeric ([SUM]) questions
 * Output: Q5_1, Q5_2, ... with Var lab from option labels
 */
function generateNumericSyntax(question: ParsedQuestion, oldVariables: string[] = []): SyntaxOutput {
  const output: SyntaxOutput = {
    renameStatements: [],
    varLabStatements: [],
    recodeStatements: [],
    valLabStatements: [],
  }
  const options = question.options || question.rows || []
  if (options.length === 0) return output
  options.forEach((opt, idx) => {
    const baseVar = oldVariables[idx] || `varXXXO${1000 + idx}`
    const newName = `${question.id}_${idx + 1}`
    const subLabel = typeof opt === 'object' && opt !== null && 'label' in opt ? (opt as QuestionOption).label : String(opt)
    output.renameStatements.push(`Rename Variables ${baseVar} = ${newName}.`)
    output.varLabStatements.push(`Var lab ${newName}"${question.id}. ${subLabel}".`)
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
  const mainOptions = getMainOptions(question.options)
  
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
      return generateSAGridSyntax(question, oldVariables)

    case 'Numeric':
      return generateNumericSyntax(question, oldVariables)
    
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
 * Compare two question IDs for sorting
 * Handles: Q1, Q2, Q8, Q8_1, Q8_1a, Q8_1b, Q8_2, Q9, H1, H2...
 */
function compareQuestionIds(a: string, b: string): number {
  // Parse question ID into parts: prefix, main number, sub-parts
  const parseQId = (id: string) => {
    // Match: (prefix)(number)(_sub1)(_sub2)?
    // Examples: Q1, Q8, Q8_1, Q8_1a, Q8_1_2, H1
    const match = id.match(/^([A-Za-z]+)(\d+)(?:_(\d+[a-z]?))?(?:_(\d+[a-z]?))?/i)
    if (!match) return { prefix: id, num: 0, sub1: '', sub2: '' }
    
    return {
      prefix: match[1].toUpperCase(),
      num: parseInt(match[2]) || 0,
      sub1: match[3] || '',
      sub2: match[4] || '',
    }
  }
  
  const aParts = parseQId(a)
  const bParts = parseQId(b)
  
  // Sort by prefix first (A-Z)
  if (aParts.prefix !== bParts.prefix) {
    return aParts.prefix.localeCompare(bParts.prefix)
  }
  
  // Then by main number
  if (aParts.num !== bParts.num) {
    return aParts.num - bParts.num
  }
  
  // Then by sub1 (if both have sub1)
  if (aParts.sub1 || bParts.sub1) {
    // No sub1 comes before having sub1
    if (!aParts.sub1) return -1
    if (!bParts.sub1) return 1
    
    // Compare sub1 numerically first, then alphabetically
    const aSub1Num = parseInt(aParts.sub1) || 0
    const bSub1Num = parseInt(bParts.sub1) || 0
    if (aSub1Num !== bSub1Num) return aSub1Num - bSub1Num
    
    // Same number, compare full string (for 1a, 1b)
    if (aParts.sub1 !== bParts.sub1) {
      return aParts.sub1.localeCompare(bParts.sub1)
    }
  }
  
  // Then by sub2
  if (aParts.sub2 || bParts.sub2) {
    if (!aParts.sub2) return -1
    if (!bParts.sub2) return 1
    
    const aSub2Num = parseInt(aParts.sub2) || 0
    const bSub2Num = parseInt(bParts.sub2) || 0
    if (aSub2Num !== bSub2Num) return aSub2Num - bSub2Num
    
    return aParts.sub2.localeCompare(bParts.sub2)
  }
  
  return 0
}

/**
 * Sort questions by ID with proper handling of sub-questions
 * Q1, Q2, Q8, Q8_1, Q8_1a, Q8_1b, Q8_2, Q9, H1, H2...
 */
export function sortQuestionsByIdWithPrefix(questions: ParsedQuestion[]): ParsedQuestion[] {
  return [...questions].sort((a, b) => compareQuestionIds(a.id, b.id))
}

/**
 * Generate complete SPSS syntax for all questions
 * Questions are automatically sorted by ID with prefix priority (Q1, Q2... H1, H2...)
 */
export function generateCompleteSyntax(
  questions: ParsedQuestion[],
  oldVariableMapping: OldVariableMapping = {} // Mapping of question.id to array of old variable names
): string {
  const lines: string[] = []
  
  lines.push('* Encoding: UTF-8.')
  lines.push('')
  lines.push('* Clean Label Syntax - Auto Generated')
  lines.push('* Questions sorted by ID (Q1, Q2... H1, H2...)')
  lines.push('')

  // Sort questions by ID with prefix priority
  const sortedQuestions = sortQuestionsByIdWithPrefix(questions)

  sortedQuestions.forEach((question) => {
    // Comment with question ID
    lines.push(`*${question.id}.`)

    // Get old variables for this question (empty array if not provided)
    const oldVariables = oldVariableMapping[question.id] || []

    // Generate syntax for this question
    const syntax = generateQuestionSyntax(question, oldVariables)

    // Add rename statements
    if (syntax.renameStatements.length > 0) {
      syntax.renameStatements.forEach(stmt => {
        lines.push(stmt)
      })
    }

    // Add variable label statements
    if (syntax.varLabStatements.length > 0) {
      syntax.varLabStatements.forEach(stmt => {
        lines.push(stmt)
      })
    }

    // Add recode statements
    if (syntax.recodeStatements.length > 0) {
      syntax.recodeStatements.forEach(stmt => {
        lines.push(stmt)
      })
    }

    // Add value label statements
    if (syntax.valLabStatements.length > 0) {
      syntax.valLabStatements.forEach(stmt => {
        lines.push(stmt)
      })
    }
    
    // Empty line between questions
    lines.push('')
  })

  return lines.join('\n')
}

