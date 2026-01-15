/**
 * QC Logic Syntax Generator
 * Generates SPSS COUNT and CHECK statements based on QC Logic Graph
 */

import { QCNode, QCEdge, QCLogicGraph, VariableType, EdgeType, Condition, GeneratedQCSyntax } from './qcLogicTypes'

/**
 * Convert condition to SPSS syntax
 */
function conditionToSyntax(condition: Condition, variable: string): string {
  switch (condition.type) {
    case 'comparison':
      if (!condition.operator || condition.value === undefined) return ''
      return `${variable} ${condition.operator} ${condition.value}`
    
    case 'have_any':
      if (!condition.values || condition.values.length === 0) return ''
      const valuesStr = condition.values.join(', ')
      return `ANY(${variable}, ${valuesStr})`
    
    case 'missing':
      return `MIS(${variable})`
    
    default:
      return ''
  }
}

/**
 * Get prerequisite condition from incoming edges
 */
function getPrerequisite(
  nodeId: string,
  edges: QCEdge[],
  nodes: Map<string, QCNode>
): string | null {
  const incomingEdges = edges.filter(e => e.to === nodeId && (e.type === 'ASK_IF' || e.type === 'PIPING'))
  
  if (incomingEdges.length === 0) return null
  
  // Combine conditions with OR (if multiple prerequisites)
  const conditions = incomingEdges.map(edge => {
    const fromNode = nodes.get(edge.from)
    if (!fromNode || !edge.condition) return null
    
    return conditionToSyntax(edge.condition, fromNode.name)
  }).filter(Boolean) as string[]
  
  if (conditions.length === 0) return null
  if (conditions.length === 1) return conditions[0]
  
  return `(${conditions.join(' OR ')})`
}

/**
 * Find child nodes via F1 or F2 edges
 */
function findChildNodes(
  nodeId: string,
  edges: QCEdge[],
  nodes: Map<string, QCNode>
): QCNode[] {
  const childEdges = edges.filter(e => 
    e.from === nodeId && (e.type === 'F1' || e.type === 'F2')
  )
  
  return childEdges
    .map(edge => nodes.get(edge.to))
    .filter(Boolean) as QCNode[]
}

/**
 * Generate syntax for SA (Single Answer) & SA Grid
 */
function generateSASyntax(
  node: QCNode,
  graph: QCLogicGraph,
  nodesMap: Map<string, QCNode>
): { count: string[], check: string[] } {
  const count: string[] = []
  const check: string[] = []
  
  const prerequisite = getPrerequisite(node.id, graph.edges, nodesMap)
  
  // Standard check: Variable should be answered if prerequisite is met
  if (prerequisite) {
    check.push(`IF (${prerequisite}) and MIS(${node.name}) check_${node.name} = 1.`)
  } else {
    check.push(`IF MIS(${node.name}) check_${node.name} = 1.`)
  }
  
  // For SA Grid: Check child nodes recursively
  if (node.type === 'SA_GRID') {
    const children = findChildNodes(node.id, graph.edges, nodesMap)
    
    children.forEach(child => {
      // If parent answered, child should be answered
      check.push(`IF (${node.name} = 1) and MIS(${child.name}) check_${child.name} = 1.`)
      
      // Reverse: If child answered, parent should be answered
      check.push(`IF NOT MIS(${child.name}) and MIS(${node.name}) check_${node.name} = 1.`)
    })
  }
  
  return { count, check }
}

/**
 * Generate syntax for MA (Multiple Answer)
 */
function generateMASyntax(
  node: QCNode,
  graph: QCLogicGraph,
  nodesMap: Map<string, QCNode>
): { count: string[], check: string[] } {
  const count: string[] = []
  const check: string[] = []
  
  const children = findChildNodes(node.id, graph.edges, nodesMap)
  
  if (children.length === 0) return { count, check }
  
  // Get child variable names (e.g., Q2_1, Q2_2, ...)
  const childNames = children.map(c => c.name)
  const firstChild = childNames[0]
  const lastChild = childNames[childNames.length - 1]
  
  // Generate COUNT statement
  count.push(`COUNT count_${node.name} = ${firstChild} thru ${lastChild} (1 thru 9).`)
  
  const prerequisite = getPrerequisite(node.id, graph.edges, nodesMap)
  const prereqPrefix = prerequisite ? `(${prerequisite}) and ` : ''
  
  // Generate CHECK statements based on validation rules
  if (node.fixedValue !== undefined) {
    // Fixed value check
    check.push(`IF ${prereqPrefix}(count_${node.name} <> ${node.fixedValue}) check_${node.name} = 1.`)
  } else if (node.maxValue !== undefined) {
    // Max value check
    check.push(`IF ${prereqPrefix}(count_${node.name} > ${node.maxValue}) check_${node.name} = 1.`)
  } else if (node.minValue !== undefined) {
    // Min value check
    check.push(`IF ${prereqPrefix}(count_${node.name} < ${node.minValue}) check_${node.name} = 1.`)
  } else {
    // Default: Must select at least one
    check.push(`IF ${prereqPrefix}(count_${node.name} = 0) check_${node.name} = 1.`)
  }
  
  return { count, check }
}

/**
 * Generate syntax for MA Grid
 */
function generateMAGridSyntax(
  node: QCNode,
  graph: QCLogicGraph,
  nodesMap: Map<string, QCNode>
): { count: string[], check: string[] } {
  const count: string[] = []
  const check: string[] = []
  
  // Find intermediate nodes (rows) via F1
  const rows = findChildNodes(node.id, graph.edges, nodesMap).filter(n => 
    graph.edges.some(e => e.from === node.id && e.to === n.id && e.type === 'F1')
  )
  
  rows.forEach(row => {
    // Find children (items) for this row via F2
    const items = findChildNodes(row.id, graph.edges, nodesMap).filter(n =>
      graph.edges.some(e => e.from === row.id && e.to === n.id && e.type === 'F2')
    )
    
    if (items.length === 0) return
    
    const itemNames = items.map(i => i.name)
    const firstItem = itemNames[0]
    const lastItem = itemNames[itemNames.length - 1]
    
    // COUNT for each row
    count.push(`COUNT count_${row.name} = ${firstItem} thru ${lastItem} (1 thru 9).`)
    
    const prerequisite = getPrerequisite(node.id, graph.edges, nodesMap)
    const prereqPrefix = prerequisite ? `(${prerequisite}) and ` : ''
    
    // CHECK for each row based on parent grid's logic
    if (node.fixedValue !== undefined) {
      check.push(`IF ${prereqPrefix}(count_${row.name} <> ${node.fixedValue}) check_${row.name} = 1.`)
    } else if (node.maxValue !== undefined) {
      check.push(`IF ${prereqPrefix}(count_${row.name} > ${node.maxValue}) check_${row.name} = 1.`)
    } else if (node.minValue !== undefined) {
      check.push(`IF ${prereqPrefix}(count_${row.name} < ${node.minValue}) check_${row.name} = 1.`)
    } else {
      check.push(`IF ${prereqPrefix}(count_${row.name} = 0) check_${row.name} = 1.`)
    }
  })
  
  return { count, check }
}

/**
 * Generate syntax for Open Ended (OE)
 */
function generateOESyntax(
  node: QCNode,
  graph: QCLogicGraph,
  nodesMap: Map<string, QCNode>
): { count: string[], check: string[] } {
  const count: string[] = []
  const check: string[] = []
  
  const prerequisite = getPrerequisite(node.id, graph.edges, nodesMap)
  
  // Check if text is empty when it should be filled
  if (prerequisite) {
    check.push(`IF (${prerequisite}) and ${node.name} = "" check_${node.name} = 1.`)
  } else {
    check.push(`IF ${node.name} = "" check_${node.name} = 1.`)
  }
  
  return { count, check }
}

/**
 * Generate syntax for Ranking
 */
function generateRankingSyntax(
  node: QCNode,
  graph: QCLogicGraph,
  nodesMap: Map<string, QCNode>
): { count: string[], check: string[] } {
  const count: string[] = []
  const check: string[] = []
  
  const children = findChildNodes(node.id, graph.edges, nodesMap)
  
  if (children.length === 0) return { count, check }
  
  const childNames = children.map(c => c.name)
  const firstChild = childNames[0]
  const lastChild = childNames[childNames.length - 1]
  
  // COUNT ranked items
  count.push(`COUNT count_${node.name} = ${firstChild} thru ${lastChild} (1 thru 9).`)
  
  const prerequisite = getPrerequisite(node.id, graph.edges, nodesMap)
  const prereqPrefix = prerequisite ? `(${prerequisite}) and ` : ''
  
  if (node.type === 'RANKING_FIXED' && node.fixedValue !== undefined) {
    // Must rank exactly X items
    check.push(`IF ${prereqPrefix}(count_${node.name} <> ${node.fixedValue}) check_${node.name} = 1.`)
  } else if (node.type === 'RANKING_ALL') {
    // Must rank all items
    check.push(`IF ${prereqPrefix}(count_${node.name} <> ${children.length}) check_${node.name} = 1.`)
  }
  
  return { count, check }
}

/**
 * Generate syntax for Unclassified
 */
function generateUnclassifiedSyntax(
  node: QCNode,
  graph: QCLogicGraph,
  nodesMap: Map<string, QCNode>
): { count: string[], check: string[] } {
  const count: string[] = []
  const check: string[] = []
  
  // Use custom conditions if provided
  if (node.conditions && node.conditions.length > 0) {
    const prerequisite = getPrerequisite(node.id, graph.edges, nodesMap)
    const prereqPrefix = prerequisite ? `(${prerequisite}) and ` : ''
    
    node.conditions.forEach((condition, index) => {
      const conditionSyntax = conditionToSyntax(condition, node.name)
      if (conditionSyntax) {
        check.push(`IF ${prereqPrefix}(${conditionSyntax}) check_${node.name}_${index + 1} = 1.`)
      }
    })
  } else {
    // If connected via Piping, assume dependency
    const prerequisite = getPrerequisite(node.id, graph.edges, nodesMap)
    if (prerequisite) {
      check.push(`IF (${prerequisite}) and MIS(${node.name}) check_${node.name} = 1.`)
    }
  }
  
  return { count, check }
}

/**
 * Generate QC Syntax from Logic Graph
 */
export function generateQCSyntax(graph: QCLogicGraph): GeneratedQCSyntax {
  // Create nodes map for efficient lookup
  const nodesMap = new Map<string, QCNode>()
  graph.nodes.forEach(node => {
    nodesMap.set(node.id, node)
  })
  
  // Sort nodes alphanumerically
  const sortedNodes = [...graph.nodes].sort((a, b) => {
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
  
  const allCount: string[] = []
  const allCheck: string[] = []
  
  // Process each node based on type
  sortedNodes.forEach(node => {
    let result: { count: string[], check: string[] }
    
    switch (node.type) {
      case 'SA':
      case 'SA_GRID':
        result = generateSASyntax(node, graph, nodesMap)
        break
      
      case 'MA':
        result = generateMASyntax(node, graph, nodesMap)
        break
      
      case 'MA_GRID':
        result = generateMAGridSyntax(node, graph, nodesMap)
        break
      
      case 'OE':
        result = generateOESyntax(node, graph, nodesMap)
        break
      
      case 'RANKING_ALL':
      case 'RANKING_FIXED':
        result = generateRankingSyntax(node, graph, nodesMap)
        break
      
      case 'UNCLASSIFIED':
      default:
        result = generateUnclassifiedSyntax(node, graph, nodesMap)
        break
    }
    
    // Add comment for node
    if (result.count.length > 0 || result.check.length > 0) {
      allCheck.push(`* ${node.name}`)
      allCount.push(...result.count)
      allCheck.push(...result.check)
      allCheck.push('')
    }
  })
  
  // Combine all statements
  const fullSyntax = [
    '* QC Logic Syntax - Auto Generated',
    '',
    '* COUNT Statements',
    ...allCount,
    '',
    '* CHECK Statements',
    ...allCheck,
  ].join('\n')
  
  return {
    countStatements: allCount,
    checkStatements: allCheck,
    fullSyntax,
  }
}



