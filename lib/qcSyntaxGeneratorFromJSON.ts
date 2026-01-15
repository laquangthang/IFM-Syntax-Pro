/**
 * QC Logic Syntax Generator from JSON Questions
 * Generates SPSS COUNT and CHECK statements based on ParsedQuestion JSON
 * Format follows QCLogicExample.txt
 */

import { ParsedQuestion } from './geminiParser'

/**
 * Get variable name for a question based on question type and code
 */
function getVariableName(questionId: string, code: string | number, questionType: ParsedQuestion['type']): string {
  if (questionType === 'MA') {
    return `${questionId}R${code}`
  } else if (questionType === 'SA_Grid' || questionType === 'OE_Grid') {
    return `${questionId}_${code}`
  } else if (questionType === 'MA_Grid') {
    // MA_Grid format: Q8_1R1 (row_colRcol)
    if (typeof code === 'string' && code.includes('_')) {
      return `${questionId}_${code}`
    }
    return `${questionId}_${code}`
  } else if (questionType === 'Rank_Fixed' || questionType === 'Rank_Upto') {
    return `${questionId}_${code}`
  }
  
  return questionId
}

/**
 * Extract codes from condition string
 */
function extractCodesFromCondition(condition: string, questionId: string): number[] {
  const codes: number[] = []
  if (!condition) return codes
  
  // Pattern 1: Q5R15 = 15 OR Q5R16 = 16 (MA format)
  const qrPattern = new RegExp(`${questionId}R(\\d+)\\s*=\\s*\\1`, 'gi')
  let match
  while ((match = qrPattern.exec(condition)) !== null) {
    codes.push(parseInt(match[1], 10))
  }
  
  // Pattern 2: Q3.code == 1 OR Q3.code == 2 (old format)
  const codePattern = new RegExp(`${questionId}\\.code\\s*==\\s*(\\d+)`, 'gi')
  while ((match = codePattern.exec(condition)) !== null) {
    codes.push(parseInt(match[1], 10))
  }
  
  // Pattern 3: Q3 = 1 OR Q3 = 2 (new SA format)
  const saPattern = new RegExp(`${questionId}\\s*=\\s*(\\d+)`, 'gi')
  while ((match = saPattern.exec(condition)) !== null) {
    codes.push(parseInt(match[1], 10))
  }
  
  return [...new Set(codes)].sort((a, b) => a - b)
}

/**
 * Convert terminate condition to SPSS syntax
 * Exported for use in EditQuestionModal to display converted format
 */
export function convertTerminateCondition(condition: string, questionId: string, questionType: ParsedQuestion['type']): string {
  if (!condition) return ''
  
  // Remove IF prefix and clean up quotes/whitespace
  let clean = condition.replace(/^IF\s+/i, '').trim()
  // Remove surrounding quotes if present (handles cases like "... AND MIS(Q7R99C1)"")
  clean = clean.replace(/^["']|["']$/g, '').trim()
  
  // Detect MA_Grid pattern: Q7R{rowCode}C{columnCode} format
  // This pattern indicates a Matrix MA question, regardless of questionType
  const hasGridPattern = new RegExp(`${questionId}R\\d+C\\d+`, 'i').test(clean)
  const isMA_Grid = questionType === 'MA_Grid' || hasGridPattern
  
  // Handle MA_Grid: Convert Q7R1C1, Q7R2C1 format to Q7_1R1, Q7_1R2 format
  if (isMA_Grid) {
    // Pattern 1: MIS(Q7R{rowCode}C{columnCode}) - missing condition
    // Convert to: MIS(Q7_{columnCode}R{rowCode})
    // Example: MIS(Q7R1C1) → MIS(Q7_1R1)
    // Handle both with and without spaces: MIS(Q7R1C1) or MIS( Q7R1C1 )
    const misPattern = new RegExp(`MIS\\s*\\(\\s*${questionId}R(\\d+)C(\\d+)\\s*\\)`, 'gi')
    clean = clean.replace(misPattern, (match, rowCode, colCode) => {
      return `MIS(${questionId}_${colCode}R${rowCode})`
    })
    
    // Pattern 2: Q7R{rowCode}C{columnCode} = {anyValue} - selected condition
    // Convert to: Q7_{columnCode}R{rowCode} = {rowCode}
    // Value must be rowCode (not columnCode) because we check if row is selected
    // Example: Q7R1C1 = 1 → Q7_1R1 = 1
    const gridPattern = new RegExp(`${questionId}R(\\d+)C(\\d+)\\s*=\\s*\\d+`, 'gi')
    clean = clean.replace(gridPattern, (match, rowCode, colCode) => {
      // Always use rowCode as the value (not columnCode)
      return `${questionId}_${colCode}R${rowCode} = ${rowCode}`
    })
    
    // Convert OR/AND to lowercase (SPSS syntax uses lowercase)
    clean = clean.replace(/\bOR\b/g, 'or')
    clean = clean.replace(/\bAND\b/g, 'and')
    
    // Remove outer parentheses if present (but keep parentheses around MIS functions)
    // Only remove if the entire condition is wrapped in parentheses
    clean = clean.replace(/^\(([^)]+(?:\([^)]*\)[^)]*)*)\)$/g, '$1').trim()
    
    return clean
  }
  
  // Handle NOT conditions for MA
  const notMatch = clean.match(/^NOT\s*\((.*)\)$/i)
  if (notMatch && questionType === 'MA') {
    const inner = notMatch[1].trim()
    const codes = extractCodesFromCondition(inner, questionId)
    if (codes.length > 0) {
      // Format: Q5R15 = 15 or Q5R16 = 16
      const parts = codes.map(code => `${questionId}R${code} = ${code}`)
      return parts.join(' or ')
    }
  }
  
  // Handle normal conditions
  if (questionType === 'MA') {
    // Convert Q5.code == 15 to Q5R15 = 15
    clean = clean.replace(new RegExp(`${questionId}\\.code\\s*==\\s*(\\d+)`, 'gi'), (match, code) => {
      return `${questionId}R${code} = ${code}`
    })
    clean = clean.replace(/==/g, '=')
    clean = clean.replace(/\bOR\b/g, 'or') // Convert OR to or
  } else {
    // For SA: Format should be "Q3 = 1 or Q3 = 2" (no .code, no parentheses, lowercase or)
    // Handle both formats: "Q3.code == 1" (old) and "Q3 = 1" (new)
    clean = clean.replace(/\.code\s*==/g, '')
    clean = clean.replace(/==/g, '=')
    clean = clean.replace(/\bOR\b/g, 'or') // Convert OR to or
    // Remove parentheses if present
    clean = clean.replace(/^\(|\)$/g, '').trim()
  }
  
  return clean
}

/**
 * Generate COUNT statements for MA and Ranking questions
 */
function generateCountStatements(questions: ParsedQuestion[]): string[] {
  const counts: string[] = []
  
  questions.forEach(question => {
    if (question.type === 'MA' && question.options && question.options.length > 0) {
      // Filter out _O options and get numeric codes
      const mainOptions = question.options.filter(opt => {
        const codeStr = String(opt.code)
        return !codeStr.endsWith('_O') && !isNaN(Number(codeStr))
      })
      
      if (mainOptions.length > 0) {
        const codes = mainOptions
          .map(opt => Number(opt.code))
          .filter(code => !isNaN(code))
          .sort((a, b) => a - b)
        
        if (codes.length > 0) {
          const firstCode = codes[0]
          const lastCode = codes[codes.length - 1]
          const firstVar = getVariableName(question.id, firstCode, question.type)
          const lastVar = getVariableName(question.id, lastCode, question.type)
          
          counts.push(`count count_${question.id} = ${firstVar} to ${lastVar} (1 thru ${lastCode}).`)
        }
      }
    } else if (question.type === 'Rank_Fixed' && question.options && question.limit) {
      // Ranking questions
      const codes = question.options
        .map(opt => Number(opt.code))
        .filter(code => !isNaN(code))
        .sort((a, b) => a - b)
      
      if (codes.length > 0) {
        const firstCode = codes[0]
        const lastCode = codes[codes.length - 1]
        const firstVar = getVariableName(question.id, firstCode, question.type)
        const lastVar = getVariableName(question.id, lastCode, question.type)
        
        // For ranking, generate count for each rank position
        for (let rank = 1; rank <= question.limit; rank++) {
          counts.push(`count count_${question.id}_rank${rank} = ${firstVar} to ${lastVar} (${rank}).`)
        }
      }
    }
  })
  
  return counts
}

/**
 * Determine if a question should be asked (user = 1) or not (user = 0)
 * user = 1: Ask All OR ask_if_condition is met
 * user = 0: Not Ask All AND ask_if_condition is not met
 */
function shouldAskQuestion(question: ParsedQuestion): { user: number; condition?: string } {
  // If Ask All, always user = 1
  if (question.logic?.type === 'Ask All') {
    return { user: 1 }
  }
  
  // If has ask_if_condition, user = 1 when condition is met
  if (question.logic?.ask_if_condition && question.logic?.piping_source) {
    // Extract condition from ask_if_condition
    const condition = question.logic.ask_if_condition.replace(/^IF\s+/i, '').trim()
    return { user: 1, condition }
  }
  
  // Default: user = 0 (should not be asked)
  return { user: 0 }
}

/**
 * Generate CHECK statements from questions
 */
function generateCheckStatements(questions: ParsedQuestion[]): string[] {
  const checks: string[] = []
  const questionMap = new Map<string, ParsedQuestion>()
  questions.forEach(q => questionMap.set(q.id, q))
  
  questions.forEach(question => {
    const questionChecks: string[] = []
    const shouldAsk = shouldAskQuestion(question)
    
    // User variable check (for Ask All questions)
    if (question.logic?.type === 'Ask All') {
      questionChecks.push(`if user = 0 check_user = 1.`)
    }
    
    // Missing checks based on question type
    if (shouldAsk.user === 1) {
      if (question.type === 'SA') {
        questionChecks.push(`if user = 1 and mis(${question.id}) check_mis_${question.id} = 1.`)
      } else if (question.type === 'MA') {
        questionChecks.push(`if user = 1 and count_${question.id} = 0 check_mis_${question.id} = 1.`)
      } else if (question.type === 'OE') {
        questionChecks.push(`if (user = 1 and (mis(${question.id}) or ${question.id} = "" )) check_mis_${question.id} = 1.`)
      }
    } else {
      // If should not be asked (user = 0), check that it's not answered
      if (question.type === 'SA') {
        questionChecks.push(`if user = 0 and not mis(${question.id}) check_${question.id} = 1.`)
      } else if (question.type === 'MA') {
        questionChecks.push(`if user = 0 and count_${question.id} = 0 check_mis_${question.id} = 1.`)
      }
    }
    
    // Ask IF condition checks
    if (question.logic?.ask_if_condition && question.logic?.piping_source) {
      const sourceQuestion = questionMap.get(question.logic.piping_source)
      if (sourceQuestion) {
        // Extract condition for user variable
        const condition = question.logic.ask_if_condition.replace(/^IF\s+/i, '').trim()
        
        if (question.type === 'SA') {
          // Check specific codes based on ask_if_condition
          const codes = extractCodesFromCondition(condition, sourceQuestion.id)
          codes.forEach(code => {
            if (sourceQuestion.type === 'MA') {
              questionChecks.push(`if user = 0 and ${question.id} = ${code} check_${question.id}_code${code} = 1.`)
            }
          })
          questionChecks.push(`if user = 1 and mis(${question.id}) check_mis_${question.id} = 1.`)
        } else if (question.type === 'MA') {
          // For MA with ask_if, check count
          questionChecks.push(`if user = 1 and count_${question.id} = 0 check_mis_${question.id} = 1.`)
        }
      }
    }
    
    // Terminate condition checks
    if (question.logic?.terminate_if) {
      const condition = convertTerminateCondition(question.logic.terminate_if, question.id, question.type)
      if (condition) {
        questionChecks.push(`if ${condition} check_${question.id}_terminate = 1.`)
      }
    }
    
    // Piping checks (for questions that pipe from other questions)
    if (question.logic?.piping_source && question.logic.type === 'Piping') {
      const sourceQuestion = questionMap.get(question.logic.piping_source)
      if (sourceQuestion && sourceQuestion.type === 'MA' && question.type === 'MA') {
        // Check that if Q11 has a code selected, Q10 must have the same code
        // Example: if Q11R1 = 1 and mis(Q10R1) check_Q11_Q10_code1 = 1.
        if (sourceQuestion.options && question.options) {
          sourceQuestion.options.forEach(sourceOpt => {
            const sourceCode = Number(sourceOpt.code)
            if (!isNaN(sourceCode) && !String(sourceOpt.code).endsWith('_O')) {
              const sourceVar = getVariableName(sourceQuestion.id, sourceCode, sourceQuestion.type)
              const targetVar = getVariableName(question.id, sourceCode, question.type)
              questionChecks.push(`if ${targetVar} = ${sourceCode} and mis(${sourceVar}) check_${question.id}_${sourceQuestion.id}_code${sourceCode} = 1.`)
            }
          })
        }
      } else if (sourceQuestion && sourceQuestion.type === 'MA' && question.type === 'SA') {
        // Check that if Q12 has a code, Q11 must have the same code selected
        // Example: if Q12 = 1 and mis(Q11R1) check_Q12_Q11_code1 = 1.
        if (sourceQuestion.options) {
          sourceQuestion.options.forEach(sourceOpt => {
            const sourceCode = Number(sourceOpt.code)
            if (!isNaN(sourceCode) && !String(sourceOpt.code).endsWith('_O')) {
              const sourceVar = getVariableName(sourceQuestion.id, sourceCode, sourceQuestion.type)
              questionChecks.push(`if ${question.id} = ${sourceCode} and mis(${sourceVar}) check_${question.id}_${sourceQuestion.id}_code${sourceCode} = 1.`)
            }
          })
        }
      }
    }
    
    // Check for "Other" options with _O suffix
    if (question.options) {
      question.options.forEach(opt => {
        const codeStr = String(opt.code)
        if (codeStr.endsWith('_O')) {
          // Check if "Other" is selected but text is empty
          const baseCode = codeStr.replace('_O', '')
          const otherVar = `${question.id}R${baseCode}_${baseCode}`
          questionChecks.push(`if ${question.id}R${baseCode} = ${baseCode} and ${otherVar} ="" check_${otherVar} = 1.`)
        }
      })
    }
    
    // Ranking checks
    if (question.type === 'Rank_Fixed' && question.limit) {
      for (let rank = 1; rank <= question.limit; rank++) {
        questionChecks.push(`if count_${question.id}_rank${rank} <> 1 check_${question.id}_rank${rank} = 1.`)
      }
    }
    
    // Ask IF with specific code checks (like Q13B)
    if (question.logic?.ask_if_condition && question.logic?.piping_source) {
      const sourceQuestion = questionMap.get(question.logic.piping_source)
      if (sourceQuestion && sourceQuestion.type === 'MA' && question.type === 'MA') {
        const codes = extractCodesFromCondition(question.logic.ask_if_condition, sourceQuestion.id)
        if (codes.length > 0) {
          // Check if source has code but question is not answered
          const firstCode = codes[0]
          const sourceVar = getVariableName(sourceQuestion.id, firstCode, sourceQuestion.type)
          questionChecks.push(`IF ${sourceVar}=${firstCode} AND Count_${question.id}=0 CHECK_${question.id}=1.`)
          questionChecks.push(`IF sysmis(${sourceVar}) AND Count_${question.id}>0 CHECK_${question.id}=1.`)
        }
      }
    }
    
    if (questionChecks.length > 0) {
      checks.push(`*${question.id}.`)
      checks.push(...questionChecks)
    }
  })
  
  return checks
}

/**
 * Generate QC Syntax from ParsedQuestion JSON
 */
export function generateQCSyntaxFromJSON(questions: ParsedQuestion[]): string {
  const countStatements = generateCountStatements(questions)
  const checkStatements = generateCheckStatements(questions)
  
  const syntax = [
    '*Count Statement.',
    '*===============================================================================.',
    ...countStatements,
    '',
    '*Check Statement.',
    '*===============================================================================.',
    ...checkStatements,
  ].join('\n')
  
  return syntax
}
