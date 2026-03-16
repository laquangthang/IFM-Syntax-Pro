/**
 * Convert ParsedQuestions to QC Logic Graph
 * Automatically creates nodes and edges based on question logic
 */

import { ParsedQuestion, QuestionLogic } from './types'
import { QCNode, QCEdge, QCLogicGraph, VariableType, EdgeType } from './qcLogicTypes'

/**
 * Map ParsedQuestion type to QC VariableType
 */
function mapQuestionTypeToVariableType(type: ParsedQuestion['type']): VariableType {
  switch (type) {
    case 'SA':
      return 'SA'
    case 'MA':
      return 'MA'
    case 'SA_Grid':
      return 'SA_GRID'
    case 'MA_Grid':
      return 'MA_GRID'
    case 'OE':
    case 'OE_Grid':
      return 'OE'
    case 'Rank_Fixed':
      return 'RANKING_FIXED'
    case 'Rank_Upto':
      return 'RANKING_ALL'
    default:
      return 'UNCLASSIFIED'
  }
}

/**
 * Parse terminate_if condition to extract source question and condition
 * Supports formats:
 *   - Q3 = 1
 *   - Q3 = 1 or Q3 = 2
 *   - (Q3 = 1 or Q3 = 2)
 *   - Q3R1 = 1
 *   - IF (Q3 = 1)
 *   - IF NOT(Q3 = 1)
 */
function parseTerminateCondition(terminateIf: string | null | undefined): Array<{ sourceId: string, condition: string }> {
  if (!terminateIf) return []
  
  const results: Array<{ sourceId: string, condition: string }> = []
  
  // Remove "IF" prefix if present
  let conditionStr = terminateIf.replace(/^IF\s+/i, '').trim()
  
  // Handle "IF NOT" - extract the NOT part
  const hasNot = /^NOT\s+/i.test(conditionStr)
  if (hasNot) {
    conditionStr = conditionStr.replace(/^NOT\s+/i, '').trim()
  }
  
  // Remove outer parentheses if present: (Q3 = 1) -> Q3 = 1
  if (conditionStr.startsWith('(') && conditionStr.endsWith(')')) {
    // Check if it's a single outer parentheses (not nested)
    let depth = 0
    let isOuterOnly = true
    for (let i = 1; i < conditionStr.length - 1; i++) {
      if (conditionStr[i] === '(') depth++
      else if (conditionStr[i] === ')') depth--
      if (depth < 0) {
        isOuterOnly = false
        break
      }
    }
    if (isOuterOnly && depth === 0) {
      conditionStr = conditionStr.slice(1, -1).trim()
    }
  }
  
  // Split by "or" / "OR" to get individual conditions
  const conditions: string[] = []
  let currentCondition = ''
  let parenDepth = 0
  
  for (let i = 0; i < conditionStr.length; i++) {
    const char = conditionStr[i]
    if (char === '(') parenDepth++
    else if (char === ')') parenDepth--
    else if (parenDepth === 0 && conditionStr.slice(i, i + 2).toUpperCase() === 'OR') {
      if (currentCondition.trim()) {
        conditions.push(currentCondition.trim())
        currentCondition = ''
      }
      i += 1 // Skip "OR"
      continue
    }
    currentCondition += char
  }
  
  if (currentCondition.trim()) {
    conditions.push(currentCondition.trim())
  }
  
  // If no OR found, treat the whole string as one condition
  if (conditions.length === 0) {
    conditions.push(conditionStr)
  }
  
  // Parse each condition: Q3 = 1, Q3R1 = 1, etc.
  conditions.forEach(cond => {
    // Pattern to match question IDs: Q1, Q2, Q8_1, H1, Q3R1, etc.
    const questionMatch = cond.match(/(Q|H)(\d+[A-Za-z0-9_.]*)(?:R([A-Z0-9]+))?/i)
    if (questionMatch) {
      // Extract base question ID (Q3, Q1, H1, etc.)
      const baseQId = `${questionMatch[1]}${questionMatch[2]}`
      const rowCode = questionMatch[3] // R1, etc.
      
      // Extract operator and value: = 1, != 2, etc.
      const operatorMatch = cond.match(/([=!<>]+)\s*(\d+)/)
      const operator = operatorMatch ? operatorMatch[1] : '='
      const value = operatorMatch ? operatorMatch[2] : ''
      
      // Build condition string
      let condition = ''
      if (rowCode) {
        condition = `${baseQId}R${rowCode} ${operator} ${value}`.trim()
      } else {
        condition = `${baseQId} ${operator} ${value}`.trim()
      }
      
      // Use base question ID as source (not the full Q3R1)
      results.push({ 
        sourceId: baseQId, 
        condition: condition || cond 
      })
    } else {
      // Fallback: try to extract any question ID
      const fallbackMatch = cond.match(/(Q|H)(\d+[A-Za-z0-9_.]*)/i)
      if (fallbackMatch) {
        results.push({ 
          sourceId: fallbackMatch[0], 
          condition: cond 
        })
      }
    }
  })
  
  return results
}

/**
 * Parse ask_if_condition to extract source questions and conditions
 * Supports multiple conditions with AND/OR: IF (Q1 = 1) AND (Q2 = 2) OR (Q3 = 3)
 * Format examples:
 *   - IF (Q5R6 = 6 OR Q5R7 = 7)
 *   - IF (Q1RX = 1)
 *   - IF NOT (Q1RX = 1)
 * Returns array of { sourceId, condition } pairs
 */
function parseAskIfCondition(askIf: string | null | undefined): Array<{ sourceId: string, condition: string }> {
  if (!askIf) return []
  
  const results: Array<{ sourceId: string, condition: string }> = []
  
  // Remove "IF" prefix if present
  let conditionStr = askIf.replace(/^IF\s+/i, '').trim()
  
  // Handle "IF NOT" - extract the NOT part
  const hasNot = /^NOT\s+/i.test(conditionStr)
  if (hasNot) {
    conditionStr = conditionStr.replace(/^NOT\s+/i, '').trim()
  }
  
  // Remove outer parentheses if present: (Q1 = 1) -> Q1 = 1
  if (conditionStr.startsWith('(') && conditionStr.endsWith(')')) {
    conditionStr = conditionStr.slice(1, -1).trim()
  }
  
  // Split by AND/OR to get individual conditions
  // Pattern: Match AND/OR that are not inside parentheses
  const conditions: string[] = []
  let currentCondition = ''
  let parenDepth = 0
  
  for (let i = 0; i < conditionStr.length; i++) {
    const char = conditionStr[i]
    if (char === '(') parenDepth++
    else if (char === ')') parenDepth--
    else if (parenDepth === 0 && (conditionStr.slice(i, i + 3).toUpperCase() === 'AND' || conditionStr.slice(i, i + 2).toUpperCase() === 'OR')) {
      if (currentCondition.trim()) {
        conditions.push(currentCondition.trim())
        currentCondition = ''
      }
      // Skip the AND/OR
      if (conditionStr.slice(i, i + 3).toUpperCase() === 'AND') {
        i += 2 // Skip "AND"
      } else {
        i += 1 // Skip "OR"
      }
      continue
    }
    currentCondition += char
  }
  
  if (currentCondition.trim()) {
    conditions.push(currentCondition.trim())
  }
  
  // If no AND/OR found, treat the whole string as one condition
  if (conditions.length === 0) {
    conditions.push(conditionStr)
  }
  
  // Parse each condition: Q5R6 = 6, Q1RX = 1, etc.
  conditions.forEach(cond => {
    // Pattern to match question IDs: Q1, Q2, Q8_1, H1, Q5R6, Q1RX, etc.
    const questionMatch = cond.match(/(Q|H)(\d+[A-Za-z0-9_.]*)(?:R([A-Z0-9]+))?/i)
    if (questionMatch) {
      // Extract base question ID (Q5, Q1, H1, etc.)
      const baseQId = `${questionMatch[1]}${questionMatch[2]}`
      const rowCode = questionMatch[3] // R6, RX, etc.
      
      // Extract operator and value: = 6, != 2, etc.
      const operatorMatch = cond.match(/([=!<>]+)\s*(\d+)/)
      const operator = operatorMatch ? operatorMatch[1] : '='
      const value = operatorMatch ? operatorMatch[2] : ''
      
      // Build condition string
      let condition = ''
      if (rowCode) {
        condition = `${baseQId}R${rowCode} ${operator} ${value}`.trim()
      } else {
        condition = `${baseQId} ${operator} ${value}`.trim()
      }
      
      // Use base question ID as source (not the full Q5R6)
      results.push({ 
        sourceId: baseQId, 
        condition: condition || cond 
      })
    } else {
      // Fallback: try to extract any question ID
      const fallbackMatch = cond.match(/(Q|H)(\d+[A-Za-z0-9_.]*)/i)
      if (fallbackMatch) {
        results.push({ 
          sourceId: fallbackMatch[0], 
          condition: cond 
        })
      }
    }
  })
  
  return results
}

/**
 * Convert a ParsedQuestion to QCNode(s)
 * For Grid questions, creates multiple nodes (parent + children)
 */
function questionToNodes(question: ParsedQuestion): QCNode[] {
  const nodes: QCNode[] = []
  
  const variableType = mapQuestionTypeToVariableType(question.type)
  
  // Create main node
  const mainNode: QCNode = {
    id: question.id,
    name: question.id,
    type: variableType,
    position: { x: 0, y: 0 }, // Will be positioned by layout algorithm
  }
  
  // Set properties based on question type
  if (question.type === 'Rank_Fixed' || question.type === 'Rank_Upto') {
    mainNode.fixedValue = question.limit
  }
  
  // For MA questions, set min/max based on options count
  if (question.type === 'MA' && question.options) {
    mainNode.minValue = 1 // Default: must select at least one
  }
  
  nodes.push(mainNode)
  
  // For Grid questions, create child nodes
  if (question.type === 'MA_Grid' && question.columns && question.rows) {
    // MA_Grid: Create intermediate row nodes and item nodes
    question.rows.forEach((row, rowIndex) => {
      const rowId = `${question.id}_R${row.code}`
      const rowNode: QCNode = {
        id: rowId,
        name: rowId,
        type: 'MA',
        position: { x: 0, y: 0 },
      }
      nodes.push(rowNode)
      
      // Create item nodes for each column in this row
      question.columns?.forEach((col, colIndex) => {
        const itemId = `${question.id}_${col.code}R${row.code}`
        const itemNode: QCNode = {
          id: itemId,
          name: itemId,
          type: 'MA',
          position: { x: 0, y: 0 },
        }
        nodes.push(itemNode)
      })
    })
  } else if (question.type === 'SA_Grid' || question.type === 'OE_Grid') {
    // SA_Grid and OE_Grid: Create nodes for rows/options
    const items = question.rows || question.options || []
    
    items.forEach((item, index) => {
      const childId = `${question.id}_${item.code}`
      const childNode: QCNode = {
        id: childId,
        name: childId,
        type: variableType === 'SA_GRID' ? 'SA' : 'OE',
        position: { x: 0, y: 0 },
      }
      nodes.push(childNode)
    })
  } else if (question.type === 'MA' && question.options) {
    // For regular MA, create child nodes for each option
    question.options.forEach((option) => {
      // Skip _O options (they are handled separately)
      if (String(option.code).endsWith('_O')) return
      
      const childId = `${question.id}R${option.code}`
      const childNode: QCNode = {
        id: childId,
        name: childId,
        type: 'SA', // Each option is like a single answer (0 or 1)
        position: { x: 0, y: 0 },
      }
      nodes.push(childNode)
    })
  } else if ((question.type === 'Rank_Fixed' || question.type === 'Rank_Upto') && question.options) {
    // For Ranking, create child nodes
    question.options.forEach((option) => {
      if (String(option.code).endsWith('_O')) return
      
      const childId = `${question.id}_${option.code}`
      const childNode: QCNode = {
        id: childId,
        name: childId,
        type: 'SA',
        position: { x: 0, y: 0 },
      }
      nodes.push(childNode)
    })
  }
  
  return nodes
}

/**
 * Create edges from question logic
 */
function createEdgesFromLogic(
  question: ParsedQuestion,
  questionsMap: Map<string, ParsedQuestion>,
  allNodes: Map<string, QCNode>
): QCEdge[] {
  const edges: QCEdge[] = []
  
  // Handle piping_source (PIPING edge)
  // Note: If ask_if_condition exists, it will create ASK_IF edges instead
  // PIPING edge is only created if there's piping_source but no ask_if_condition
  if (question.logic?.piping_source && !question.logic?.ask_if_condition) {
    const sourceId = question.logic.piping_source
    const sourceNode = allNodes.get(sourceId)
    
    if (sourceNode) {
      edges.push({
        id: `edge_${sourceId}_${question.id}_piping`,
        from: sourceId,
        to: question.id,
        type: 'PIPING',
        label: 'Piping',
      })
    }
  }
  
  // Handle ask_if_condition (ASK_IF edge with condition)
  // This takes priority over piping_source for ASK_IF edges
  if (question.logic?.ask_if_condition) {
    const askIfConditions = parseAskIfCondition(question.logic.ask_if_condition)
    
    askIfConditions.forEach((askIfInfo, index) => {
      const sourceNode = allNodes.get(askIfInfo.sourceId)
      if (sourceNode) {
        edges.push({
          id: `edge_${askIfInfo.sourceId}_${question.id}_askif${index > 0 ? `_${index}` : ''}`,
          from: askIfInfo.sourceId,
          to: question.id,
          type: 'ASK_IF',
          label: 'Ask If',
          condition: {
            type: 'comparison',
            operator: '=',
            value: askIfInfo.condition,
          },
        })
      }
    })
  }
  
  // Handle terminate_if (ASK_IF edge with condition)
  // Also check for options with codeType = 'Terminate' if terminate_if is not set
  let terminateConditions: Array<{ sourceId: string, condition: string }> = []
  
  if (question.logic?.terminate_if) {
    terminateConditions = parseTerminateCondition(question.logic.terminate_if)
  } else if (question.options) {
    // If no terminate_if but has options with codeType = 'Terminate', create conditions
    const terminateOptions = question.options.filter(opt => opt.codeType === 'Terminate')
    if (terminateOptions.length > 0) {
      const isMA = question.type === 'MA' || question.type === 'MA_Grid'
      terminateOptions.forEach(opt => {
        if (opt.code !== undefined && opt.code !== null) {
          const code = String(opt.code)
          const condition = isMA ? `${question.id}R${code} = ${code}` : `${question.id} = ${code}`
          terminateConditions.push({
            sourceId: question.id,
            condition: condition
          })
        }
      })
    }
  }
  
  // Group terminate conditions by sourceId to avoid duplicate edges
  const terminateBySource = new Map<string, string[]>()
  terminateConditions.forEach(terminateInfo => {
    if (!terminateBySource.has(terminateInfo.sourceId)) {
      terminateBySource.set(terminateInfo.sourceId, [])
    }
    terminateBySource.get(terminateInfo.sourceId)!.push(terminateInfo.condition)
  })
  
  // Create edges for each unique source
  terminateBySource.forEach((conditions, sourceId) => {
    const sourceNode = allNodes.get(sourceId)
    const terminateNode = allNodes.get('TERMINATE')
    
    if (!sourceNode || !terminateNode) return
    
    // Combine all conditions for this source into one condition string
    const combinedCondition = conditions.length === 1 
      ? conditions[0] 
      : `(${conditions.join(' or ')})`
    
    // Determine if this is a self-terminate (terminate condition from the same question)
    const isSelfTerminate = sourceId === question.id
    
    edges.push({
      id: `edge_${sourceId}_TERMINATE${isSelfTerminate ? '_self' : ''}`,
      from: sourceId,
      to: 'TERMINATE',
      type: 'ASK_IF',
      label: 'Terminate If', // Explicit label for terminate conditions
      condition: {
        type: 'comparison',
        operator: '=',
        value: combinedCondition,
      },
    })
  })
  
  // Create hierarchy edges for Grid questions
  if (question.type === 'SA_Grid' || question.type === 'OE_Grid') {
    const items = question.rows || question.options || []
    
    items.forEach((item, index) => {
      const childId = `${question.id}_${item.code}`
      const childNode = allNodes.get(childId)
      
      if (childNode) {
        edges.push({
          id: `edge_${question.id}_${childId}_f1`,
          from: question.id,
          to: childId,
          type: 'F1',
          label: 'F1',
        })
      }
    })
  } else if (question.type === 'MA_Grid' && question.columns && question.rows) {
    // MA_Grid: Parent -> Rows (F1) -> Items (F2)
    question.rows.forEach((row) => {
      const rowId = `${question.id}_R${row.code}`
      const rowNode = allNodes.get(rowId)
      
      if (rowNode) {
        // F1: Parent to Row
        edges.push({
          id: `edge_${question.id}_${rowId}_f1`,
          from: question.id,
          to: rowId,
          type: 'F1',
          label: 'F1',
        })
        
        // F2: Row to Items (columns)
        question.columns?.forEach((col) => {
          const itemId = `${question.id}_${col.code}R${row.code}`
          const itemNode = allNodes.get(itemId)
          
          if (itemNode) {
            edges.push({
              id: `edge_${rowId}_${itemId}_f2`,
              from: rowId,
              to: itemId,
              type: 'F2',
              label: 'F2',
            })
          }
        })
      }
    })
  } else if (question.type === 'MA' && question.options) {
    // MA: Parent to Options (F1)
    question.options.forEach((option) => {
      if (String(option.code).endsWith('_O')) return
      
      const childId = `${question.id}R${option.code}`
      const childNode = allNodes.get(childId)
      
      if (childNode) {
        edges.push({
          id: `edge_${question.id}_${childId}_f1`,
          from: question.id,
          to: childId,
          type: 'F1',
          label: 'F1',
        })
      }
    })
  } else if ((question.type === 'Rank_Fixed' || question.type === 'Rank_Upto') && question.options) {
    // Ranking: Parent to Options (F1)
    question.options.forEach((option) => {
      if (String(option.code).endsWith('_O')) return
      
      const childId = `${question.id}_${option.code}`
      const childNode = allNodes.get(childId)
      
      if (childNode) {
        edges.push({
          id: `edge_${question.id}_${childId}_f1`,
          from: question.id,
          to: childId,
          type: 'F1',
          label: 'F1',
        })
      }
    })
  }
  
  // Handle Ask All logic (ASK_IF edge from previous question)
  if (question.logic?.type === 'Ask All') {
    // Find previous question in sequence
    const questionNum = parseInt(question.id.replace(/\D/g, '')) || 0
    if (questionNum > 1) {
      // This is a simplified approach - in practice, you'd need to track sequence
      // For now, we'll skip automatic Ask All edges as they depend on questionnaire flow
    }
  }
  
  return edges
}

/**
 * Extract question number from node ID (e.g., "Q10" -> 10, "Q13B" -> 13)
 */
function getQuestionNumber(nodeId: string): number {
  const match = nodeId.match(/Q(\d+)/i)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * Check if node is a main question node (not a child node like Q5R1, Q5_1, etc.)
 */
function isMainQuestionNode(nodeId: string): boolean {
  // Main question nodes are like Q1, Q2, Q10, Q13B (no R, no underscore with number after)
  return /^Q\d+[A-Za-z]*$/.test(nodeId)
}

/**
 * Hierarchical layout algorithm with branch separation for piping
 * - Arranges nodes from left to right following question flow
 * - Separates piping branches to avoid overlapping edges
 * - Groups nodes by layers (columns) based on dependencies
 */
function layoutNodesHierarchical(nodes: QCNode[], edges: QCEdge[]): void {
  const nodeMap = new Map<string, QCNode>()
  nodes.forEach(node => nodeMap.set(node.id, node))

  // Build adjacency lists
  const outgoingEdges = new Map<string, QCEdge[]>()
  const incomingEdges = new Map<string, QCEdge[]>()
  
  edges.forEach(edge => {
    if (!outgoingEdges.has(edge.from)) {
      outgoingEdges.set(edge.from, [])
    }
    outgoingEdges.get(edge.from)!.push(edge)
    
    if (!incomingEdges.has(edge.to)) {
      incomingEdges.set(edge.to, [])
    }
    incomingEdges.get(edge.to)!.push(edge)
  })
  
  // Separate main question nodes and child nodes
  const mainNodes = nodes.filter(n => isMainQuestionNode(n.id))
  const childNodes = nodes.filter(n => !isMainQuestionNode(n.id))

  // Sort main nodes by question number
  mainNodes.sort((a, b) => {
    const numA = getQuestionNumber(a.id)
    const numB = getQuestionNumber(b.id)
    if (numA !== numB) return numA - numB
    return a.id.localeCompare(b.id)
  })

  // Assign layers (columns) using topological sort
  const layers: QCNode[][] = []
  const nodeLayer = new Map<string, number>()
  const visiting = new Set<string>() // Track nodes currently being processed to detect cycles

  // Initialize layers for nodes with no incoming edges (or only F1/F2 edges)
  function getLayer(nodeId: string): number {
    // If already computed, return it
    if (nodeLayer.has(nodeId)) {
      return nodeLayer.get(nodeId)!
    }

    // Detect circular dependency
    if (visiting.has(nodeId)) {
      console.warn(`⚠️ [Layout] Circular dependency detected for ${nodeId}, assigning layer 0`)
      nodeLayer.set(nodeId, 0)
      return 0
    }

    visiting.add(nodeId)

    const incoming = incomingEdges.get(nodeId) || []
    // Filter out hierarchy edges (F1, F2) - they don't affect horizontal positioning
    const nonHierarchyIncoming = incoming.filter(e => e.type !== 'F1' && e.type !== 'F2')
    
    if (nonHierarchyIncoming.length === 0) {
      nodeLayer.set(nodeId, 0)
      visiting.delete(nodeId)
      return 0
    }

    // Find max layer from dependencies
    let maxLayer = -1
    for (const edge of nonHierarchyIncoming) {
      // Only process if it's a main question node (not child nodes)
      if (isMainQuestionNode(edge.from)) {
        const depLayer = getLayer(edge.from)
        maxLayer = Math.max(maxLayer, depLayer)
      }
    }

    visiting.delete(nodeId)
    const layer = maxLayer + 1
    nodeLayer.set(nodeId, layer)
    return layer
  }

  // Assign layers to all main nodes
  mainNodes.forEach(node => {
    getLayer(node.id)
  })

  // Group main nodes by layer
  const maxLayer = Math.max(...Array.from(nodeLayer.values()), 0)
  for (let i = 0; i <= maxLayer; i++) {
    layers[i] = []
  }

  mainNodes.forEach(node => {
    const layer = nodeLayer.get(node.id) || 0
    layers[layer].push(node)
  })

  // If all nodes are in the same layer (layer 0), distribute them across multiple layers
  // to create a left-to-right flow based on question order
  if (maxLayer === 0 && mainNodes.length > 1) {
    // Redistribute nodes across layers based on question order
    // Use more layers for better horizontal spread
    const targetLayers = Math.min(Math.ceil(mainNodes.length / 2), 5) // Max 5 layers
    const nodesPerLayer = Math.ceil(mainNodes.length / targetLayers)
    layers.length = 0 // Clear existing layers
    
    mainNodes.forEach((node, index) => {
      const newLayer = Math.min(Math.floor(index / nodesPerLayer), targetLayers - 1)
      if (!layers[newLayer]) {
        layers[newLayer] = []
      }
      layers[newLayer].push(node)
      nodeLayer.set(node.id, newLayer)
    })
  }

  // Ensure layers are properly initialized (remove empty layers at the end)
  while (layers.length > 0 && layers[layers.length - 1].length === 0) {
    layers.pop()
  }

  // Layout constants
  const LAYER_WIDTH = 350  // Horizontal spacing between layers
  const NODE_HEIGHT = 100  // Vertical spacing between nodes in same layer
  const BRANCH_SPACING = 250  // Extra spacing for piping branches
  const START_X = 200
  const START_Y = 100

  // Position main nodes
  layers.forEach((layerNodes, layerIndex) => {
    if (layerNodes.length === 0) return
    
    // Sort nodes in layer by question number
    layerNodes.sort((a, b) => {
      const numA = getQuestionNumber(a.id)
      const numB = getQuestionNumber(b.id)
      if (numA !== numB) return numA - numB
      return a.id.localeCompare(b.id)
    })

    // Group nodes by their primary source (for piping branches)
    // A node can have multiple sources, but we prioritize the primary piping source
    const sourceGroups = new Map<string, QCNode[]>()
    const nodeToSource = new Map<string, string>()
    
    layerNodes.forEach(node => {
      const incoming = incomingEdges.get(node.id) || []
      const pipingEdges = incoming.filter(e => e.type === 'PIPING')
      
      if (pipingEdges.length > 0) {
        // Use the first piping source as primary (or the one with highest question number for consistency)
        const primarySource = pipingEdges
          .map(e => e.from)
          .sort((a, b) => getQuestionNumber(b) - getQuestionNumber(a))[0]
        
        nodeToSource.set(node.id, primarySource)
        
        if (!sourceGroups.has(primarySource)) {
          sourceGroups.set(primarySource, [])
        }
        sourceGroups.get(primarySource)!.push(node)
      } else {
        // No piping source - default group
        nodeToSource.set(node.id, '_default')
        if (!sourceGroups.has('_default')) {
          sourceGroups.set('_default', [])
        }
        sourceGroups.get('_default')!.push(node)
      }
    })
    

    // Sort source groups: default first, then by source question number
    const sortedSources = Array.from(sourceGroups.keys()).sort((a, b) => {
      if (a === '_default') return -1
      if (b === '_default') return 1
      return getQuestionNumber(a) - getQuestionNumber(b)
    })

    // Calculate positions for each group
    // Start from center and expand outward for better visual balance
    const totalGroups = sortedSources.length
    const totalNodesInLayer = layerNodes.length
    const estimatedHeight = totalNodesInLayer * NODE_HEIGHT + (totalGroups - 1) * BRANCH_SPACING
    let currentY = START_Y + Math.max(0, (estimatedHeight - totalNodesInLayer * NODE_HEIGHT) / 2)
    
    const groupPositions: { nodes: QCNode[], y: number, sourceId: string }[] = []

    sortedSources.forEach((sourceId, groupIndex) => {
      const groupNodes = sourceGroups.get(sourceId) || []
      
      // Sort group nodes by question number
      groupNodes.sort((a, b) => {
        const numA = getQuestionNumber(a.id)
        const numB = getQuestionNumber(b.id)
        if (numA !== numB) return numA - numB
        return a.id.localeCompare(b.id)
      })

      // Add spacing between branches (except for first group)
      if (groupIndex > 0) {
        currentY += BRANCH_SPACING
      }

      groupPositions.push({ nodes: groupNodes, y: currentY, sourceId })
      currentY += groupNodes.length * NODE_HEIGHT
    })

    // Position nodes in this layer
    groupPositions.forEach(({ nodes: groupNodes, y: groupY, sourceId }) => {
      groupNodes.forEach((node, index) => {
        const x = START_X + layerIndex * LAYER_WIDTH
        const y = groupY + index * NODE_HEIGHT
        node.position = { x, y }
      })
    })
  })

  // Position child nodes (Q5R1, Q5_1, etc.) near their parent
  childNodes.forEach(childNode => {
    // Find parent node ID (e.g., Q5R1 -> Q5, Q5_1 -> Q5)
    const parentMatch = childNode.id.match(/^(Q\d+[A-Za-z]*)/)
    if (parentMatch) {
      const parentId = parentMatch[1]
      const parentNode = nodeMap.get(parentId)
      
      if (parentNode && parentNode.position) {
        // Position child nodes to the right of parent, slightly offset vertically
        const childIndex = childNodes.filter(c => {
          const match = c.id.match(/^(Q\d+[A-Za-z]*)/)
          return match && match[1] === parentId
        }).indexOf(childNode)
        
        childNode.position = {
          x: parentNode.position.x + 250,
          y: parentNode.position.y + childIndex * 80,
        }
      } else {
        // Fallback: position at end
        childNode.position = {
          x: START_X + (layers.length + 1) * LAYER_WIDTH,
          y: START_Y + childNodes.indexOf(childNode) * NODE_HEIGHT,
        }
      }
    } else {
      // Fallback positioning
      childNode.position = {
        x: START_X + (layers.length + 1) * LAYER_WIDTH,
        y: START_Y + childNodes.indexOf(childNode) * NODE_HEIGHT,
      }
    }
  })
  
  // Position TERMINATE node at the bottom right
  const terminateNode = nodeMap.get('TERMINATE')
  if (terminateNode) {
    const maxX = Math.max(...nodes.filter(n => n.position).map(n => n.position!.x), START_X)
    const maxY = Math.max(...nodes.filter(n => n.position && n.id !== 'TERMINATE').map(n => n.position!.y), START_Y)
    terminateNode.position = {
      x: maxX + LAYER_WIDTH,
      y: maxY + 200, // Position below the main flow
    }
  }
  
  // Final check: verify all nodes have positions
  const nodesWithoutPosition = nodes.filter(n => !n.position)
  if (nodesWithoutPosition.length > 0) {
    console.warn(`⚠️ [Layout] ${nodesWithoutPosition.length} nodes without position:`, nodesWithoutPosition.map(n => n.id))
  } else {
  }
}

/**
 * Convert ParsedQuestions array to QC Logic Graph
 */
export function convertQuestionsToQCGraph(questions: ParsedQuestion[]): QCLogicGraph {
  const allNodes: QCNode[] = []
  const allEdges: QCEdge[] = []
  const nodesMap = new Map<string, QCNode>()
  const questionsMap = new Map<string, ParsedQuestion>()
  
  // Create questions map for lookup
  questions.forEach(q => {
    questionsMap.set(q.id, q)
  })
  
  // Convert each question to nodes
  questions.forEach(question => {
    const nodes = questionToNodes(question)
    allNodes.push(...nodes)
    
    // Add to nodes map
    nodes.forEach(node => {
      nodesMap.set(node.id, node)
    })
  })
  
  // Create a terminate node if there are any terminate conditions
  const hasTerminateConditions = questions.some(q => 
    q.logic?.terminate_if || 
    (q.options && q.options.some(opt => opt.codeType === 'Terminate'))
  )
  
  if (hasTerminateConditions) {
    const terminateNode: QCNode = {
      id: 'TERMINATE',
      name: 'TERMINATE',
      type: 'UNCLASSIFIED',
      position: { x: 0, y: 0 },
    }
    allNodes.push(terminateNode)
    nodesMap.set('TERMINATE', terminateNode)
  }
  
  // Create edges from logic
  questions.forEach(question => {
    const edges = createEdgesFromLogic(question, questionsMap, nodesMap)
    allEdges.push(...edges)
  })
  
  // Advanced layout: hierarchical layout with branch separation for piping
  layoutNodesHierarchical(allNodes, allEdges)
  
  return {
    nodes: allNodes,
    edges: allEdges,
  }
}

