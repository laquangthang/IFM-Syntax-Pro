/**
 * Unified QC Logic Syntax Generator
 * Single source of truth for all QC syntax generation.
 *
 * Entry points:
 * - generateQCSyntax(graph) - From QCLogicGraph (Nebula canvas)
 * - generateQCSyntaxFromQuestions(questions, oldVariableMapping) - From ParsedQuestion[]
 * - generateQCSyntaxFromFlow(graph, parsedQuestions, oldVariableMapping) - From LogicModelGraph
 * - generateAllQCSyntax(questions, customScript?) - Unified generator from ParsedQuestion[] only
 * - convertTerminateCondition(condition, questionId, questionType) - For EditQuestionModal
 */

import { QCNode, QCEdge, QCLogicGraph, VariableType, EdgeType, Condition, GeneratedQCSyntax } from '../qcLogicTypes'
import { LogicModelNode, LogicModelEdge, LogicModelGraph } from '../logicModelConverter'
import { ParsedQuestion } from '../types'
import { OldVariableMapping } from '@/lib/types'

// =============================================================================
// GRAPH-BASED GENERATOR (QCLogicGraph)
// =============================================================================

function conditionToSyntax(condition: Condition, variable: string): string {
  switch (condition.type) {
    case 'comparison':
      if (!condition.operator || condition.value === undefined) return ''
      return `${variable} ${condition.operator} ${condition.value}`
    case 'have_any':
      if (!condition.values || condition.values.length === 0) return ''
      return `ANY(${variable}, ${condition.values.join(', ')})`
    case 'missing':
      return `MIS(${variable})`
    default:
      return ''
  }
}

function getPrerequisite(
  nodeId: string,
  edges: QCEdge[],
  nodes: Map<string, QCNode>
): string | null {
  const incomingEdges = edges.filter(e => e.to === nodeId && (e.type === 'ASK_IF' || e.type === 'PIPING'))
  if (incomingEdges.length === 0) return null
  const conditions = incomingEdges.map(edge => {
    const fromNode = nodes.get(edge.from)
    if (!fromNode || !edge.condition) return null
    return conditionToSyntax(edge.condition, fromNode.name)
  }).filter(Boolean) as string[]
  if (conditions.length === 0) return null
  if (conditions.length === 1) return conditions[0]
  return `(${conditions.join(' OR ')})`
}

function findChildNodes(
  nodeId: string,
  edges: QCEdge[],
  nodes: Map<string, QCNode>
): QCNode[] {
  const childEdges = edges.filter(e => e.from === nodeId && (e.type === 'F1' || e.type === 'F2'))
  return childEdges.map(edge => nodes.get(edge.to)).filter(Boolean) as QCNode[]
}

function generateSASyntax(
  node: QCNode,
  graph: QCLogicGraph,
  nodesMap: Map<string, QCNode>
): { count: string[]; check: string[] } {
  const count: string[] = []
  const check: string[] = []
  const prerequisite = getPrerequisite(node.id, graph.edges, nodesMap)
  if (prerequisite) {
    check.push(`IF (${prerequisite}) and MIS(${node.name}) check_${node.name} = 1.`)
  } else {
    check.push(`IF MIS(${node.name}) check_${node.name} = 1.`)
  }
  if (node.type === 'SA_GRID') {
    const children = findChildNodes(node.id, graph.edges, nodesMap)
    children.forEach(child => {
      check.push(`IF (${node.name} = 1) and MIS(${child.name}) check_${child.name} = 1.`)
      check.push(`IF NOT MIS(${child.name}) and MIS(${node.name}) check_${node.name} = 1.`)
    })
  }
  return { count, check }
}

function generateMASyntax(
  node: QCNode,
  graph: QCLogicGraph,
  nodesMap: Map<string, QCNode>
): { count: string[]; check: string[] } {
  const count: string[] = []
  const check: string[] = []
  const children = findChildNodes(node.id, graph.edges, nodesMap)
  if (children.length === 0) return { count, check }
  const childNames = children.map(c => c.name)
  const firstChild = childNames[0]
  const lastChild = childNames[childNames.length - 1]
  count.push(`COUNT count_${node.name} = ${firstChild} thru ${lastChild} (1 thru 9).`)
  const prerequisite = getPrerequisite(node.id, graph.edges, nodesMap)
  const prereqPrefix = prerequisite ? `(${prerequisite}) and ` : ''
  if (node.fixedValue !== undefined) {
    check.push(`IF ${prereqPrefix}(count_${node.name} <> ${node.fixedValue}) check_${node.name} = 1.`)
  } else if (node.maxValue !== undefined) {
    check.push(`IF ${prereqPrefix}(count_${node.name} > ${node.maxValue}) check_${node.name} = 1.`)
  } else if (node.minValue !== undefined) {
    check.push(`IF ${prereqPrefix}(count_${node.name} < ${node.minValue}) check_${node.name} = 1.`)
  } else {
    check.push(`IF ${prereqPrefix}(count_${node.name} = 0) check_${node.name} = 1.`)
  }
  return { count, check }
}

function generateMAGridSyntax(
  node: QCNode,
  graph: QCLogicGraph,
  nodesMap: Map<string, QCNode>
): { count: string[]; check: string[] } {
  const count: string[] = []
  const check: string[] = []
  const rows = findChildNodes(node.id, graph.edges, nodesMap).filter(n =>
    graph.edges.some(e => e.from === node.id && e.to === n.id && e.type === 'F1')
  )
  rows.forEach(row => {
    const items = findChildNodes(row.id, graph.edges, nodesMap).filter(n =>
      graph.edges.some(e => e.from === row.id && e.to === n.id && e.type === 'F2')
    )
    if (items.length === 0) return
    const itemNames = items.map(i => i.name)
    const firstItem = itemNames[0]
    const lastItem = itemNames[itemNames.length - 1]
    count.push(`COUNT count_${row.name} = ${firstItem} thru ${lastItem} (1 thru 9).`)
    const prerequisite = getPrerequisite(node.id, graph.edges, nodesMap)
    const prereqPrefix = prerequisite ? `(${prerequisite}) and ` : ''
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

function generateOESyntax(
  node: QCNode,
  graph: QCLogicGraph,
  nodesMap: Map<string, QCNode>
): { count: string[]; check: string[] } {
  const count: string[] = []
  const check: string[] = []
  const prerequisite = getPrerequisite(node.id, graph.edges, nodesMap)
  if (prerequisite) {
    check.push(`IF (${prerequisite}) and ${node.name} = "" check_${node.name} = 1.`)
  } else {
    check.push(`IF ${node.name} = "" check_${node.name} = 1.`)
  }
  return { count, check }
}

function generateRankingSyntax(
  node: QCNode,
  graph: QCLogicGraph,
  nodesMap: Map<string, QCNode>
): { count: string[]; check: string[] } {
  const count: string[] = []
  const check: string[] = []
  const children = findChildNodes(node.id, graph.edges, nodesMap)
  if (children.length === 0) return { count, check }
  const childNames = children.map(c => c.name)
  const firstChild = childNames[0]
  const lastChild = childNames[childNames.length - 1]
  count.push(`COUNT count_${node.name} = ${firstChild} thru ${lastChild} (1 thru 9).`)
  const prerequisite = getPrerequisite(node.id, graph.edges, nodesMap)
  const prereqPrefix = prerequisite ? `(${prerequisite}) and ` : ''
  if (node.type === 'RANKING_FIXED' && node.fixedValue !== undefined) {
    check.push(`IF ${prereqPrefix}(count_${node.name} <> ${node.fixedValue}) check_${node.name} = 1.`)
  } else if (node.type === 'RANKING_ALL') {
    check.push(`IF ${prereqPrefix}(count_${node.name} <> ${children.length}) check_${node.name} = 1.`)
  }
  return { count, check }
}

function generateUnclassifiedSyntax(
  node: QCNode,
  graph: QCLogicGraph,
  nodesMap: Map<string, QCNode>
): { count: string[]; check: string[] } {
  const count: string[] = []
  const check: string[] = []
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
    const prerequisite = getPrerequisite(node.id, graph.edges, nodesMap)
    if (prerequisite) {
      check.push(`IF (${prerequisite}) and MIS(${node.name}) check_${node.name} = 1.`)
    }
  }
  return { count, check }
}

export function generateQCSyntax(graph: QCLogicGraph): GeneratedQCSyntax {
  const nodesMap = new Map<string, QCNode>()
  graph.nodes.forEach(node => nodesMap.set(node.id, node))
  const sortedNodes = [...graph.nodes].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  )
  const allCount: string[] = []
  const allCheck: string[] = []
  sortedNodes.forEach(node => {
    let result: { count: string[]; check: string[] }
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
      default:
        result = generateUnclassifiedSyntax(node, graph, nodesMap)
    }
    if (result.count.length > 0 || result.check.length > 0) {
      allCheck.push(`* ${node.name}`)
      allCount.push(...result.count)
      allCheck.push(...result.check)
      allCheck.push('')
    }
  })
  const fullSyntax = [
    '* QC Logic Syntax - Auto Generated',
    '',
    '* COUNT Statements',
    ...allCount,
    '',
    '* CHECK Statements',
    ...allCheck,
  ].join('\n')
  return { countStatements: allCount, checkStatements: allCheck, fullSyntax }
}

// =============================================================================
// JSON-BASED GENERATOR (ParsedQuestion[])
// =============================================================================

function convertOldVariablesInCondition(
  condition: string,
  question: ParsedQuestion,
  oldVariableMapping: OldVariableMapping,
  allQuestions: ParsedQuestion[] = []
): string {
  if (!condition || !oldVariableMapping || Object.keys(oldVariableMapping).length === 0) return condition
  const oldToNewMap = new Map<string, string>()
  const questionMap = new Map<string, ParsedQuestion>()
  allQuestions.forEach(q => questionMap.set(q.id, q))
  Object.keys(oldVariableMapping).forEach(questionId => {
    const oldVars = oldVariableMapping[questionId] || []
    if (oldVars.length === 0) return
    const q = questionMap.get(questionId) || question
    if (!q) return
    oldVars.forEach((oldVar, index) => {
      let newVar = questionId
      if (q.type === 'MA' && q.options) {
        const optionMatch = oldVar.match(/O(\d+)/i)
        if (optionMatch) {
          newVar = `${questionId}R${optionMatch[1]}`
        } else {
          const option = q.options[index]
          newVar = option && option.code !== undefined ? `${questionId}R${option.code}` : `${questionId}R${index + 1}`
        }
      } else if (q.type === 'MA_Grid' && q.columns && q.rows) {
        const colIndex = Math.floor(index / q.rows.length)
        const rowIndex = index % q.rows.length
        const col = q.columns[colIndex]
        const row = q.rows[rowIndex]
        if (col && row) newVar = `${questionId}_${col.code}R${row.code}`
      } else if ((q.type === 'SA_Grid' || q.type === 'OE_Grid') && q.rows) {
        const row = q.rows[index]
        if (row && row.code !== undefined) newVar = `${questionId}_${row.code}`
      } else if ((q.type === 'SA_Grid' || q.type === 'OE_Grid') && q.options) {
        const option = q.options[index]
        if (option && option.code !== undefined) newVar = `${questionId}_${option.code}`
      }
      oldToNewMap.set(oldVar, newVar)
    })
  })
  let converted = condition
  oldToNewMap.forEach((newVar, oldVar) => {
    const regex = new RegExp(`\\b${oldVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    converted = converted.replace(regex, newVar)
  })
  return converted
}

function getVariableNameJSON(questionId: string, code: string | number, questionType: ParsedQuestion['type']): string {
  if (questionType === 'MA') return `${questionId}R${code}`
  if (questionType === 'SA_Grid' || questionType === 'OE_Grid') return `${questionId}_${code}`
  if (questionType === 'MA_Grid') return `${questionId}_${code}`
  if (questionType === 'Rank_Fixed' || questionType === 'Rank_Upto') return `${questionId}_${code}`
  return questionId
}

function extractCodesFromCondition(condition: string, questionId: string): number[] {
  const codes: number[] = []
  if (!condition) return codes
  const qrPattern = new RegExp(`${questionId}R(\\d+)\\s*=\\s*\\1`, 'gi')
  let match
  while ((match = qrPattern.exec(condition)) !== null) codes.push(parseInt(match[1], 10))
  const codePattern = new RegExp(`${questionId}\\.code\\s*==\\s*(\\d+)`, 'gi')
  while ((match = codePattern.exec(condition)) !== null) codes.push(parseInt(match[1], 10))
  const saPattern = new RegExp(`${questionId}\\s*=\\s*(\\d+)`, 'gi')
  while ((match = saPattern.exec(condition)) !== null) codes.push(parseInt(match[1], 10))
  return [...new Set(codes)].sort((a, b) => a - b)
}

export function convertTerminateCondition(
  condition: string,
  questionId: string,
  questionType: ParsedQuestion['type']
): string {
  if (!condition) return ''
  let clean = condition.replace(/^IF\s+/i, '').trim()
  clean = clean.replace(/^["']|["']$/g, '').trim()
  const hasGridPattern = new RegExp(`${questionId}R\\d+C\\d+`, 'i').test(clean)
  const isMA_Grid = questionType === 'MA_Grid' || hasGridPattern
  if (isMA_Grid) {
    const misPattern = new RegExp(`MIS\\s*\\(\\s*${questionId}R(\\d+)C(\\d+)\\s*\\)`, 'gi')
    clean = clean.replace(misPattern, (_, rowCode, colCode) => `MIS(${questionId}_${colCode}R${rowCode})`)
    const gridPattern = new RegExp(`${questionId}R(\\d+)C(\\d+)\\s*=\\s*\\d+`, 'gi')
    clean = clean.replace(gridPattern, (_, rowCode, colCode) => `${questionId}_${colCode}R${rowCode} = ${rowCode}`)
    clean = clean.replace(/\bOR\b/g, 'or').replace(/\bAND\b/g, 'and')
    clean = clean.replace(/^\(([^)]+(?:\([^)]*\)[^)]*)*)\)$/g, '$1').trim()
    return clean
  }
  const notMatch = clean.match(/^NOT\s*\((.*)\)$/i)
  if (notMatch && questionType === 'MA') {
    const inner = notMatch[1].trim()
    const codes = extractCodesFromCondition(inner, questionId)
    if (codes.length > 0) {
      const parts = codes.map(code => `${questionId}R${code} = ${code}`)
      return parts.join(' or ')
    }
  }
  if (questionType === 'MA') {
    clean = clean.replace(new RegExp(`${questionId}\\.code\\s*==\\s*(\\d+)`, 'gi'), (_, code) => `${questionId}R${code} = ${code}`)
    clean = clean.replace(/==/g, '=').replace(/\bOR\b/g, 'or')
  } else {
    clean = clean.replace(/\.code\s*==/g, '').replace(/==/g, '=').replace(/\bOR\b/g, 'or')
    clean = clean.replace(/^\(|\)$/g, '').trim()
  }
  return clean
}

function getNewVariableName(
  questionId: string,
  code: string | number,
  questionType: ParsedQuestion['type'],
  _question: ParsedQuestion,
  _oldVariableMapping: OldVariableMapping
): string {
  return getVariableNameJSON(questionId, code, questionType)
}

function generateCountStatementsJSON(
  questions: ParsedQuestion[],
  oldVariableMapping: OldVariableMapping = {}
): string[] {
  const counts: string[] = []
  questions.forEach(question => {
    if (question.type === 'MA' && question.options && question.options.length > 0) {
      const mainOptions = question.options.filter(opt => {
        const codeStr = String(opt.code)
        return !codeStr.endsWith('_O') && !isNaN(Number(codeStr))
      })
      if (mainOptions.length > 0) {
        const codes = mainOptions.map(opt => Number(opt.code)).filter(c => !isNaN(c)).sort((a, b) => a - b)
        if (codes.length > 0) {
          const firstCode = codes[0]
          const lastCode = codes[codes.length - 1]
          const firstVar = getNewVariableName(question.id, firstCode, question.type, question, oldVariableMapping)
          const lastVar = getNewVariableName(question.id, lastCode, question.type, question, oldVariableMapping)
          counts.push(`count count_${question.id} = ${firstVar} to ${lastVar} (1 thru ${lastCode}).`)
        }
      }
    } else if (question.type === 'Rank_Fixed' && question.options && question.limit) {
      const codes = question.options.map(opt => Number(opt.code)).filter(c => !isNaN(c)).sort((a, b) => a - b)
      if (codes.length > 0) {
        const firstCode = codes[0]
        const lastCode = codes[codes.length - 1]
        const firstVar = getNewVariableName(question.id, firstCode, question.type, question, oldVariableMapping)
        const lastVar = getNewVariableName(question.id, lastCode, question.type, question, oldVariableMapping)
        for (let rank = 1; rank <= question.limit; rank++) {
          counts.push(`count count_${question.id}_rank${rank} = ${firstVar} to ${lastVar} (${rank}).`)
        }
      }
    }
  })
  return counts
}

function shouldAskQuestion(question: ParsedQuestion): { user: number; condition?: string } {
  if (question.logic?.type === 'Ask All') return { user: 1 }
  if (question.logic?.ask_if_condition && question.logic?.piping_source) {
    const condition = question.logic.ask_if_condition.replace(/^IF\s+/i, '').trim()
    return { user: 1, condition }
  }
  return { user: 0 }
}

function generateCheckStatementsJSON(
  questions: ParsedQuestion[],
  oldVariableMapping: OldVariableMapping = {}
): string[] {
  const checks: string[] = []
  const questionMap = new Map<string, ParsedQuestion>()
  questions.forEach(q => questionMap.set(q.id, q))
  questions.forEach(question => {
    const questionChecks: string[] = []
    const shouldAsk = shouldAskQuestion(question)
    if (question.logic?.type === 'Ask All') {
      questionChecks.push(`if user = 0 check_user = 1.`)
    }
    if (shouldAsk.user === 1) {
      if (question.type === 'SA') questionChecks.push(`if user = 1 and mis(${question.id}) check_mis_${question.id} = 1.`)
      else if (question.type === 'MA') questionChecks.push(`if user = 1 and count_${question.id} = 0 check_mis_${question.id} = 1.`)
      else if (question.type === 'OE') questionChecks.push(`if (user = 1 and (mis(${question.id}) or ${question.id} = "" )) check_mis_${question.id} = 1.`)
    } else {
      if (question.type === 'SA') questionChecks.push(`if user = 0 and not mis(${question.id}) check_${question.id} = 1.`)
      else if (question.type === 'MA') questionChecks.push(`if user = 0 and count_${question.id} = 0 check_mis_${question.id} = 1.`)
    }
    if (question.logic?.ask_if_condition && question.logic?.piping_source) {
      const sourceQuestion = questionMap.get(question.logic.piping_source)
      if (sourceQuestion) {
        let condition = question.logic.ask_if_condition.replace(/^IF\s+/i, '').trim()
        condition = convertOldVariablesInCondition(condition, sourceQuestion, oldVariableMapping, questions)
        if (question.type === 'SA') {
          const codes = extractCodesFromCondition(condition, sourceQuestion.id)
          codes.forEach(code => {
            if (sourceQuestion.type === 'MA') questionChecks.push(`if user = 0 and ${question.id} = ${code} check_${question.id}_code${code} = 1.`)
          })
          questionChecks.push(`if user = 1 and mis(${question.id}) check_mis_${question.id} = 1.`)
        } else if (question.type === 'MA') {
          questionChecks.push(`if user = 1 and count_${question.id} = 0 check_mis_${question.id} = 1.`)
        }
      }
    }
    if (question.logic?.terminate_if) {
      let condition = convertTerminateCondition(question.logic.terminate_if, question.id, question.type)
      condition = convertOldVariablesInCondition(condition, question, oldVariableMapping, questions)
      if (condition) questionChecks.push(`if ${condition} check_${question.id}_terminate = 1.`)
    }
    if (question.logic?.piping_source && question.logic.type === 'Piping') {
      const sourceQuestion = questionMap.get(question.logic.piping_source)
      if (sourceQuestion && sourceQuestion.type === 'MA' && question.type === 'MA' && sourceQuestion.options && question.options) {
        sourceQuestion.options.forEach(sourceOpt => {
          const sourceCode = Number(sourceOpt.code)
          if (!isNaN(sourceCode) && !String(sourceOpt.code).endsWith('_O')) {
            const sourceVar = getVariableNameJSON(sourceQuestion.id, sourceCode, sourceQuestion.type)
            const targetVar = getVariableNameJSON(question.id, sourceCode, question.type)
            questionChecks.push(`if ${targetVar} = ${sourceCode} and mis(${sourceVar}) check_${question.id}_${sourceQuestion.id}_code${sourceCode} = 1.`)
          }
        })
      } else if (sourceQuestion && sourceQuestion.type === 'MA' && question.type === 'SA' && sourceQuestion.options) {
        sourceQuestion.options.forEach(sourceOpt => {
          const sourceCode = Number(sourceOpt.code)
          if (!isNaN(sourceCode) && !String(sourceOpt.code).endsWith('_O')) {
            const sourceVar = getVariableNameJSON(sourceQuestion.id, sourceCode, sourceQuestion.type)
            questionChecks.push(`if ${question.id} = ${sourceCode} and mis(${sourceVar}) check_${question.id}_${sourceQuestion.id}_code${sourceCode} = 1.`)
          }
        })
      }
    }
    if (question.options) {
      question.options.forEach(opt => {
        const codeStr = String(opt.code)
        if (codeStr.endsWith('_O')) {
          const baseCode = codeStr.replace('_O', '')
          const otherVar = `${question.id}R${baseCode}_${baseCode}`
          questionChecks.push(`if ${question.id}R${baseCode} = ${baseCode} and ${otherVar} ="" check_${otherVar} = 1.`)
        }
      })
    }
    if (question.type === 'Rank_Fixed' && question.limit) {
      for (let rank = 1; rank <= question.limit; rank++) {
        questionChecks.push(`if count_${question.id}_rank${rank} <> 1 check_${question.id}_rank${rank} = 1.`)
      }
    }
    if (question.logic?.ask_if_condition && question.logic?.piping_source) {
      const sourceQuestion = questionMap.get(question.logic.piping_source)
      if (sourceQuestion && sourceQuestion.type === 'MA' && question.type === 'MA') {
        let askIfCondition = question.logic.ask_if_condition
        askIfCondition = convertOldVariablesInCondition(askIfCondition, sourceQuestion, oldVariableMapping, questions)
        const codes = extractCodesFromCondition(askIfCondition, sourceQuestion.id)
        if (codes.length > 0) {
          const firstCode = codes[0]
          const sourceVar = getVariableNameJSON(sourceQuestion.id, firstCode, sourceQuestion.type)
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

export function generateQCSyntaxFromQuestions(
  questions: ParsedQuestion[],
  oldVariableMapping: OldVariableMapping = {}
): string {
  const countStatements = generateCountStatementsJSON(questions, oldVariableMapping)
  const checkStatements = generateCheckStatementsJSON(questions, oldVariableMapping)
  return [
    '*Count Statement.',
    '*===============================================================================.',
    ...countStatements,
    '',
    '*Check Statement.',
    '*===============================================================================.',
    ...checkStatements,
  ].join('\n')
}

// =============================================================================
// FLOW-BASED GENERATOR (LogicModelGraph)
// =============================================================================

function getVariableNameForSyntax(
  questionId: string,
  code: string | number | null,
  questionType: string,
  _oldVariableMapping?: OldVariableMapping,
  _parsedQuestion?: any
): string {
  if (code === null) return questionId
  if (questionType === 'MA') return `${questionId}R${code}`
  if (questionType === 'SA_Grid' || questionType === 'OE_Grid' || questionType === 'Sum') return `${questionId}_${code}`
  if (questionType === 'MA_Grid') return `${questionId}_${code}`
  if (questionType === 'Rank_Fixed' || questionType === 'Rank_Upto') return `${questionId}_${code}`
  return `${questionId}_${code}`
}

function generateCountStatementsFlow(
  nodes: LogicModelNode[],
  oldVariableMapping?: OldVariableMapping,
  parsedQuestions?: any[]
): string[] {
  const counts: string[] = []
  const questionNodes = nodes.filter(n => n.type === 'question')
  const questionMap = new Map<string, any>()
  if (parsedQuestions) parsedQuestions.forEach(q => questionMap.set(q.id, q))
  questionNodes.forEach(questionNode => {
    const questionId = questionNode.id
    const parsedQ = questionMap.get(questionId)
    const questionType = questionNode.data.questionType || parsedQ?.type || 'SA'
    if (questionType === 'MA') {
      const codeNodes = nodes.filter(n => n.type === 'code' && n.data.questionId === questionId)
      if (codeNodes.length > 0) {
        const sortedCodes = codeNodes
          .map(n => (typeof n.data.code === 'number' ? n.data.code : parseInt(String(n.data.code), 10)))
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
      const limit = parsedQ?.limit || (questionNode.data as any).limit
      if (limit && limit > 0) {
        const codeNodes = nodes.filter(n => n.type === 'code' && n.data.questionId === questionId)
        if (codeNodes.length > 0) {
          const sortedCodes = codeNodes
            .map(n => (typeof n.data.code === 'number' ? n.data.code : parseInt(String(n.data.code), 10)))
            .filter(code => !isNaN(code))
            .sort((a, b) => a - b)
          if (sortedCodes.length > 0) {
            const firstCode = sortedCodes[0]
            const lastCode = sortedCodes[sortedCodes.length - 1]
            const firstVar = getVariableNameForSyntax(questionId, firstCode, questionType, oldVariableMapping, parsedQ)
            const lastVar = getVariableNameForSyntax(questionId, lastCode, questionType, oldVariableMapping, parsedQ)
            for (let rank = 1; rank <= limit; rank++) {
              counts.push(`count count_${questionId}_rank${rank} = ${firstVar} to ${lastVar} (${rank}).`)
            }
          }
        }
      }
    } else if (questionType === 'MA_Grid') {
      const cols = parsedQ?.columns ?? parsedQ?.options ?? []
      const rws = parsedQ?.rows ?? (parsedQ as any)?.subQuestions ?? []
      const mainRows = rws.filter((r: any) => r.codeType !== 'Other')
      if (mainRows.length > 0 && cols.length > 0) {
        const firstRowCode = mainRows[0].code
        const lastRowCode = mainRows[mainRows.length - 1].code
        for (const col of cols) {
          counts.push(`count count_${questionId}_${col.code} = ${questionId}_${col.code}R${firstRowCode} to ${questionId}_${col.code}R${lastRowCode} (${firstRowCode} thru ${lastRowCode}).`)
        }
      }
    }
  })
  return counts
}

function extractAskIfCondition(condition: string, _oldVariableMapping?: OldVariableMapping): string {
  if (!condition) return ''
  let cleaned = condition.trim()
  if (cleaned.toUpperCase().startsWith('IF')) cleaned = cleaned.substring(2).trim()
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) cleaned = cleaned.slice(1, -1).trim()
  return cleaned.replace(/\s+OR\s+/gi, ' or ')
}

/** Extract parent question ID from source node ID. Q2R3, Q2_3 -> Q2; Q3AR4 -> Q3A; Q2 -> Q2 */
function getParentQuestionIdFromSource(sourceNodeId: string): string {
  const match = sourceNodeId.match(/^([A-Z]\d+[A-Z]?\d*?)(?=R\d|_\d|$)/i)
  return match ? match[1] : sourceNodeId
}

/** Group ASK_IF edges by parent source question so we emit syntax once per group (not per edge) */
function groupEdgesByParentSource(edges: LogicModelEdge[]): Map<string, LogicModelEdge[]> {
  const grouped = new Map<string, LogicModelEdge[]>()
  for (const edge of edges) {
    const parentId = getParentQuestionIdFromSource(edge.source)
    if (!grouped.has(parentId)) grouped.set(parentId, [])
    grouped.get(parentId)!.push(edge)
  }
  return grouped
}

function generateTerminateCheck(
  questionId: string,
  _questionType: string,
  terminateCondition: string,
  _oldVariableMapping?: OldVariableMapping
): string {
  if (!terminateCondition) return ''
  let condition = terminateCondition.trim()
  if (condition.toUpperCase().startsWith('IF')) condition = condition.substring(2).trim()
  condition = condition.replace(/\s+OR\s+/gi, ' or ').replace(/\s+AND\s+/gi, ' and ')
  return `if ${condition} check_${questionId}_terminate = 1.`
}

function generateCheckStatementsFlow(
  nodes: LogicModelNode[],
  edges: LogicModelEdge[],
  parsedQuestions: any[],
  oldVariableMapping?: OldVariableMapping
): string[] {
  const checks: string[] = []
  const questionNodes = nodes.filter(n => n.type === 'question')
  const questionMap = new Map<string, any>()
  parsedQuestions.forEach(q => questionMap.set(q.id, q))
  /** Exclude structural edges (F0, default) - keep only logic edges */
  const isStructuralEdge = (e: LogicModelEdge) =>
    e.type === 'F0' || e.type === 'default' || e.label === 'F0'

  const askIfEdgesMap = new Map<string, LogicModelEdge[]>()
  edges.forEach(edge => {
    if (isStructuralEdge(edge)) return
    if (edge.type === 'ASK_IF' && !edge.target.endsWith('_terminate')) {
      if (!askIfEdgesMap.has(edge.target)) askIfEdgesMap.set(edge.target, [])
      askIfEdgesMap.get(edge.target)!.push(edge)
    }
  })
  const pipingEdgesMap = new Map<string, LogicModelEdge[]>()
  edges.forEach(edge => {
    if (isStructuralEdge(edge)) return
    if (edge.type === 'PIPING' && !edge.target.endsWith('_terminate')) {
      const targetNode = nodes.find(n => n.id === edge.target)
      if (targetNode && targetNode.type === 'question') {
        if (!pipingEdgesMap.has(edge.target)) pipingEdgesMap.set(edge.target, [])
        pipingEdgesMap.get(edge.target)!.push(edge)
      }
    }
  })
  const f0EdgesMap = new Map<string, LogicModelEdge[]>()
  edges.forEach(edge => {
    if (edge.type === 'F0' && !edge.target.endsWith('_terminate')) {
      const targetNode = nodes.find(n => n.id === edge.target)
      if (targetNode && targetNode.type === 'question') {
        if (!f0EdgesMap.has(edge.target)) f0EdgesMap.set(edge.target, [])
        f0EdgesMap.get(edge.target)!.push(edge)
      }
    }
  })
  questionNodes.forEach((questionNode, index) => {
    const questionChecks: string[] = []
    if (index > 0) checks.push('')
    checks.push(`* --- ${questionNode.id} ---.`)
    const questionId = questionNode.id
    const parsedQuestion = questionMap.get(questionId)
    const questionType = questionNode.data.questionType || parsedQuestion?.type || 'SA'
    const isAskAll = parsedQuestion?.logic?.type === 'Ask All' || parsedQuestion?.instruction?.toUpperCase().includes('ASK ALL')
    const incomingAskIfEdges = askIfEdgesMap.get(questionId) || []
    const incomingF0Edges = f0EdgesMap.get(questionId) || []
    const questionVar = getVariableNameForSyntax(questionId, null, questionType, oldVariableMapping, parsedQuestion)
    if (questionType === 'SA') {
      if (incomingAskIfEdges.length > 0) {
        const groupedByParent = groupEdgesByParentSource(incomingAskIfEdges)
        groupedByParent.forEach((_edges, _parentId) => {
          const edge = _edges[0]
          const condition = extractAskIfCondition(edge.condition || edge.label || '', oldVariableMapping)
          const hasOr = condition.includes(' or ')
          const conditionWithParens = hasOr ? `(${condition})` : condition
          questionChecks.push(condition ? `if ${conditionWithParens} and mis(${questionVar}) check_mis_${questionId}= 1.` : `if mis(${questionVar}) check_mis_${questionId}= 1.`)
        })
      } else if (incomingF0Edges.length > 0) {
        questionChecks.push(`if mis(${questionVar}) check_mis_${questionId} = 1.`)
      } else {
        questionChecks.push(`if mis(${questionVar}) check_mis_${questionId}= 1.`)
      }
    } else if (questionType === 'OE' || questionType === 'OA') {
      questionChecks.push(`if ${questionVar} = "" check_mis_${questionId} = 1.`)
    } else if (questionType === 'MA') {
      const pipingSource = parsedQuestion?.logic?.piping_source
      const hasPiping = parsedQuestion?.logic?.type === 'Piping' && pipingSource
      if (hasPiping && pipingSource) {
        if (parsedQuestion?.options) {
          const mainOptions = parsedQuestion.options.filter((opt: any) => !String(opt.code).endsWith('_O'))
          const pipingSourceQuestion = questionMap.get(pipingSource)
          if (pipingSourceQuestion && mainOptions.length > 0) {
            mainOptions.forEach((option: any) => {
              const code = option.code
              const codeNum = typeof code === 'number' ? code : parseInt(String(code), 10)
              if (!isNaN(codeNum)) {
                const currentVar = getVariableNameForSyntax(questionId, codeNum, questionType, oldVariableMapping, parsedQuestion)
                const sourceVar = getVariableNameForSyntax(pipingSource, codeNum, 'MA', oldVariableMapping, pipingSourceQuestion)
                questionChecks.push(`if ${currentVar} = ${codeNum} and mis(${sourceVar}) check_${questionId}_${pipingSource}_code${codeNum} = 1.`)
              }
            })
          }
        }
      } else {
        if (incomingAskIfEdges.length > 0) {
          const groupedByParent = groupEdgesByParentSource(incomingAskIfEdges)
          groupedByParent.forEach((_edges, _parentId) => {
            const edge = _edges[0]
            const condition = extractAskIfCondition(edge.condition || edge.label || '', oldVariableMapping)
            const hasOr = condition.includes(' or ')
            const conditionWithParens = hasOr ? `(${condition})` : condition
            questionChecks.push(condition ? `if ${conditionWithParens} and count_${questionId} = 0 check_mis_${questionId} = 1.` : `if count_${questionId} = 0 check_mis_${questionId} = 1.`)
          })
        } else {
          questionChecks.push(`if count_${questionId} = 0 check_mis_${questionId} = 1.`)
        }
      }
    } else if (questionType === 'Rank_Fixed' || questionType === 'Rank_Upto') {
      const limit = parsedQuestion?.limit || (questionNode.data as any).limit
      if (limit && limit > 0) {
        for (let rank = 1; rank <= limit; rank++) {
          questionChecks.push(`if count_${questionId}_rank${rank} <> 1 check_${questionId}_rank${rank} = 1.`)
        }
      }
    } else if (questionType === 'MA_Grid') {
      const columns = parsedQuestion?.columns ?? parsedQuestion?.options ?? []
      const rows = parsedQuestion?.rows ?? (parsedQuestion as any)?.subQuestions ?? []

      if (columns.length > 0 && rows.length > 0) {
      // MA_Grid output structure: grouped blocks for readability (Forward → Backward → Fallback → Other Specify)
      const forwardChecks: string[] = []   // Source selected, target missing (piping cross-check)
      const backwardChecks: string[] = []  // Target selected, source missing (reverse piping)
      const fallbackChecks: string[] = [] // No piping edge: standalone count=0 missing check
      const otherChecks: string[] = []    // Other Specify: _O text companion empty when base selected

      const allIncomingToTarget = edges.filter((e) => e.target === questionId)
      // Strict piping filter: only option-level edges (source.includes('R')) exclude parent/intermediate hijack
      const pipingEdges = allIncomingToTarget.filter(
        (e) =>
          (e.type === 'PIPING' || e.label === 'Piping') &&
          e.type !== 'F0' &&
          e.label !== 'F0' &&
          e.source.includes('R')
      )

      for (const col of columns) {
        const colCodeStr = String(col.code)
        const matchedEdge =
          pipingEdges.find((edge) => edge.source.endsWith(`R${colCodeStr}`)) ??
          pipingEdges.find((edge) => edge.source.includes(`_${colCodeStr}R`)) ??
          pipingEdges.find((edge) => edge.source.endsWith(`_${colCodeStr}`)) ??
          pipingEdges.find((edge) => edge.source === colCodeStr)

        if (matchedEdge) {
          const escaped = colCodeStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const sourceQid = matchedEdge.source.replace(new RegExp(`[R_]${escaped}$`), '')
          const sourceQuestion = questionMap.get(sourceQid)
          const isSourceMA_Grid = sourceQuestion?.type === 'MA_Grid'
          const forwardSourceCond = isSourceMA_Grid
            ? `count_${matchedEdge.source} > 0`
            : `${matchedEdge.source} = ${col.code}`
          const backwardSourceCond = isSourceMA_Grid
            ? `count_${matchedEdge.source} = 0`
            : `mis(${matchedEdge.source})`
          if (incomingAskIfEdges.length > 0) {
            const groupedByParent = groupEdgesByParentSource(incomingAskIfEdges)
            groupedByParent.forEach((_edges) => {
              const edge = _edges[0]
              const condition = extractAskIfCondition(edge.condition || edge.label || '', oldVariableMapping)
              const hasOr = condition.includes(' or ')
              const conditionWithParens = hasOr ? `(${condition})` : condition
              forwardChecks.push(`if ${conditionWithParens} and ${forwardSourceCond} and count_${questionId}_${colCodeStr} = 0 check_${sourceQid}_${questionId}_code${colCodeStr} = 1.`)
              backwardChecks.push(`if ${conditionWithParens} and count_${questionId}_${colCodeStr} > 0 and ${backwardSourceCond} check_${questionId}_${sourceQid}_code${colCodeStr} = 1.`)
            })
          } else {
            forwardChecks.push(`if ${forwardSourceCond} and count_${questionId}_${colCodeStr} = 0 check_${sourceQid}_${questionId}_code${colCodeStr} = 1.`)
            backwardChecks.push(`if count_${questionId}_${colCodeStr} > 0 and ${backwardSourceCond} check_${questionId}_${sourceQid}_code${colCodeStr} = 1.`)
          }
        } else {
          if (incomingAskIfEdges.length > 0) {
            const groupedByParent = groupEdgesByParentSource(incomingAskIfEdges)
            groupedByParent.forEach((_edges) => {
              const edge = _edges[0]
              const condition = extractAskIfCondition(edge.condition || edge.label || '', oldVariableMapping)
              const hasOr = condition.includes(' or ')
              const conditionWithParens = hasOr ? `(${condition})` : condition
              fallbackChecks.push(`if ${conditionWithParens} and count_${questionId}_${colCodeStr} = 0 check_mis_${questionId}_${colCodeStr} = 1.`)
            })
          } else {
            fallbackChecks.push(`if count_${questionId}_${colCodeStr} = 0 check_mis_${questionId}_${colCodeStr} = 1.`)
          }
        }
      }

      // Other Specify handling: _O text companion empty when base option selected
      const otherRows = rows.filter((r: any) => r.codeType === 'Other')
      for (const col of columns) {
        const colCode = String(col.code)
        for (const row of otherRows) {
          const baseVar = `${questionId}_${colCode}R${row.code}`
          const textVar = `${baseVar}_O`
          otherChecks.push(`if ${baseVar} = ${row.code} and ${textVar} = "" check_${textVar} = 1.`)
        }
      }

      // Assemble blocks in order: Forward → Backward → Fallback → Other Specify (blank line between blocks)
      if (forwardChecks.length > 0) {
        questionChecks.push(...forwardChecks)
        questionChecks.push('')
      }
      if (backwardChecks.length > 0) {
        questionChecks.push(...backwardChecks)
        questionChecks.push('')
      }
      if (fallbackChecks.length > 0) {
        questionChecks.push(...fallbackChecks)
        questionChecks.push('')
      }
      if (otherChecks.length > 0) {
        questionChecks.push(...otherChecks)
      }
      }
    } else if (questionType === 'SA_Grid' || questionType === 'Sum') {
      const items = parsedQuestion?.rows || parsedQuestion?.options || []
      const mainItems = items.filter((i: any) => !String(i?.code).endsWith('_O'))
      const count = mainItems.length
      if (count > 1) {
        const firstRowCode = mainItems[0].code
        const lastRowCode = mainItems[count - 1].code
        const firstVar = `${questionId}_${firstRowCode}`
        const lastVar = `${questionId}_${lastRowCode}`
        const nvalidCheck = `nvalid(${firstVar} to ${lastVar}) <> ${count}`
        if (incomingAskIfEdges.length > 0) {
          const groupedByParent = groupEdgesByParentSource(incomingAskIfEdges)
          groupedByParent.forEach((_edges) => {
            const edge = _edges[0]
            const condition = extractAskIfCondition(edge.condition || edge.label || '', oldVariableMapping)
            const hasOr = condition.includes(' or ')
            const conditionWithParens = hasOr ? `(${condition})` : condition
            questionChecks.push(`if ${conditionWithParens} and ${nvalidCheck} check_mis_${questionId} = 1.`)
          })
        } else if (incomingF0Edges.length > 0) {
          questionChecks.push(`if ${nvalidCheck} check_mis_${questionId} = 1.`)
        } else {
          questionChecks.push(`if ${nvalidCheck} check_mis_${questionId} = 1.`)
        }
        if (questionType === 'Sum') {
          const sumCheck = `sum(${firstVar} to ${lastVar}) <> 100`
          if (incomingAskIfEdges.length > 0) {
            const groupedByParent = groupEdgesByParentSource(incomingAskIfEdges)
            groupedByParent.forEach((_edges) => {
              const edge = _edges[0]
              const condition = extractAskIfCondition(edge.condition || edge.label || '', oldVariableMapping)
              const hasOr = condition.includes(' or ')
              const conditionWithParens = hasOr ? `(${condition})` : condition
              questionChecks.push(`if ${conditionWithParens} and ${sumCheck} check_sum_${questionId} = 1.`)
            })
          } else {
            questionChecks.push(`if ${sumCheck} check_sum_${questionId} = 1.`)
          }
        }
      } else if (count === 1) {
        const targetVar = getVariableNameForSyntax(questionId, mainItems[0].code, questionType, oldVariableMapping, parsedQuestion)
        if (incomingAskIfEdges.length > 0) {
          const groupedByParent = groupEdgesByParentSource(incomingAskIfEdges)
          groupedByParent.forEach((_edges) => {
            const edge = _edges[0]
            const condition = extractAskIfCondition(edge.condition || edge.label || '', oldVariableMapping)
            const hasOr = condition.includes(' or ')
            const conditionWithParens = hasOr ? `(${condition})` : condition
            questionChecks.push(`if ${conditionWithParens} and mis(${targetVar}) check_mis_${questionId} = 1.`)
          })
        } else {
          questionChecks.push(`if mis(${targetVar}) check_mis_${questionId} = 1.`)
        }
      }
    }
    const terminateCondition = questionNode.data.terminateIf || parsedQuestion?.logic?.terminate_if
    if (terminateCondition) {
      const terminateCheck = generateTerminateCheck(questionId, questionType, terminateCondition, oldVariableMapping)
      if (terminateCheck) questionChecks.push(terminateCheck)
    }
    if (parsedQuestion?.options) {
      const processedBaseCodes = new Set<number>()
      parsedQuestion.options.forEach((option: any) => {
        const codeStr = String(option.code)
        const isOtherCode = codeStr.endsWith('_O') || option.codeType === 'Other'
        if (isOtherCode) {
          const baseCode = codeStr.replace('_O', '')
          const baseCodeNum = parseInt(baseCode, 10)
          if (!isNaN(baseCodeNum) && !processedBaseCodes.has(baseCodeNum)) {
            processedBaseCodes.add(baseCodeNum)
            const mainVar = getVariableNameForSyntax(questionId, baseCodeNum, questionType, oldVariableMapping, parsedQuestion)
            let otherVar = `${mainVar}_O`
            const oldVars = oldVariableMapping?.[questionId]
            if (oldVars && oldVars.length > 0) {
              const otherPattern = new RegExp(`${mainVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_O$`, 'i')
              const matchedOtherVar = oldVars.find((v: string) => otherPattern.test(v))
              if (matchedOtherVar) otherVar = matchedOtherVar
            }
            questionChecks.push(`if ${mainVar} = ${baseCodeNum} and ${otherVar} = "" check_${otherVar} = 1.`)
          }
        }
      })
    }
    checks.push(...Array.from(new Set(questionChecks)))
  })
  return checks
}

export function generateQCSyntaxFromFlow(
  graph: LogicModelGraph,
  parsedQuestions: any[],
  oldVariableMapping?: OldVariableMapping
): string {
  const counts = generateCountStatementsFlow(graph.nodes, oldVariableMapping, parsedQuestions)
  const checks = generateCheckStatementsFlow(graph.nodes, graph.edges, parsedQuestions, oldVariableMapping)
  const lines: string[] = []
  if (counts.length > 0) {
    lines.push('* COUNT statements for MA and Rank questions')
    lines.push('')
    counts.forEach(count => lines.push(count))
    lines.push('')
  }
  if (checks.length > 0) {
    lines.push('* CHECK statements for missing data validation')
    lines.push('')
    checks.forEach(check => lines.push(check))
  }
  return lines.join('\n')
}

// =============================================================================
// UNIFIED QC SYNTAX GENERATOR (ParsedQuestion[] only)
// =============================================================================

function getVarName(questionId: string, code: string | number, questionType: ParsedQuestion['type']): string {
  if (questionType === 'MA') return `${questionId}R${code}`
  if (questionType === 'SA_Grid' || questionType === 'OE_Grid' || questionType === 'Sum') return `${questionId}_${code}`
  if (questionType === 'MA_Grid') return `${questionId}_${code}`
  if (questionType === 'Rank_Fixed' || questionType === 'Rank_Upto') return `${questionId}_${code}`
  if (questionType === 'Numeric') return `${questionId}_${code}`
  return questionId
}

/**
 * Step 1: Generate COUNT statements for MA and MA_Grid.
 * Uses strict physical order from question.options (first to last).
 */
function generateCountStatements(questions: ParsedQuestion[]): string[] {
  const lines: string[] = []
  for (const q of questions) {
    if (q.type === 'MA' && q.options && q.options.length > 0) {
      const mainOpts = q.options.filter(opt => !String(opt.code).endsWith('_O') && opt.codeType !== 'Other')
      if (mainOpts.length > 0) {
        const firstVar = getVarName(q.id, mainOpts[0].code, q.type)
        const lastVar = getVarName(q.id, mainOpts[mainOpts.length - 1].code, q.type)
        lines.push(`count count_${q.id} = ${firstVar} to ${lastVar} (1 thru 99).`)
      }
    } else if (q.type === 'MA_Grid' && q.columns && q.rows) {
      const mainRows = q.rows.filter(r => r.codeType !== 'Other')
      if (mainRows.length > 0) {
        const firstRowCode = mainRows[0].code
        const lastRowCode = mainRows[mainRows.length - 1].code
        for (const col of q.columns) {
          lines.push(`count count_${q.id}_${col.code} = ${q.id}_${col.code}R${firstRowCode} to ${q.id}_${col.code}R${lastRowCode} (${firstRowCode} thru ${lastRowCode}).`)
        }
      }
    }
  }
  return lines
}

/**
 * Step 2: Generate missing & routing checks.
 * Uses ask_if_condition when present; otherwise applies to all.
 * Output: lowercase keywords, mis() for missing, clean structure.
 */
function generateMissingChecks(questions: ParsedQuestion[]): string[] {
  const lines: string[] = []
  const questionMap = new Map<string, ParsedQuestion>()
  questions.forEach(q => questionMap.set(q.id, q))
  for (const q of questions) {
    const condition = q.logic?.ask_if_condition?.replace(/^IF\s+/i, '').trim() || null

    if (q.type === 'SA' || q.type === 'OE') {
      const targetVar = q.id
      if (condition) {
        if (q.type === 'SA') {
          lines.push(`if ${condition} and mis(${targetVar}) check_mis_${q.id} = 1.`)
        } else {
          lines.push(`if ${condition} and (mis(${targetVar}) or ${targetVar} = "") check_mis_${q.id} = 1.`)
        }
      } else {
        if (q.type === 'SA') {
          lines.push(`if mis(${targetVar}) check_mis_${q.id} = 1.`)
        } else {
          lines.push(`if (mis(${targetVar}) or ${targetVar} = "") check_mis_${q.id} = 1.`)
        }
      }
    } else if (q.type === 'Numeric' && q.options && q.options.length > 0) {
      const firstVar = getVarName(q.id, 1, q.type)
      if (condition) {
        lines.push(`if ${condition} and mis(${firstVar}) check_mis_${q.id} = 1.`)
      } else {
        lines.push(`if mis(${firstVar}) check_mis_${q.id} = 1.`)
      }
    } else if (q.type === 'Rank_Fixed' || q.type === 'Rank_Upto') {
      if (q.options && q.options.length > 0) {
        const firstVar = getVarName(q.id, q.options[0].code, q.type)
        if (condition) {
          lines.push(`if ${condition} and mis(${firstVar}) check_mis_${q.id} = 1.`)
        } else {
          lines.push(`if mis(${firstVar}) check_mis_${q.id} = 1.`)
        }
      }
    } else if (q.type === 'MA') {
      if (condition) {
        lines.push(`if ${condition} and count_${q.id} = 0 check_mis_${q.id} = 1.`)
      } else {
        lines.push(`if count_${q.id} = 0 check_mis_${q.id} = 1.`)
      }
    } else if (q.type === 'MA_Grid' && q.columns && q.rows) {
      const pipingSource = q.logic?.piping_source
      const hasPiping = q.logic?.type === 'Piping' && pipingSource
      const sourceQuestion = pipingSource ? questionMap.get(pipingSource) : null

      if (hasPiping && sourceQuestion) {
        for (const col of q.columns) {
          const sourceQid = sourceQuestion.type === 'MA_Grid' ? `${pipingSource}_${col.code}` : `${pipingSource}R${col.code}`
          const sourceVar = sourceQuestion.type === 'MA_Grid' ? `count_${sourceQid}` : `${pipingSource}R${col.code}`
          const forwardCond = sourceQuestion.type === 'MA_Grid'
            ? `count_${sourceQid} > 0 and count_${q.id}_${col.code} = 0`
            : `${sourceVar} = ${col.code} and count_${q.id}_${col.code} = 0`
          const backwardCond = sourceQuestion.type === 'MA_Grid'
            ? `count_${q.id}_${col.code} > 0 and count_${sourceQid} = 0`
            : `count_${q.id}_${col.code} > 0 and mis(${sourceVar})`
          if (condition) {
            lines.push(`if ${condition} and ${forwardCond} check_${sourceQid.replace(/R\d+$/, '')}_${q.id}_code${col.code} = 1.`)
            lines.push(`if ${condition} and ${backwardCond} check_${q.id}_${pipingSource}_code${col.code} = 1.`)
          } else {
            lines.push(`if ${forwardCond} check_${sourceQid.replace(/R\d+$/, '')}_${q.id}_code${col.code} = 1.`)
            lines.push(`if ${backwardCond} check_${q.id}_${pipingSource}_code${col.code} = 1.`)
          }
        }
      } else {
        for (const col of q.columns) {
          if (condition) {
            lines.push(`if ${condition} and count_${q.id}_${col.code} = 0 check_mis_${q.id}_${col.code} = 1.`)
          } else {
            lines.push(`if count_${q.id}_${col.code} = 0 check_mis_${q.id}_${col.code} = 1.`)
          }
        }
      }
    } else if (q.type === 'SA_Grid' || q.type === 'Sum') {
      const items = q.rows || q.options || []
      const mainItems = items.filter((i: any) => !String(i.code).endsWith('_O'))
      const count = mainItems.length
      if (count > 1) {
        const firstRowCode = mainItems[0].code
        const lastRowCode = mainItems[count - 1].code
        const firstVar = `${q.id}_${firstRowCode}`
        const lastVar = `${q.id}_${lastRowCode}`
        const nvalidCheck = `nvalid(${firstVar} to ${lastVar}) <> ${count}`
        if (condition) {
          lines.push(`if ${condition} and ${nvalidCheck} check_mis_${q.id} = 1.`)
        } else {
          lines.push(`if ${nvalidCheck} check_mis_${q.id} = 1.`)
        }
        if (q.type === 'Sum') {
          const sumCheck = `sum(${firstVar} to ${lastVar}) <> 100`
          if (condition) {
            lines.push(`if ${condition} and ${sumCheck} check_sum_${q.id} = 1.`)
          } else {
            lines.push(`if ${sumCheck} check_sum_${q.id} = 1.`)
          }
        }
      } else if (count === 1) {
        const targetVar = getVarName(q.id, mainItems[0].code, q.type)
        if (condition) {
          lines.push(`if ${condition} and mis(${targetVar}) check_mis_${q.id} = 1.`)
        } else {
          lines.push(`if mis(${targetVar}) check_mis_${q.id} = 1.`)
        }
      }
    } else if (q.type === 'OE_Grid') {
      const items = q.rows || q.options || []
      for (const item of items) {
        const targetVar = getVarName(q.id, item.code, q.type)
        if (condition) {
          lines.push(`if ${condition} and mis(${targetVar}) check_mis_${targetVar} = 1.`)
        } else {
          lines.push(`if mis(${targetVar}) check_mis_${targetVar} = 1.`)
        }
      }
    }
  }
  return lines
}

/**
 * Step 3: Generate 'Other' text validation checks.
 * Tick without text ONLY. Simple = "" comparison. No LTRIM/RTRIM. No reverse checks.
 */
function generateOtherTextChecks(questions: ParsedQuestion[]): string[] {
  const lines: string[] = []
  for (const q of questions) {
    if (q.type === 'SA' || q.type === 'OE') {
      const otherOpts = q.options?.filter(o => o.codeType === 'Other') || []
      if (otherOpts.length > 0) {
        for (const otherOpt of otherOpts) {
          const code = otherOpt.code
          const textVar = otherOpts.length === 1 ? `${q.id}_O` : `${q.id}_${code}_O`
          lines.push(`if ${q.id} = ${code} and ${textVar} = "" check_${textVar} = 1.`)
        }
      } else if (q.saTextCompanions && q.saTextCompanions.length > 0) {
        const uniqueCompanions = [...new Set(q.saTextCompanions)]
        const otherOpt = q.options?.find(o => o.codeType === 'Other')
        const code = otherOpt ? otherOpt.code : 99
        uniqueCompanions.forEach((_, idx) => {
          const textVar = uniqueCompanions.length === 1 ? `${q.id}_O` : `${q.id}_${idx + 1}_O`
          lines.push(`if ${q.id} = ${code} and ${textVar} = "" check_${textVar} = 1.`)
        })
      }
    } else if (q.type === 'MA' && q.options) {
      for (const opt of q.options) {
        if (opt.codeType === 'Other') {
          const baseVar = `${q.id}R${opt.code}`
          const textVar = `${baseVar}_O`
          lines.push(`if ${baseVar} = ${opt.code} and ${textVar} = "" check_${textVar} = 1.`)
        }
      }
    } else if (q.type === 'MA_Grid' && q.columns && q.rows) {
      const otherRows = q.rows.filter(r => r.codeType === 'Other')
      for (const col of q.columns) {
        for (const row of otherRows) {
          const baseVar = `${q.id}_${col.code}R${row.code}`
          const textVar = `${baseVar}_O`
          const code = row.code
          lines.push(`if ${baseVar} = ${code} and ${textVar} = "" check_${textVar} = 1.`)
        }
      }
    } else if ((q.type === 'SA_Grid' || q.type === 'OE_Grid') && q.options) {
      for (const opt of q.options) {
        if (opt.codeType === 'Other') {
          const baseVar = `${q.id}_${opt.code}`
          const textVar = `${baseVar}_O`
          lines.push(`if ${baseVar} = ${opt.code} and ${textVar} = "" check_${textVar} = 1.`)
        }
      }
    }
  }
  return lines
}

/**
 * Step 4: Generate option-level constraints (Exclusive, Trap).
 */
function generateOptionConstraints(questions: ParsedQuestion[]): string[] {
  const lines: string[] = []
  for (const q of questions) {
    const opts = q.options || q.rows || []
    const mainOpts = opts.filter(o => !String(o.code).endsWith('_O') && o.codeType !== 'Other')

    for (const opt of opts) {
      if (opt.codeType === 'Exclusive') {
        const baseVar = q.type === 'MA' ? `${q.id}R${opt.code}` : q.type === 'MA_Grid' ? null : `${q.id}_${opt.code}`
        if (baseVar && q.type === 'MA') {
          lines.push(`if ${baseVar} = ${opt.code} and count_${q.id} > 1 check_${baseVar}_excl = 1.`)
        } else if (q.type === 'MA_Grid' && q.columns) {
          for (const col of q.columns) {
            const baseVarGrid = `${q.id}_${col.code}R${opt.code}`
            lines.push(`if ${baseVarGrid} = ${opt.code} and count_${q.id}_${col.code} > 1 check_${baseVarGrid}_excl = 1.`)
          }
        }
      } else if (opt.codeType === 'Trap') {
        // Trap == Terminate: use same logic as Terminate (terminate_if handles both)
        // Trap codes are merged into terminate_if by logic model converter; generateTerminateCheck outputs check_${questionId}_terminate = 1
        // Skip separate trap check - Trap and Terminate generate identical QC output
      }
    }
  }
  return lines
}

/**
 * Main unified QC syntax exporter.
 * Combines Count, Missing, Other Text, Option Constraints, and optional custom script.
 */
export function generateAllQCSyntax(
  questions: ParsedQuestion[],
  customScript?: string
): string {
  const countLines = generateCountStatements(questions)
  const missingLines = generateMissingChecks(questions)
  const otherLines = generateOtherTextChecks(questions)
  const optionLines = generateOptionConstraints(questions)

  const sections: string[] = [
    '* ===== COUNT STATEMENTS =====.',
    ...countLines,
    '',
    '* ===== MISSING & ROUTING CHECKS =====.',
    ...missingLines,
    '',
    '* ===== OTHER TEXT CHECKS =====.',
    ...otherLines,
    '',
    '* ===== OPTION CONSTRAINTS =====.',
    ...optionLines,
  ]

  if (customScript && customScript.trim()) {
    sections.push('')
    sections.push('* ===== CUSTOM QC INSIGHTS =====.')
    sections.push(customScript.trim())
  }

  return sections.join('\n')
}
