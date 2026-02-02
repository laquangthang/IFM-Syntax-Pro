/**
 * Convert ParsedQuestions to Logic Model for React Flow
 * Creates parent nodes (questions) and child nodes (codes) with F1 connections
 * Layout: Horizontal flow from left to right (Q1, Q2, Q3...)
 */

import { ParsedQuestion } from './geminiParser'
import { OldVariableMapping } from '@/store/surveyStore'

/**
 * Parse condition to extract code values mentioned
 * For MA questions: code 1 → Q1R1, code 2 → Q1R2, etc.
 * Examples:
 *   "Q1.code == 1" → [1] (will map to Q1R1)
 *   "Q1.code == 1 AND Q1.code == 2" → [1, 2] (will map to Q1R1, Q1R2)
 *   "Q1R1 == 1" → [1] (extract code from Q1R1)
 *   "CODE 1 AND CODE 2" → [1, 2]
 */
export function extractCodesFromCondition(condition: string, questionId: string): (string | number)[] {
  const codes: (string | number)[] = []
  
  if (!condition) return codes
  
  // Pattern 1: Match Q1R1, Q1R2 format and extract the code after R
  // Example: Q1R1 → extract 1, Q1R2 → extract 2
  const qrPattern = new RegExp(`${questionId}R(\\d+)`, 'gi')
  let qrMatch: RegExpExecArray | null
  while ((qrMatch = qrPattern.exec(condition)) !== null) {
    const codeNum = parseInt(qrMatch[1], 10)
    if (!isNaN(codeNum) && !codes.includes(codeNum)) {
      codes.push(codeNum)
    }
  }
  
  // Pattern 2: Match .code == X or code == X (the X is the code value)
  // Example: Q1.code == 1 → extract 1, code == 2 → extract 2
  const codePatterns = [
    /\.code\s*[=!]=\s*(\d+)/gi,  // .code == 1 or .code != 1
    /(?:^|\s)code\s*[=!]=\s*(\d+)/gi,    // code == 1 (without dot, but not part of another word)
  ]
  
  for (const pattern of codePatterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(condition)) !== null) {
      const codeNum = parseInt(match[1], 10)
      if (!isNaN(codeNum) && !codes.includes(codeNum)) {
        codes.push(codeNum)
      }
    }
  }
  
  // Pattern 3: Match "CODE X" or "code X" format (text-based)
  // Example: "CODE 1 AND CODE 2" → extract 1, 2
  const codeTextPattern = /\bCODE\s+(\d+)\b/gi
  let codeTextMatch: RegExpExecArray | null
  while ((codeTextMatch = codeTextPattern.exec(condition)) !== null) {
    const codeNum = parseInt(codeTextMatch[1], 10)
    if (!isNaN(codeNum) && !codes.includes(codeNum)) {
      codes.push(codeNum)
    }
  }
  
  // Sort codes for consistent ordering
  codes.sort((a, b) => {
    const numA = typeof a === 'number' ? a : parseInt(String(a), 10)
    const numB = typeof b === 'number' ? b : parseInt(String(b), 10)
    return numA - numB
  })
  
  return codes
}

/**
 * Parse and format terminate condition to a human-readable format
 * For MA questions: convert code references to Q1R1, Q1R2 format
 * Examples:
 *   "IF NOT(Q1.code == 1)" → "IF mis(Q1R1)" (for MA) or "IF Q1 ≠ 1" (for others)
 *   "IF (Q2.code != 1)" → "IF Q2 ≠ 1"
 *   "IF NOT(Q1.code == 1 AND Q1.code == 2)" → "IF mis(Q1R1) AND mis(Q1R2)" (for MA)
 *   "IF NOT(Q1R1 == 1)" → "IF mis(Q1R1)"
 */
export function formatTerminateCondition(condition: string, questionId?: string, questionType?: string): { short: string; full: string } {
  if (!condition) return { short: '', full: '' }
  
  const isMA = questionType === 'MA'
  
  // Remove "IF" prefix if present
  let cleanCondition = condition.trim().replace(/^IF\s+/i, '')
  
  // Handle "NOT(...)" pattern
  const notMatch = cleanCondition.match(/^NOT\s*\((.*)\)$/i)
  if (notMatch) {
    const inner = notMatch[1].trim()
    
    // For MA questions: try to convert to mis(Q1R1) format if questionId is provided
    if (questionId && isMA) {
      const extractedCodes = extractCodesFromCondition(inner, questionId)
      
      if (extractedCodes.length > 0) {
        // Check if pattern matches MA format (Q1.code == X or Q1.code == Y)
        // Pattern should match: .code == or .code != with numbers
        const hasCodePattern = /\.code\s*[=!]=\s*\d+/.test(inner) || /code\s*[=!]=\s*\d+/.test(inner)
        
        if (hasCodePattern) {
          // Convert to mis(Q1R1) format
          const misParts = extractedCodes.map(code => `mis(${questionId}R${code})`)
          const andRegex = /\sAND\s/i
          const orRegex = /\sOR\s/i
          
          // Determine connector - use the same connector as in the original condition
          // User wants: NOT(Q.code == 9 OR Q.code == 10) → IF (mis(Q3AR9) or mis(Q3AR10))
          let connector = 'or'
          if (andRegex.test(inner)) {
            connector = 'and'
          } else if (orRegex.test(inner)) {
            connector = 'or'
          }
          
          const result = `IF (${misParts.join(` ${connector} `)})`
          return {
            short: result,
            full: condition,
          }
        }
      }
    }
    
    // Handle complex conditions with AND/OR (fallback for non-MA or other formats)
    const andRegex = /\sAND\s/i
    const orRegex = /\sOR\s/i
    
    if (andRegex.test(inner) || orRegex.test(inner)) {
      // Apply De Morgan's law: NOT(A AND B) = NOT(A) OR NOT(B)
      // For display, we'll convert operators and flip AND/OR
      let processed = inner
        .replace(/==/g, '≠')
        .replace(/!=/g, '=')
      processed = processed.replace(/(?<![!<>])=(?![=<>])/g, '≠')
      processed = processed.replace(/\.code\s*/g, '')
      // Flip AND to OR and OR to AND (De Morgan's law)
      processed = processed.replace(/\sAND\s/gi, ' |OR| ')
      processed = processed.replace(/\sOR\s/gi, ' |AND| ')
      processed = processed.replace(/\|OR\|/g, 'OR')
      processed = processed.replace(/\|AND\|/g, 'AND')
      
      return {
        short: `IF ${processed.trim()}`,
        full: condition,
      }
    } else {
      // Simple NOT condition
      let negated = inner
        .replace(/==/g, '≠')
        .replace(/!=/g, '=')
      negated = negated.replace(/(?<![!<>])=(?![=<>])/g, '≠')
      negated = negated.replace(/\.code\s*/g, '')
      
      // Try to convert to mis() format for MA if applicable
      if (questionId && isMA) {
        const codeMatch = negated.match(/(\d+)/)
        if (codeMatch && /\.code/.test(inner)) {
          const code = codeMatch[1]
          negated = `mis(${questionId}R${code})`
        }
      }
      
      return {
        short: `IF ${negated}`,
        full: condition,
      }
    }
  }
  
  // Handle normal conditions - for MA questions, convert Q.code == X to QRX = X
  if (questionId && isMA) {
    // Check if condition has .code pattern
    const hasCodePattern = /\.code\s*[=!]=\s*\d+/.test(cleanCondition)
    if (hasCodePattern) {
      // Extract codes and convert to QRX = X format
      const extractedCodes = extractCodesFromCondition(cleanCondition, questionId)
      if (extractedCodes.length > 0) {
        // Replace Q.code == X with QRX = X
        let converted = cleanCondition
        extractedCodes.forEach(code => {
          // Replace patterns like Q5.code == 15 or Q5.code==15 with Q5R15 = 15
          const pattern = new RegExp(`${questionId}\\.code\\s*==\\s*${code}`, 'gi')
          converted = converted.replace(pattern, `${questionId}R${code} = ${code}`)
          // Also handle != pattern if needed
          const patternNot = new RegExp(`${questionId}\\.code\\s*!=\\s*${code}`, 'gi')
          converted = converted.replace(patternNot, `${questionId}R${code} ≠ ${code}`)
        })
        
        // Normalize operators and spaces
        converted = converted
          .replace(/==/g, '=')
          .replace(/\s+/g, ' ')
          .trim()
        
        // Ensure spaces around = operator: Q3R1=1 -> Q3R1 = 1, Q3R1= 1 -> Q3R1 = 1, Q3R1 =1 -> Q3R1 = 1
        // Match pattern like Q3R1=1 or Q3=3 (variable name = number)
        converted = converted.replace(/([A-Z]\d+[A-Z]?\d*)=(\d+)/g, '$1 = $2') // Q3=3 -> Q3 = 3
        converted = converted.replace(/([A-Z]\d+[A-Z]?\d*)\s*=(\s*\d+)/g, '$1 = $2') // Q3= 3 -> Q3 = 3
        converted = converted.replace(/([A-Z]\d+[A-Z]?\d*)\s*=(\d+)/g, '$1 = $2') // Q3 =3 -> Q3 = 3
        
        return {
          short: `IF (${converted})`,
          full: condition,
        }
      }
    }
  }
  
  // Handle normal conditions - simplify operators
  let simplified = cleanCondition
    .replace(/\.code\s*/g, '') // Remove ".code"
    .replace(/==/g, '=')       // Normalize == to =
    .replace(/!=/g, '≠')       // Keep != as ≠
    .replace(/\s+/g, ' ')      // Normalize spaces
  
  // Ensure spaces around = operator: Q3=3 -> Q3 = 3, Q3= 3 -> Q3 = 3, Q3 =3 -> Q3 = 3
  // Match pattern like Q3=3 or Q3R1=1 (variable name = number)
  simplified = simplified.replace(/([A-Z]\d+[A-Z]?\d*)=(\d+)/g, '$1 = $2') // Q3=3 -> Q3 = 3
  simplified = simplified.replace(/([A-Z]\d+[A-Z]?\d*)\s*=(\s*\d+)/g, '$1 = $2') // Q3= 3 -> Q3 = 3
  simplified = simplified.replace(/([A-Z]\d+[A-Z]?\d*)\s*=(\d+)/g, '$1 = $2') // Q3 =3 -> Q3 = 3
  
  return {
    short: `IF ${simplified}`,
    full: condition,
  }
}

export interface LogicModelNode {
  id: string
  type: 'question' | 'code' | 'intermediate' | 'terminate' // terminate for condition nodes
  data: {
    label: string
    questionId?: string // For code nodes, reference to parent question
    code?: string | number // For code nodes
    questionType?: ParsedQuestion['type']
    parentId?: string // For child nodes, reference to parent node
    isIntermediate?: boolean // True for MA_Grid row intermediate nodes
    rowCode?: string | number // For MA_Grid intermediate nodes
    terminateIf?: string // For question nodes: terminate condition
    conditionCodes?: (string | number)[] // For question nodes: codes mentioned in condition
    hasCondition?: boolean // For code nodes: if this code is part of a condition
    condition?: string // For terminate nodes: the condition text
    formattedCondition?: string // For terminate nodes: formatted condition for display
    optionLabel?: string // For code nodes: original option/row/column label for tooltip display
  }
  position: { x: number; y: number }
}

export interface LogicModelEdge {
  id: string
  source: string
  target: string
  type: 'F0' | 'F1' | 'F2' | 'ASK_IF' | 'PIPING' | 'default'
  label?: string
  condition?: string // For ASK_IF edges
}

export interface LogicModelGraph {
  nodes: LogicModelNode[]
  edges: LogicModelEdge[]
}

/**
 * Generate variable name for a question based on question type
 * Always generates NEW variable names (not old variable names)
 * For MA: Q1R1, Q1R2, etc.
 * For SA_Grid/OE_Grid: Q5_1, Q5_2, etc.
 * For MA_Grid: Q8_1R1, Q8_1R2, etc.
 * For Rank: Q15_1, Q15_2, etc.
 */
function getVariableName(
  questionId: string, 
  code: string | number | null, 
  questionType?: ParsedQuestion['type']
): string {
  // For parent question node, just return question ID
  if (code === null) {
    return questionId
  }
  
  // Always generate NEW variable name based on question type
  return generateExpectedVariableName(questionId, code, questionType)
}

/**
 * Generate expected variable name based on question type and code
 */
function generateExpectedVariableName(
  questionId: string,
  code: string | number,
  questionType?: ParsedQuestion['type']
): string {
  if (questionType === 'MA') {
    // MA: Q1R1, Q1R2, etc.
    return `${questionId}R${code}`
  } else if (questionType === 'SA_Grid' || questionType === 'OE_Grid') {
    // SA_Grid/OE_Grid: Q5_1, Q5_2, etc.
    return `${questionId}_${code}`
  } else if (questionType === 'MA_Grid') {
    // MA_Grid: Format is already handled in the calling code with row/col
    // This should not be called for MA_Grid
    return `${questionId}_${code}`
  } else if (questionType === 'Rank_Fixed' || questionType === 'Rank_Upto') {
    // Rank: Q15_1, Q15_2, etc.
    return `${questionId}_${code}`
  } else {
    // Default: Q1_1, Q1_2, etc.
    return `${questionId}_${code}`
  }
}

/**
 * Convert questions to Logic Model graph
 */
export function convertQuestionsToLogicModel(
  questions: ParsedQuestion[],
  oldVarMapping?: OldVariableMapping
): LogicModelGraph {
  const nodes: LogicModelNode[] = []
  const edges: LogicModelEdge[] = []
  
  // Helper function to extract source question ID from ask_if_condition
  // Examples: "IF mis(Q5R6)" -> "Q5", "IF (Q5R6 = 6)" -> "Q5", "IF Q3 = 1" -> "Q3"
  const extractSourceFromAskIfCondition = (condition: string): string | null => {
    if (!condition) return null
    const match = condition.match(/Q\d+/i)
    return match ? match[0] : null
  }

  // Horizontal layout: questions arranged left to right
  const xSpacing = 400 // Space between question groups (parent + children)
  const childXOffset = 200 // Children positioned to the right of parent
  const childYSpacing = 80 // Vertical spacing between child nodes
  const startX = 100
  const startY = 100
  
  // Map to track child nodes for each question (for creating flow edges later)
  const questionChildNodesMap = new Map<string, LogicModelNode[]>()
  // Map to track intermediate nodes for MA_Grid questions (for creating PIPING edges later)
  const questionIntermediateNodesMap = new Map<string, LogicModelNode[]>()
  
  questions.forEach((question, questionIndex) => {
    // Create parent node (question) - positioned horizontally
    const parentNodeId = question.id
    const parentVariableName = getVariableName(question.id, null, question.type)
        
    // Extract terminate_if condition and codes
    let conditionCodes: (string | number)[] = []
    if (question.logic?.terminate_if) {
      conditionCodes = extractCodesFromCondition(question.logic.terminate_if, question.id)
    }
    
    // Detect TRAP codes from options/rows labels and instruction field
    const trapCodes: (string | number)[] = []
    
    // Method 1: Check instruction field for "TRAP for codes X, Y, Z" pattern
    if (question.instruction) {
      const trapMatch = question.instruction.match(/TRAP\s+for\s+codes?\s+([\d,\s]+)/i)
      if (trapMatch) {
        const codesStr = trapMatch[1]
        const codes = codesStr.split(',').map(c => {
          const trimmed = c.trim()
          const num = parseInt(trimmed, 10)
          return isNaN(num) ? trimmed : num
        }).filter(c => c !== '')
        trapCodes.push(...codes)
      }
    }
    
    // Method 2: Check individual option/row labels for TRAP
    if (question.options) {
      question.options.forEach(opt => {
        if (opt.label && /TRAP/i.test(opt.label)) {
          if (!trapCodes.includes(opt.code) && !trapCodes.includes(Number(opt.code))) {
            trapCodes.push(opt.code)
          }
        }
      })
    }
    if (question.rows) {
      question.rows.forEach(row => {
        if (row.label && /TRAP/i.test(row.label)) {
          if (!trapCodes.includes(row.code) && !trapCodes.includes(Number(row.code))) {
            trapCodes.push(row.code)
          }
        }
      })
    }
    
    // Build TRAP terminate condition if any TRAP codes found
    let trapTerminateCondition: string | null = null
    if (trapCodes.length > 0) {
      // For MA questions: format as Q3AR11 = 11 or Q3AR12 = 12
      // For other types: format accordingly
      if (question.type === 'MA') {
        const conditions = trapCodes.map(code => `${question.id}R${code} = ${code}`).join(' or ')
        trapTerminateCondition = `IF (${conditions})`
      } else if (question.type === 'MA_Grid') {
        // For MA_Grid, format as Q3AR11 = 11 or Q3AR12 = 12 (rows are the codes)
        const conditions = trapCodes.map(code => `${question.id}_${code} = ${code}`).join(' or ')
        trapTerminateCondition = `IF (${conditions})`
      } else {
        // For other types, use simple format
        const conditions = trapCodes.map(code => `${question.id}.code == ${code}`).join(' or ')
        trapTerminateCondition = `IF (${conditions})`
      }
      
      // Add TRAP codes to conditionCodes
      trapCodes.forEach(code => {
        if (!conditionCodes.includes(code)) {
          conditionCodes.push(code)
        }
      })
    }
    
    // Format conditions before merging (important for MA questions to get mis() format)
    let formattedExistingCondition = question.logic?.terminate_if || null
    if (formattedExistingCondition) {
      const formatted = formatTerminateCondition(formattedExistingCondition, question.id, question.type)
      // Use the formatted short version, but remove "IF" prefix for merging
      formattedExistingCondition = formatted.short.replace(/^IF\s+/i, '').trim()
    }
    
    let formattedTrapCondition = trapTerminateCondition
    if (formattedTrapCondition) {
      const formatted = formatTerminateCondition(formattedTrapCondition, question.id, question.type)
      formattedTrapCondition = formatted.short.replace(/^IF\s+/i, '').trim()
    }
    
    // Merge formatted conditions
    let finalTerminateCondition: string | null = null
    if (formattedTrapCondition && formattedExistingCondition) {
      finalTerminateCondition = `IF (${formattedExistingCondition} or ${formattedTrapCondition})`
    } else if (formattedTrapCondition) {
      finalTerminateCondition = `IF (${formattedTrapCondition})`
    } else if (formattedExistingCondition) {
      finalTerminateCondition = `IF (${formattedExistingCondition})`
    }
    
    const parentNode: LogicModelNode = {
      id: parentNodeId,
      type: 'question',
      data: {
        label: parentVariableName,
        questionType: question.type,
        terminateIf: finalTerminateCondition || undefined,
        conditionCodes: conditionCodes.length > 0 ? conditionCodes : undefined,
      },
      position: {
        x: startX + questionIndex * xSpacing,
        y: startY,
      },
    }
        
    nodes.push(parentNode)
    
    // Create terminate condition node if question has terminate condition (from terminate_if or TRAP codes)
    if (finalTerminateCondition) {
      // finalTerminateCondition is already formatted, so we can use it directly
      // But we need to remove the "IF " prefix for the formattedCondition display
      const displayCondition = finalTerminateCondition.replace(/^IF\s+/i, '').trim()
      const terminateNodeId = `${question.id}_terminate`
      const terminateNode: LogicModelNode = {
        id: terminateNodeId,
        type: 'terminate',
        data: {
          label: 'Terminate',
          condition: finalTerminateCondition,
          formattedCondition: displayCondition, // Use the formatted condition directly
          questionId: question.id,
        },
        position: {
          x: parentNode.position.x,
          y: parentNode.position.y - 120, // Position above parent node
        },
      }
      nodes.push(terminateNode)
      
      // Create ASK_IF edge from parent to terminate node
      const terminateEdge: LogicModelEdge = {
        id: `askif_${question.id}_terminate`,
        source: question.id,
        target: terminateNodeId,
        type: 'ASK_IF',
        label: displayCondition || 'Terminate',
        condition: finalTerminateCondition,
      }
      edges.push(terminateEdge)
      
    }
    
    // Create child nodes (codes) based on question type
    let childNodes: LogicModelNode[] = []
    
    // SA, MA, and OE questions create child nodes from options
    if (question.type === 'SA' || question.type === 'MA' || question.type === 'OE') {
      // Create child nodes from options (format: Q1R1, Q1R2, etc.)
      if (question.options && question.options.length > 0) {
        // Filter out _O options (they are handled separately in syntax)
        const mainOptions = question.options.filter(opt => !String(opt.code).endsWith('_O'))
        
        if (mainOptions.length > 0) {
          const childCount = mainOptions.length
          const totalHeight = childCount * childYSpacing
          const parentY = parentNode.position.y
          const centerOffset = parentY - (totalHeight / 2) + (childYSpacing / 2) // Center children around parent
          
          childNodes = mainOptions.map((option, optionIndex) => {
            const childNodeId = `${question.id}R${option.code}`
            const childVariableName = getVariableName(question.id, option.code, question.type)
            
            // Check if this code is part of the condition
            const hasCondition = conditionCodes.includes(option.code) || conditionCodes.includes(Number(option.code))
            
            return {
              id: childNodeId,
              type: 'code' as const,
              data: {
                label: childVariableName,
                questionId: question.id,
                code: option.code,
                hasCondition: hasCondition,
                optionLabel: option.label, // Store original option label for tooltip
              },
              position: {
                x: startX + questionIndex * xSpacing + childXOffset,
                y: centerOffset + optionIndex * childYSpacing,
              },
            }
          })
        }
      }
    } else if (question.type === 'SA_Grid' || question.type === 'OE_Grid') {
      // For SA_Grid/OE_Grid, create child nodes from rows (Q5_1, Q5_2, etc.)
      // SA_Grid and OE_Grid always have child nodes from rows
      if (question.rows && question.rows.length > 0) {
        // Filter out _O rows
        const mainRows = question.rows.filter(row => !String(row.code).endsWith('_O'))
        const childCount = mainRows.length
        const totalHeight = childCount * childYSpacing
        const parentY = parentNode.position.y
        const centerOffset = parentY - (totalHeight / 2) + (childYSpacing / 2) // Center children around parent
        
        childNodes = mainRows.map((row, rowIndex) => {
          const childNodeId = `${question.id}_${row.code}`
          const childVariableName = getVariableName(question.id, row.code, question.type)
          
          // Check if this code is part of the condition
          const hasCondition = conditionCodes.includes(row.code) || conditionCodes.includes(Number(row.code))
          
          return {
            id: childNodeId,
            type: 'code' as const,
            data: {
              label: childVariableName,
              questionId: question.id,
              code: row.code,
              hasCondition: hasCondition,
              optionLabel: row.label, // Store original row label for tooltip
            },
            position: {
              x: startX + questionIndex * xSpacing + childXOffset,
              y: centerOffset + rowIndex * childYSpacing,
            },
          }
        })
      }
    } else if (question.type === 'MA_Grid') {
      // For MA_Grid, create intermediate nodes (one per COLUMN) and child nodes (rows per column)
      // Structure: Q7 (parent) -> Q7_1, Q7_2, ... (intermediate from columns) -> Q7_1R1, Q7_1R2, ... (children from rows)
      // Only create child nodes if there are multiple rows and columns
      if (question.rows && question.columns) {
        // Filter out _O rows
        const mainRows = question.rows.filter(r => !String(r.code).endsWith('_O'))
        // Only create child nodes if there are multiple rows or multiple columns
        if (mainRows.length > 1 || question.columns.length > 1) {
          const parentY = parentNode.position.y
          
          // Calculate spacing for intermediate nodes (columns) - center them around parent
          const columnSpacing = 150 // Space between column groups
          const totalIntermediateHeight = question.columns.length * columnSpacing
          const intermediateCenterOffset = parentY - (totalIntermediateHeight / 2) + (columnSpacing / 2)
          
          // Create intermediate nodes (one per COLUMN) - centered around parent
          const intermediateNodes: LogicModelNode[] = question.columns.map((col, colIndex) => {
            const intermediateNodeId = `${question.id}_${col.code}`
            return {
              id: intermediateNodeId,
              type: 'intermediate' as const,
              data: {
                label: intermediateNodeId,
                questionId: question.id,
                columnCode: col.code,
                isIntermediate: true,
                questionType: question.type,
              },
              position: {
                x: startX + questionIndex * xSpacing + childXOffset,
                y: intermediateCenterOffset + colIndex * columnSpacing,
              },
            }
          })
        
        // Add intermediate nodes to nodes array first
        nodes.push(...intermediateNodes)
        
        // Store intermediate nodes for this question (for creating PIPING edges later)
        questionIntermediateNodesMap.set(question.id, intermediateNodes)
        
        // Create edges from parent to intermediate nodes
        intermediateNodes.forEach((intermediateNode) => {
          const edge: LogicModelEdge = {
            id: `${parentNodeId}-${intermediateNode.id}`,
            source: parentNodeId,
            target: intermediateNode.id,
            type: 'F1',
            label: 'F1',
          }
          edges.push(edge)
        })
        
        // Create child nodes for each column-row combination - centered around each intermediate node
        // Create child nodes from rows for each column
        intermediateNodes.forEach((intermediateNode, colIndex) => {
          const col = question.columns![colIndex]
          const rowCount = mainRows.length
          const totalRowHeight = rowCount * childYSpacing
          const intermediateY = intermediateNode.position.y
          const rowCenterOffset = intermediateY - (totalRowHeight / 2) + (childYSpacing / 2) // Center rows around intermediate node
          
          mainRows.forEach((row, rowIndex) => {
            const childNodeId = `${question.id}_${col.code}R${row.code}`
            // MA_Grid format: Q7_1R1 (column_row)
            const childVariableName = `${question.id}_${col.code}R${row.code}`
            
            childNodes.push({
              id: childNodeId,
              type: 'code' as const,
              data: {
                label: childVariableName,
                questionId: question.id,
                code: `${col.code}_${row.code}`,
                parentId: intermediateNode.id,
                  optionLabel: (row as any).label || String(row.code), // Store original row label for tooltip
              },
              position: {
                x: startX + questionIndex * xSpacing + childXOffset * 2, // Further right for children
                y: rowCenterOffset + rowIndex * childYSpacing,
              },
            })
          })
        })
          
          // Create edges from intermediate nodes to child nodes
          intermediateNodes.forEach((intermediateNode) => {
            const columnChildren = childNodes.filter(child => child.data.parentId === intermediateNode.id)
            columnChildren.forEach((childNode) => {
              const edge: LogicModelEdge = {
                id: `${intermediateNode.id}-${childNode.id}`,
                source: intermediateNode.id,
                target: childNode.id,
                type: 'F1',
                label: 'F1',
              }
              edges.push(edge)
            })
          })
        }
      }
    } else if (question.type === 'Rank_Fixed' || question.type === 'Rank_Upto') {
      // For Ranking, create child nodes from options
      // Only create child nodes if there is more than 1 option
      if (question.options && question.options.length > 1) {
        const childCount = question.options.length
        const totalHeight = childCount * childYSpacing
        const parentY = parentNode.position.y
        const centerOffset = parentY - (totalHeight / 2) + (childYSpacing / 2) // Center children around parent
        
        childNodes = question.options.map((option, optionIndex) => {
          const childNodeId = `${question.id}_${option.code}`
          const childVariableName = getVariableName(question.id, option.code, question.type)
          
          // Check if this code is part of the condition
          const hasCondition = conditionCodes.includes(option.code) || conditionCodes.includes(Number(option.code))
          
          return {
            id: childNodeId,
            type: 'code' as const,
            data: {
              label: childVariableName,
              questionId: question.id,
              code: option.code,
              hasCondition: hasCondition,
              optionLabel: option.label, // Store original option label for tooltip
            },
            position: {
              x: startX + questionIndex * xSpacing + childXOffset,
              y: centerOffset + optionIndex * childYSpacing,
            },
          }
        })
      }
    }
    
    // Add child nodes to graph
    nodes.push(...childNodes)
    
    // Store child nodes for this question (for creating flow edges later)
    questionChildNodesMap.set(question.id, childNodes)
    
    // Create F1 edges from parent to each child
    // Skip for MA_Grid as edges are already created (parent->intermediate->child)
    if (question.type !== 'MA_Grid' && childNodes.length > 0) {
      childNodes.forEach((childNode) => {
        const edge: LogicModelEdge = {
          id: `${parentNodeId}-${childNode.id}`,
          source: parentNodeId,
          target: childNode.id,
          type: 'F1',
          label: 'F1',
        }
        edges.push(edge)
      })
    }
  })
  
  // Create flow edges between questions based on logic
  // 1. F0 edges: Sequential flow between consecutive questions
  // Always create edge from parent to next question (for collapsed state)
  // If question has child nodes, also create edges from each child to next question (for expanded state)
  // Note: Skip creating F0 edge if:
  //   - nextQuestion has ask_if_condition (ASK_IF edge will be created from source question in section 2)
  //   - currentQuestion has ask_if_condition (currentQuestion flow is controlled by ASK_IF, not sequential)
  for (let i = 0; i < questions.length - 1; i++) {
    const currentQuestion = questions[i]
    const nextQuestion = questions[i + 1]
    const childNodes = questionChildNodesMap.get(currentQuestion.id) || []
    
    // Check if nextQuestion has ask_if_condition
    // If so, skip F0 edge from currentQuestion (ASK_IF edge will be created from source question in section 2)
    const nextHasAskIfCondition = !!nextQuestion.logic?.ask_if_condition
    
    // Check if currentQuestion has ask_if_condition
    // If so, skip F0 edge from currentQuestion (currentQuestion flow is controlled by ASK_IF edge, not sequential flow)
    const currentHasAskIfCondition = !!currentQuestion.logic?.ask_if_condition
    
    // Skip F0 edge if either nextQuestion or currentQuestion has ask_if_condition
    const shouldSkipF0Edge = nextHasAskIfCondition || currentHasAskIfCondition
    
    // Track whether we create parent F0 edge
    let parentEdgeCreated = false
    
    // Skip F0 edge if nextQuestion or currentQuestion has ask_if_condition
    // This ensures we only have ASK_IF edge controlling the flow, not sequential F0 edges
    if (!shouldSkipF0Edge) {
      const parentEdge: LogicModelEdge = {
        id: `flow_${currentQuestion.id}_${nextQuestion.id}`,
        source: currentQuestion.id,
        target: nextQuestion.id,
        type: 'F0',
        label: 'F0',
      }
      edges.push(parentEdge)
      parentEdgeCreated = true
    }
    
    // If question has child nodes, create F0 edges from each child to next question (shown when expanded)
    // IMPORTANT: Only create child F0 edges if parent F0 edge was created
    // If parent edge is missing (deleted or has ask_if_condition), child edges should also be missing
    if (childNodes.length > 0 && parentEdgeCreated) {
      childNodes.forEach((childNode) => {
        const childEdge: LogicModelEdge = {
          id: `flow_${childNode.id}_${nextQuestion.id}`,
          source: childNode.id,
          target: nextQuestion.id,
          type: 'F0',
          label: 'F0',
        }
        edges.push(childEdge)
      })
    }
  }
  
  // 2. ASK_IF edges: From source question (from piping_source or extracted from condition) to current question with ask_if_condition
  // Create ASK_IF edges when question has ask_if_condition
  // These edges replace the F0 edges from the source question to the question with ask_if_condition
  questions.forEach((question) => {
    if (question.logic?.ask_if_condition) {
      const askIfCondition = question.logic.ask_if_condition
      // Get source from piping_source if available, otherwise extract from condition
      const sourceId = question.logic.piping_source || extractSourceFromAskIfCondition(askIfCondition)
      const sourceNode = sourceId ? nodes.find(n => n.id === sourceId) : null
      
      if (sourceNode && sourceId) {
        // Create ASK_IF edge from source to target question
        // Label is "Ask if" (condition is hidden, shown in tooltip on hover)
        const askIfEdge: LogicModelEdge = {
          id: `askif_${sourceId}_${question.id}`,
          source: sourceId,
          target: question.id,
          type: 'ASK_IF',
          label: 'Ask if',
          condition: askIfCondition,
        }
        edges.push(askIfEdge)
      }
    }
  })
  
  // 3. PIPING edges: From piping_source to current question (for Grid questions without ask_if_condition)
  // Similar to F0 edges: create from parent (shown when collapsed), and from intermediate/child nodes (shown when expanded)
  questions.forEach((question) => {
    // Skip if this question has ask_if_condition (already handled by ASK_IF edges above)
    if (question.logic?.ask_if_condition) {
      return
    }
    
    if (question.logic?.piping_source) {
      const sourceId = question.logic.piping_source
      const sourceNode = nodes.find(n => n.id === sourceId)
      
      if (sourceNode) {
        // Always create parent → target question edge (shown when collapsed)
        const parentPipingEdge: LogicModelEdge = {
          id: `piping_${sourceId}_${question.id}`,
          source: sourceId,
          target: question.id,
          type: 'PIPING',
          label: 'Piping',
        }
        edges.push(parentPipingEdge)
        
        // Get intermediate nodes and child nodes for the source question
        const intermediateNodes = questionIntermediateNodesMap.get(sourceId) || []
        const childNodes = questionChildNodesMap.get(sourceId) || []
        
        // For MA_Grid: create PIPING edges from intermediate nodes (shown when expanded to intermediate level)
        if (intermediateNodes.length > 0) {
          intermediateNodes.forEach((intermediateNode) => {
            const pipingEdge: LogicModelEdge = {
              id: `piping_${intermediateNode.id}_${question.id}`,
              source: intermediateNode.id,
              target: question.id,
              type: 'PIPING',
              label: 'Piping',
            }
            edges.push(pipingEdge)
          })
        }
        
        // For all question types with child nodes: create PIPING edges from child nodes (shown when expanded to child level)
        // Note: For MA_Grid, child nodes are children of intermediate nodes, so they will be shown when expanded to child level
        if (childNodes.length > 0 && intermediateNodes.length === 0) {
          // Only create child PIPING edges if there are no intermediate nodes (non-MA_Grid questions)
          childNodes.forEach((childNode) => {
            const pipingEdge: LogicModelEdge = {
              id: `piping_${childNode.id}_${question.id}`,
              source: childNode.id,
              target: question.id,
              type: 'PIPING',
              label: 'Piping',
            }
            edges.push(pipingEdge)
          })
        } else if (childNodes.length > 0 && intermediateNodes.length > 0) {
          // For MA_Grid: create PIPING edges from child nodes (shown when expanded to child level)
          childNodes.forEach((childNode) => {
            const pipingEdge: LogicModelEdge = {
              id: `piping_${childNode.id}_${question.id}`,
              source: childNode.id,
              target: question.id,
              type: 'PIPING',
              label: 'Piping',
            }
            edges.push(pipingEdge)
          })
        }
      }
    }
  })
  
  // 3. ASK_IF edges are now created when creating terminate nodes (see section above where parentNode is created)
  // Removed old logic that created edges directly from questions
  
  return { nodes, edges }
}

