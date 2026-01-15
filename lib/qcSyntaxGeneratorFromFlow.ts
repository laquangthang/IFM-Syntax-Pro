/**
 * SPSS Check Missing Syntax Generator from Flow Canvas (LogicModelGraph)
 * Generates SPSS CHECK statements for missing data validation
 * 
 * Rules:
 * 1. Count statements for MA and Rank questions
 * 2. SA questions (Ask All): if mis(Q1) check_mis_Q1= 1.
 * 3. SA questions (with Ask If condition):
 *    - From SA question with ASK_IF: if Q0 = 1 and mis(Q1) check_mis_Q1= 1.
 *    - From SA question with F0: if mis(Q1) check_mis_Q1 = 1.
 * 4. OE/OA questions: If Q1 = "" check_mis_Q1 = 1.
 * 5. MA questions:
 *    - Count first: count count_Q1 = Q1R1 to Q1R99 (1 thru 99).
 *    - Ask All: if count_Q1 = 0 check_mis_Q1 = 1.
 *    - Ask If from other question: if Q0 = 1 and count_Q1 = 0 check_mis_Q1 = 1.
 */

import { LogicModelNode, LogicModelEdge, LogicModelGraph } from './logicModelConverter'
import { OldVariableMapping } from '@/store/surveyStore'

/**
 * Get variable name from oldVariableMapping or generate default
 * oldVariableMapping array order corresponds to options order (excluding _O codes)
 */
function getVariableNameForSyntax(
  questionId: string,
  code: string | number | null,
  questionType: string,
  oldVariableMapping?: OldVariableMapping,
  parsedQuestion?: any
): string {
  // For parent question node
  if (code === null) {
    // Check if there's a mapping for the question itself
    const oldVars = oldVariableMapping?.[questionId]
    if (oldVars && oldVars.length > 0) {
      // For questions, use the first variable name (usually the main question variable)
      return oldVars[0]
    }
    return questionId
  }
  
  // For code nodes, find the corresponding variable in oldVariableMapping
  const oldVars = oldVariableMapping?.[questionId]
  if (oldVars && oldVars.length > 0 && parsedQuestion?.options) {
    // Find code index in options (excluding _O codes)
    const mainOptions = parsedQuestion.options.filter((opt: any) => !String(opt.code).endsWith('_O'))
    const codeIndex = mainOptions.findIndex((opt: any) => {
      const optCode = typeof opt.code === 'number' ? opt.code : parseInt(String(opt.code), 10)
      const targetCode = typeof code === 'number' ? code : parseInt(String(code), 10)
      return optCode === targetCode
    })
    
    if (codeIndex >= 0 && codeIndex < oldVars.length) {
      // Use variable at the same index position
      return oldVars[codeIndex]
    }
    
    // Fallback: try pattern matching
    const codeStr = String(code)
    const codeNum = typeof code === 'number' ? code : parseInt(codeStr, 10)
    
    if (questionType === 'MA') {
      // Look for pattern Q1R1, Q1R2, etc.
      const pattern = new RegExp(`${questionId}R${codeNum}(_O)?$`, 'i')
      const matchedVar = oldVars.find(v => pattern.test(v))
      if (matchedVar) return matchedVar
    } else if (questionType === 'SA_Grid' || questionType === 'OE_Grid' || 
               questionType === 'Rank_Fixed' || questionType === 'Rank_Upto') {
      // Look for pattern Q1_1, Q1_2, etc.
      const pattern = new RegExp(`${questionId}_${codeNum}$`, 'i')
      const matchedVar = oldVars.find(v => pattern.test(v))
      if (matchedVar) return matchedVar
    }
  }
  
  // Generate default variable name
  if (questionType === 'MA') {
    return `${questionId}R${code}`
  } else {
    return `${questionId}_${code}`
  }
}

/**
 * Generate COUNT statements for MA and Rank questions
 */
function generateCountStatements(
  nodes: LogicModelNode[],
  oldVariableMapping?: OldVariableMapping,
  parsedQuestions?: any[]
): string[] {
  const counts: string[] = []
  const questionNodes = nodes.filter(n => n.type === 'question')
  
  // Create a map of question ID to parsed question data
  const questionMap = new Map<string, any>()
  if (parsedQuestions) {
    parsedQuestions.forEach(q => {
      questionMap.set(q.id, q)
    })
  }
  
  questionNodes.forEach(questionNode => {
    const questionType = questionNode.data.questionType
    const questionId = questionNode.id
    const parsedQ = questionMap.get(questionId)
    
    if (questionType === 'MA') {
      // Find all code nodes for this question
      const codeNodes = nodes.filter(n => 
        n.type === 'code' && n.data.questionId === questionId
      )
      
      if (codeNodes.length > 0) {
        // Sort by code
        const sortedCodes = codeNodes
          .map(n => {
            const code = n.data.code
            return typeof code === 'number' ? code : parseInt(String(code), 10)
          })
          .filter(code => !isNaN(code) && !String(code).endsWith('_O'))
          .sort((a, b) => a - b)
        
        if (sortedCodes.length > 0) {
          const firstCode = sortedCodes[0]
          const lastCode = sortedCodes[sortedCodes.length - 1]
          const firstVar = getVariableNameForSyntax(questionId, firstCode, questionType, oldVariableMapping, parsedQ)
          const lastVar = getVariableNameForSyntax(questionId, lastCode, questionType, oldVariableMapping, parsedQ)
          
          counts.push(`count count_${questionId} = ${firstVar} to ${lastVar} (${firstCode} thru ${lastCode}).`)
        }
      }
    } else if (questionType === 'Rank_Fixed' || questionType === 'Rank_Upto') {
      // Rank questions: generate COUNT statements for each rank (1, 2, 3, ...)
      // Example: count count_Q17_rank1 = Q17_1 to Q17_12 (1).
      const limit = parsedQ?.limit || questionNode.data.limit
      
      if (limit && limit > 0) {
      // Find all code nodes for this ranking question
      const codeNodes = nodes.filter(n => 
        n.type === 'code' && n.data.questionId === questionId
      )
      
      if (codeNodes.length > 0) {
          // Sort by code
        const sortedCodes = codeNodes
          .map(n => {
            const code = n.data.code
            return typeof code === 'number' ? code : parseInt(String(code), 10)
          })
          .filter(code => !isNaN(code))
          .sort((a, b) => a - b)
        
        if (sortedCodes.length > 0) {
          const firstCode = sortedCodes[0]
          const lastCode = sortedCodes[sortedCodes.length - 1]
            const firstVar = getVariableNameForSyntax(questionId, firstCode, questionType, oldVariableMapping, parsedQ)
            const lastVar = getVariableNameForSyntax(questionId, lastCode, questionType, oldVariableMapping, parsedQ)
          
            // Generate COUNT statement for each rank (1, 2, 3, ..., limit)
          for (let rank = 1; rank <= limit; rank++) {
            counts.push(`count count_${questionId}_rank${rank} = ${firstVar} to ${lastVar} (${rank}).`)
            }
          }
        }
      }
    }
  })
  
  return counts
}

/**
 * Extract condition from ASK_IF edge and replace variable names with mapped names
 * Converts "IF (Q5R6 = 6 OR Q5R7 = 7)" to "Q5R6 = 6 or Q5R7 = 7"
 * Also replaces variable names with mapped names from oldVariableMapping
 */
function extractAskIfCondition(
  condition: string,
  oldVariableMapping?: OldVariableMapping
): string {
  if (!condition) return ''
  
  // Remove "IF" prefix and parentheses
  let cleaned = condition.trim()
  if (cleaned.toUpperCase().startsWith('IF')) {
    cleaned = cleaned.substring(2).trim()
  }
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = cleaned.slice(1, -1).trim()
  }
  
  // Convert OR to lowercase or
  cleaned = cleaned.replace(/\s+OR\s+/gi, ' or ')
  
  // Replace variable names with mapped names if oldVariableMapping is provided
  if (oldVariableMapping) {
    // Pattern to match variable names like Q1R1, Q1R2, Q1, etc.
    const varPattern = /(Q\d+[A-Z]?R?\d*)/g
    cleaned = cleaned.replace(varPattern, (match) => {
      // Try to find this variable in the mapping
      // Extract question ID from variable name (e.g., Q1R1 -> Q1, Q5R6 -> Q5)
      const questionMatch = match.match(/^(Q\d+[A-Z]?)/)
      if (questionMatch) {
        const questionId = questionMatch[1]
        const oldVars = oldVariableMapping[questionId]
        if (oldVars && oldVars.length > 0) {
          // Try to find the exact match or closest match
          // For now, we'll keep the original format and let the mapping handle it
          // This is complex because we need to map Q5R6 to the correct position in oldVars
          // For simplicity, we'll use the original variable name for now
          // TODO: Implement proper variable mapping based on code position
        }
      }
      return match
    })
  }
  
  return cleaned
}

/**
 * Generate terminate check statement from terminate condition
 * Examples:
 * - Q2 SA: "IF Q2 = 2" → "if Q2 = 2 check_Q2_terminate = 1."
 * - Q5 MA: "IF (Q5R15 = 15 or Q5R16 = 16)" → "if (Q5R15 = 15 or Q5R16 = 16) check_Q5_terminate = 1."
 */
function generateTerminateCheck(
  questionId: string,
  questionType: string,
  terminateCondition: string,
  oldVariableMapping?: OldVariableMapping
): string {
  if (!terminateCondition) return ''
  
  // Remove "IF" prefix if present
  let condition = terminateCondition.trim()
  if (condition.toUpperCase().startsWith('IF')) {
    condition = condition.substring(2).trim()
  }
  
  // Convert OR to lowercase or
  condition = condition.replace(/\s+OR\s+/gi, ' or ')
  condition = condition.replace(/\s+AND\s+/gi, ' and ')
  
  // Replace variable names with mapped names if oldVariableMapping is provided
  if (oldVariableMapping) {
    // Pattern to match variable names like Q1R1, Q1R2, Q1, etc.
    const varPattern = /(Q\d+[A-Z]?R?\d*)/g
    condition = condition.replace(varPattern, (match) => {
      // Extract question ID from variable name
      const questionMatch = match.match(/^(Q\d+[A-Z]?)/)
      if (questionMatch) {
        const qId = questionMatch[1]
        const oldVars = oldVariableMapping[qId]
        if (oldVars && oldVars.length > 0) {
          // For now, keep original format
          // TODO: Implement proper variable mapping
        }
      }
      return match
    })
  }
  
  return `if ${condition} check_${questionId}_terminate = 1.`
}

/**
 * Generate CHECK statements for all questions
 */
function generateCheckStatements(
  nodes: LogicModelNode[],
  edges: LogicModelEdge[],
  parsedQuestions: any[],
  oldVariableMapping?: OldVariableMapping
): string[] {
  const checks: string[] = []
  const questionNodes = nodes.filter(n => n.type === 'question')
  
  // Create a map of question ID to parsed question data
  const questionMap = new Map<string, any>()
  parsedQuestions.forEach(q => {
    questionMap.set(q.id, q)
  })
  
  // Create a map of target question to incoming ASK_IF edges
  const askIfEdgesMap = new Map<string, LogicModelEdge[]>()
  edges.forEach(edge => {
    if (edge.type === 'ASK_IF' && !edge.target.endsWith('_terminate')) {
      if (!askIfEdgesMap.has(edge.target)) {
        askIfEdgesMap.set(edge.target, [])
      }
      askIfEdgesMap.get(edge.target)!.push(edge)
    }
  })
  
  // Create a map of target question to incoming F0 edges
  const f0EdgesMap = new Map<string, LogicModelEdge[]>()
  edges.forEach(edge => {
    if (edge.type === 'F0' && !edge.target.endsWith('_terminate')) {
      const targetNode = nodes.find(n => n.id === edge.target)
      if (targetNode && targetNode.type === 'question') {
        if (!f0EdgesMap.has(edge.target)) {
          f0EdgesMap.set(edge.target, [])
        }
        f0EdgesMap.get(edge.target)!.push(edge)
      }
    }
  })
  
  questionNodes.forEach((questionNode, index) => {
    // Add comment separator for each question (except first one)
    if (index > 0) {
      checks.push('')
    }
    checks.push(`* --- ${questionNode.id} ---.`)
    
    const questionType = questionNode.data.questionType
    const questionId = questionNode.id
    const parsedQuestion = questionMap.get(questionId)
    
    // Check if question has Ask All logic
    const isAskAll = parsedQuestion?.logic?.type === 'Ask All' || 
                     parsedQuestion?.instruction?.toUpperCase().includes('ASK ALL')
    
    // Get incoming ASK_IF edges
    const incomingAskIfEdges = askIfEdgesMap.get(questionId) || []
    
    // Get incoming F0 edges
    const incomingF0Edges = f0EdgesMap.get(questionId) || []
    
    // Get question variable name from mapping
    const questionVar = getVariableNameForSyntax(questionId, null, questionType, oldVariableMapping, parsedQuestion)
    
    // Generate check_mis statements (normal missing check)
      if (questionType === 'SA') {
      // SA questions
      if (incomingAskIfEdges.length > 0) {
        // Has ASK_IF condition - use the condition from the edge
        incomingAskIfEdges.forEach(edge => {
          const condition = extractAskIfCondition(edge.condition || edge.label || '', oldVariableMapping)
          if (condition) {
            // Add parentheses around condition to ensure correct logic precedence
            const hasOr = condition.includes(' or ')
            const conditionWithParens = hasOr ? `(${condition})` : condition
            checks.push(`if ${conditionWithParens} and mis(${questionVar}) check_mis_${questionId}= 1.`)
          } else {
            checks.push(`if mis(${questionVar}) check_mis_${questionId}= 1.`)
          }
        })
      } else if (incomingF0Edges.length > 0) {
        // Has F0 connection from another question - no condition needed
        checks.push(`if mis(${questionVar}) check_mis_${questionId} = 1.`)
      } else {
        // Ask All (default)
        checks.push(`if mis(${questionVar}) check_mis_${questionId}= 1.`)
      }
    } else if (questionType === 'OE' || questionType === 'OA') {
      // OE/OA questions
      checks.push(`if ${questionVar} = "" check_mis_${questionId} = 1.`)
    } else if (questionType === 'MA') {
      // Check if this MA question has piping from another MA question
      const pipingSource = parsedQuestion?.logic?.piping_source
      const hasPiping = parsedQuestion?.logic?.type === 'Piping' && pipingSource
      
      if (hasPiping && pipingSource) {
        // MA question with piping from another MA question
        // Generate check statements for each code: if Q11R1 = 1 and mis(Q10R1) check_Q11_Q10_code1 = 1.
        if (parsedQuestion?.options) {
          // Get all main options (excluding _O codes)
          const mainOptions = parsedQuestion.options.filter((opt: any) => !String(opt.code).endsWith('_O'))
          
          // Get piping source question data
          const pipingSourceQuestion = questionMap.get(pipingSource)
          
          if (pipingSourceQuestion && mainOptions.length > 0) {
            mainOptions.forEach((option: any) => {
              const code = option.code
              const codeNum = typeof code === 'number' ? code : parseInt(String(code), 10)
              
              if (!isNaN(codeNum)) {
                // Get variable names from mapping
                const currentVar = getVariableNameForSyntax(questionId, codeNum, questionType, oldVariableMapping, parsedQuestion)
                const sourceVar = getVariableNameForSyntax(pipingSource, codeNum, 'MA', oldVariableMapping, pipingSourceQuestion)
                
                // Generate check: if Q11R1 = 1 and mis(Q10R1) check_Q11_Q10_code1 = 1.
                checks.push(`if ${currentVar} = ${codeNum} and mis(${sourceVar}) check_${questionId}_${pipingSource}_code${codeNum} = 1.`)
              }
            })
          }
        }
      } else {
        // MA questions - normal missing check (need count first)
        if (incomingAskIfEdges.length > 0) {
          // Has ASK_IF condition
          incomingAskIfEdges.forEach(edge => {
            const condition = extractAskIfCondition(edge.condition || edge.label || '', oldVariableMapping)
            if (condition) {
              // Add parentheses around condition to ensure correct logic precedence
              const hasOr = condition.includes(' or ')
              const conditionWithParens = hasOr ? `(${condition})` : condition
              checks.push(`if ${conditionWithParens} and count_${questionId} = 0 check_mis_${questionId} = 1.`)
            } else {
              checks.push(`if count_${questionId} = 0 check_mis_${questionId} = 1.`)
            }
          })
        } else if (isAskAll) {
          // Ask All
          checks.push(`if count_${questionId} = 0 check_mis_${questionId} = 1.`)
        } else {
          // Default: Ask All
          checks.push(`if count_${questionId} = 0 check_mis_${questionId} = 1.`)
        }
      }
    } else if (questionType === 'Rank_Fixed' || questionType === 'Rank_Upto') {
      // Rank questions: generate CHECK statements for each rank
      // Example: if count_Q17_rank1 <> 1 check_Q17_rank1 = 1.
      const limit = parsedQuestion?.limit || questionNode.data.limit
      
      if (limit && limit > 0) {
        // Generate CHECK statement for each rank (1, 2, 3, ..., limit)
        for (let rank = 1; rank <= limit; rank++) {
          checks.push(`if count_${questionId}_rank${rank} <> 1 check_${questionId}_rank${rank} = 1.`)
        }
      }
    }
    
    // Generate terminate check statements if question has terminate condition
    const terminateCondition = questionNode.data.terminateIf || parsedQuestion?.logic?.terminate_if
    if (terminateCondition) {
      const terminateCheck = generateTerminateCheck(questionId, questionType, terminateCondition, oldVariableMapping)
      if (terminateCheck) {
        checks.push(terminateCheck)
      }
    }
    
    // Generate check statements for "Other" codes (ghi rõ)
    // Check from parsedQuestion options for codes with codeType "Other" or ending with _O
    // Use Set to track processed base codes to avoid duplicates
    if (parsedQuestion?.options) {
      const processedBaseCodes = new Set<number>()
      
      parsedQuestion.options.forEach((option: any) => {
        const code = option.code
        const codeStr = String(code)
        
        // Check if this is an "Other" code (ends with _O or has codeType "Other")
        const isOtherCode = codeStr.endsWith('_O') || option.codeType === 'Other'
        
        if (isOtherCode) {
          // Extract base code (remove _O suffix)
          const baseCode = codeStr.replace('_O', '')
          const baseCodeNum = parseInt(baseCode, 10)
          
          if (!isNaN(baseCodeNum) && !processedBaseCodes.has(baseCodeNum)) {
            // Mark this base code as processed
            processedBaseCodes.add(baseCodeNum)
            
            // Get main variable name from mapping
            const mainVar = getVariableNameForSyntax(questionId, baseCodeNum, questionType, oldVariableMapping, parsedQuestion)
            
            // For Other code, find the _O variable in oldVariableMapping
            const oldVars = oldVariableMapping?.[questionId]
            let otherVar = `${mainVar}_O` // Default
            
            if (oldVars && oldVars.length > 0) {
              // Look for variable ending with _O that corresponds to this code
              // Pattern: mainVar + _O (e.g., Q10R99_O)
              const otherPattern = new RegExp(`${mainVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_O$`, 'i')
              const matchedOtherVar = oldVars.find(v => otherPattern.test(v))
              if (matchedOtherVar) {
                otherVar = matchedOtherVar
              }
            }
            
            // Generate check: if Q10R99 = 99 and Q10R99_O = "" check_Q10R99_O = 1.
            checks.push(`if ${mainVar} = ${baseCodeNum} and ${otherVar} = "" check_${otherVar} = 1.`)
          }
        }
      })
    }
  })
  
  return checks
}

/**
 * Generate SPSS Check Missing Syntax from LogicModelGraph
 */
export function generateQCSyntaxFromFlow(
  graph: LogicModelGraph,
  parsedQuestions: any[],
  oldVariableMapping?: OldVariableMapping
): string {
  const counts = generateCountStatements(graph.nodes, oldVariableMapping, parsedQuestions)
  const checks = generateCheckStatements(graph.nodes, graph.edges, parsedQuestions, oldVariableMapping)
  
  const lines: string[] = []
  
  // Add COUNT statements first
  if (counts.length > 0) {
    lines.push('* COUNT statements for MA and Rank questions')
    lines.push('')
    counts.forEach(count => {
      lines.push(count)
    })
    lines.push('')
  }
  
  // Add CHECK statements
  if (checks.length > 0) {
    lines.push('* CHECK statements for missing data validation')
    lines.push('')
    checks.forEach(check => {
      lines.push(check)
    })
  }
  
  return lines.join('\n')
}
