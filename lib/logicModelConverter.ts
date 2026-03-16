/**
 * Convert ParsedQuestions to Logic Model for React Flow
 * Creates parent nodes (questions) and child nodes (codes) with F1 connections
 * Layout: Horizontal flow from left to right (Q1, Q2, Q3...)
 */

import { ParsedQuestion, QuestionOption } from './types'
import { OldVariableMapping } from '@/lib/types'

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

  // Pattern 1b: Match SA direct equality Q2 = 2, Q2 = 3 (no R, extract value)
  // Example: "Q2 = 2 OR Q2 = 3 OR Q2 = 4" → [2, 3, 4]. (?!R) avoids matching Q2 in Q2R2.
  const escapedId = questionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const saEqPattern = new RegExp(`\\b${escapedId}(?!R)\\s*=\\s*(\\d+)`, 'gi')
  let saEqMatch: RegExpExecArray | null
  while ((saEqMatch = saEqPattern.exec(condition)) !== null) {
    const codeNum = parseInt(saEqMatch[1], 10)
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
    codeType?: QuestionOption['codeType'] // For code nodes: Normal, Trap, Terminate, etc.
    isTrapOrTerminate?: boolean // For code nodes: Trap/Terminate get red styling
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
        
    // REBUILD terminate_if from scratch - no recursive merge to prevent A or (A or B) duplication
    const trapAndTermOpts = (question.options || []).filter(o => o.codeType === 'Trap' || o.codeType === 'Terminate')
    const trapAndTermRows = (question.rows || []).filter(r => r.codeType === 'Trap' || r.codeType === 'Terminate')
    const opts = question.type === 'MA_Grid' || question.type === 'SA_Grid' || question.type === 'OE_Grid' ? trapAndTermRows : trapAndTermOpts

    let finalTerminateCondition: string | null = null
    if (opts.length > 0) {
      const isMA = question.type === 'MA' || question.type === 'MA_Grid'
      const conds = opts.map(opt => isMA ? `${question.id}R${opt.code} = ${opt.code}` : `${question.id} = ${opt.code}`)
      finalTerminateCondition = `IF (${conds.join(' OR ')})`
    } else {
      const existing = question.logic?.terminate_if?.trim()
      if (existing) {
        finalTerminateCondition = existing.startsWith('IF') ? existing : `IF (${existing})`
      }
    }

    const conditionCodes: (string | number)[] = opts.map(o => o.code).filter((c): c is string | number => c !== undefined && c !== null)
    
    // For Grid questions: add dimensions for aggregated smart node (no child nodes rendered)
    const isGridQuestion = question.type === 'MA_Grid' || question.type === 'SA_Grid' || question.type === 'OE_Grid'
    const gridDimensions = isGridQuestion
      ? {
          rows: question.rows?.length || 0,
          cols: question.columns?.length || question.options?.length || 0,
        }
      : undefined

    const parentNode: LogicModelNode = {
      id: parentNodeId,
      type: 'question',
      data: {
        label: parentVariableName,
        questionType: question.type,
        terminateIf: finalTerminateCondition || undefined,
        conditionCodes: conditionCodes.length > 0 ? conditionCodes : undefined,
        ...(gridDimensions && { gridDimensions }),
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
    // AGGREGATED SMART NODE: Skip child nodes for Grid questions (MA_Grid, SA_Grid, OE_Grid)
    // to prevent node explosion (e.g. 20x20 = 400 nodes). Only the parent QuestionNode is rendered.
    let childNodes: LogicModelNode[] = []

    if (!isGridQuestion) {
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
            
            // Check if this code is part of the condition (terminate_if, trap) or has codeType Trap/Terminate
            const hasCondition =
              conditionCodes.includes(option.code) ||
              conditionCodes.includes(Number(option.code)) ||
              option.codeType === 'Trap' ||
              option.codeType === 'Terminate'
            
            return {
              id: childNodeId,
              type: 'code' as const,
              data: {
                label: childVariableName,
                questionId: question.id,
                code: option.code,
                hasCondition: hasCondition,
                codeType: option.codeType,
                isTrapOrTerminate: option.codeType === 'Trap' || option.codeType === 'Terminate',
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
          
          const hasCondition =
            conditionCodes.includes(row.code) ||
            conditionCodes.includes(Number(row.code)) ||
            row.codeType === 'Trap' ||
            row.codeType === 'Terminate'
          
          return {
            id: childNodeId,
            type: 'code' as const,
            data: {
              label: childVariableName,
              questionId: question.id,
              code: row.code,
              hasCondition: hasCondition,
              codeType: row.codeType,
              isTrapOrTerminate: row.codeType === 'Trap' || row.codeType === 'Terminate',
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
            const rowHasCondition = row.codeType === 'Trap' || row.codeType === 'Terminate' || conditionCodes.includes(row.code) || conditionCodes.includes(Number(row.code))
            childNodes.push({
              id: childNodeId,
              type: 'code' as const,
              data: {
                label: childVariableName,
                questionId: question.id,
                code: `${col.code}_${row.code}`,
                parentId: intermediateNode.id,
                hasCondition: rowHasCondition,
                codeType: row.codeType,
                isTrapOrTerminate: row.codeType === 'Trap' || row.codeType === 'Terminate',
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
          
          const hasCondition =
            conditionCodes.includes(option.code) ||
            conditionCodes.includes(Number(option.code)) ||
            option.codeType === 'Trap' ||
            option.codeType === 'Terminate'
          
          return {
            id: childNodeId,
            type: 'code' as const,
            data: {
              label: childVariableName,
              questionId: question.id,
              code: option.code,
              hasCondition: hasCondition,
              codeType: option.codeType,
              isTrapOrTerminate: option.codeType === 'Trap' || option.codeType === 'Terminate',
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
    } // end !isGridQuestion

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
  
  // 1. F0 edges: Sequential flow — Parent-to-Parent only (reduces visual clutter)
  // Create exactly ONE F0 edge per question pair: currentQuestion.id → nextQuestion.id
  // Logic edges (Piping, Ask If, Skip Logic) remain untouched and originate from Option Nodes
  // Note: Skip F0 if nextQuestion or currentQuestion has ask_if_condition (ASK_IF controls flow)
  for (let i = 0; i < questions.length - 1; i++) {
    const currentQuestion = questions[i]
    const nextQuestion = questions[i + 1]
    const nextHasAskIfCondition = !!nextQuestion.logic?.ask_if_condition
    const currentHasAskIfCondition = !!currentQuestion.logic?.ask_if_condition
    const shouldSkipF0Edge = nextHasAskIfCondition || currentHasAskIfCondition

    if (!shouldSkipF0Edge) {
      edges.push({
        id: `flow_${currentQuestion.id}_${nextQuestion.id}`,
        source: currentQuestion.id,
        target: nextQuestion.id,
        type: 'F0',
        label: 'F0',
      })
    }
  }
  
  // 2. ASK_IF edges: From source question (from piping_source or extracted from condition) to current question with ask_if_condition
  // For SA/MA: create edges from option nodes (Q2R2, Q2R3, Q2R4) - NOT from parent
  // For Grid/Numeric/Text: create single edge from parent with condition in edge.data
  questions.forEach((question) => {
    if (question.logic?.ask_if_condition) {
      const askIfCondition = question.logic.ask_if_condition
      // Get source from piping_source if available, otherwise extract from condition
      const sourceId = question.logic.piping_source || extractSourceFromAskIfCondition(askIfCondition)
      const sourceQuestion = sourceId ? questions.find(q => q.id === sourceId) : null
      const sourceNode = sourceId ? nodes.find(n => n.id === sourceId) : null

      if (!sourceId || !sourceNode) return

      const childNodes = questionChildNodesMap.get(sourceId) || []
      const isSAMaOrRank = sourceQuestion && ['SA', 'MA', 'OE', 'Rank_Fixed', 'Rank_Upto'].includes(sourceQuestion.type)
      const extractedCodes = extractCodesFromCondition(askIfCondition, sourceId)

      if (isSAMaOrRank && extractedCodes.length > 0) {
        // SA/MA: create edges from each option node (Q2R2, Q2R3, Q2R4) - only for codes that exist
        const validChildIds = new Set(childNodes.map(c => c.id))
        for (const code of extractedCodes) {
          const optionNodeId = sourceQuestion!.type === 'Rank_Fixed' || sourceQuestion!.type === 'Rank_Upto'
            ? `${sourceId}_${code}`
            : `${sourceId}R${code}`
          if (validChildIds.has(optionNodeId)) {
            edges.push({
              id: `askif_${optionNodeId}_${question.id}`,
              source: optionNodeId,
              target: question.id,
              type: 'ASK_IF',
              label: 'Ask if',
              condition: askIfCondition,
            })
          }
        }
      } else {
        // Grid, Numeric, Text, or no extracted codes: single edge from parent
        edges.push({
          id: `askif_${sourceId}_${question.id}`,
          source: sourceId,
          target: question.id,
          type: 'ASK_IF',
          label: 'Ask if',
          condition: askIfCondition,
        })
      }
    }
  })
  
  // Helper: extract code from piping source node ID (Q7R3 -> "3", Q7_1 -> "1")
  const extractCodeFromPipingSource = (sourceNodeId: string): string | null => {
    const rMatch = sourceNodeId.match(/R(\d+)$/)
    if (rMatch) return rMatch[1]
    const uMatch = sourceNodeId.match(/_(\d+)$/)
    return uMatch ? uMatch[1] : null
  }

  // Helper: is this source code allowed for the target question? (1-to-1 binding)
  const isPipingCodeAllowed = (sourceNodeId: string, targetQuestion: ParsedQuestion): boolean => {
    const code = extractCodeFromPipingSource(sourceNodeId)
    if (!code) return true
    const excluded = new Set((targetQuestion.logic?.piping_excluded_codes || []).map(String))
    if (excluded.has(code)) return false
    if (targetQuestion.type === 'MA_Grid' && targetQuestion.columns) {
      const validCodes = new Set(targetQuestion.columns.map((c) => String(c.code)))
      return validCodes.has(code)
    }
    return true
  }

  // 3. PIPING edges: From piping_source to current question (for Grid questions without ask_if_condition)
  // Bi-directional sync: filter by piping_excluded_codes (edge deletion) and target columns (column deletion)
  questions.forEach((question) => {
    if (question.logic?.ask_if_condition) return
    if (!question.logic?.piping_source) return

    const sourceId = question.logic.piping_source
    const sourceNode = nodes.find((n) => n.id === sourceId)
    if (!sourceNode) return

    const intermediateNodes = questionIntermediateNodesMap.get(sourceId) || []
    const childNodes = questionChildNodesMap.get(sourceId) || []

    // Parent edge (shown when collapsed) - always create when piping_source exists
    edges.push({
      id: `piping_${sourceId}_${question.id}`,
      source: sourceId,
      target: question.id,
      type: 'PIPING',
      label: 'Piping',
    })

    if (intermediateNodes.length > 0) {
      intermediateNodes.forEach((intermediateNode) => {
        if (!isPipingCodeAllowed(intermediateNode.id, question)) return
        edges.push({
          id: `piping_${intermediateNode.id}_${question.id}`,
          source: intermediateNode.id,
          target: question.id,
          type: 'PIPING',
          label: 'Piping',
        })
      })
    }

    if (childNodes.length > 0 && intermediateNodes.length === 0) {
      childNodes.forEach((childNode) => {
        if (!isPipingCodeAllowed(childNode.id, question)) return
        edges.push({
          id: `piping_${childNode.id}_${question.id}`,
          source: childNode.id,
          target: question.id,
          type: 'PIPING',
          label: 'Piping',
        })
      })
    } else if (childNodes.length > 0 && intermediateNodes.length > 0) {
      childNodes.forEach((childNode) => {
        if (!isPipingCodeAllowed(childNode.id, question)) return
        edges.push({
          id: `piping_${childNode.id}_${question.id}`,
          source: childNode.id,
          target: question.id,
          type: 'PIPING',
          label: 'Piping',
        })
      })
    }
  })
  
  // 3. ASK_IF edges are now created when creating terminate nodes (see section above where parentNode is created)
  // Removed old logic that created edges directly from questions
  
  return { nodes, edges }
}

