'use client'

import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import {
  ReactFlow,
  type Node,
  type Edge,
  type EdgeProps,
  type Connection,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
  ReactFlowProvider,
  Handle,
  Position,
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
  getOutgoers,
  getIncomers,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion } from 'framer-motion'
import MainLayout from '../Layout/MainLayout'
import ThemeToggle from '../ThemeToggle'
import { Network, Code, Download, X, FileText, ChevronDown, ChevronRight, Trash2, ChevronUp } from 'lucide-react'
import { useSurveyStore } from '@/store/surveyStore'
import { convertQuestionsToLogicModel } from '@/lib/logicModelConverter'
import { generateQCSyntaxFromFlow } from '@/lib/generators/qcSyntaxGenerator'

/** Question type accent: left border (4px) color for visual scanning */
function getQuestionTypeAccent(questionType: string | undefined): string {
  if (!questionType) return 'border-l-4 border-l-blue-400'
  if (questionType === 'SA') return 'border-l-4 border-l-blue-400'
  if (questionType === 'MA') return 'border-l-4 border-l-orange-400'
  if (questionType === 'SA_Grid' || questionType === 'MA_Grid') return 'border-l-4 border-l-purple-400'
  if (questionType === 'OE' || questionType === 'OE_Grid') return 'border-l-4 border-l-green-400'
  if (questionType.startsWith('Rank')) return 'border-l-4 border-l-amber-400'
  if (questionType === 'Numeric') return 'border-l-4 border-l-cyan-400'
  return 'border-l-4 border-l-blue-400'
}

// Custom Node: Question (memoized for performance)
const QuestionNode = React.memo(({
  data,
  selected,
  id,
}: {
  data: Record<string, unknown>
  selected?: boolean
  id: string
}) => {
  const label = data.label as string
  const questionType = data.questionType as string | undefined
  const terminateIf = data.terminateIf as string | undefined
  const hasTerminateIf = !!terminateIf
  const gridDimensions = data.gridDimensions as { rows: number; cols: number } | undefined
  const isGridAggregated = Boolean(gridDimensions && gridDimensions.rows > 0)
  const hasChildren = Boolean(data.hasChildren) && !isGridAggregated
  const isExpanded = data.isExpanded !== false
  const onToggleExpand = data.onToggleExpand as ((qId: string) => void) | undefined
  const accent = getQuestionTypeAccent(questionType)
  return (
    <div
      className={`px-4 py-3 bg-blue-500 dark:bg-blue-600 text-white rounded-lg shadow-lg border-2 ${accent} min-w-[120px] text-center relative group ${selected ? 'ring-4 ring-yellow-400 shadow-xl' : 'border-blue-400 dark:border-blue-500'}`}
      title={hasTerminateIf ? `Condition: ${terminateIf}` : undefined}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-blue-300 dark:!bg-blue-400 !border-2 !border-blue-600 dark:!border-blue-500" />
      <div className="font-bold text-sm flex items-center justify-center gap-1">
        {hasChildren && onToggleExpand && (
          <button
            type="button"
            className="nodrag nopan p-0.5 hover:bg-white/20 rounded transition-colors"
            onClick={(e) => { e.stopPropagation(); onToggleExpand(id) }}
            title={isExpanded ? 'Collapse children' : 'Expand children'}
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}
        {label}
      </div>
      {questionType && <div className="text-xs opacity-90 mt-1">{questionType}</div>}
      {isGridAggregated && gridDimensions && (
        <span className="inline-block mt-1 text-[10px] bg-purple-900 text-purple-200 px-2 py-0.5 rounded-full">
          Grid: {gridDimensions.cols}x{gridDimensions.rows}
        </span>
      )}
      {hasTerminateIf && <div className="text-xs opacity-75 mt-1 text-orange-200 dark:text-orange-300">⚠️ Has Condition</div>}
      {hasTerminateIf && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap border border-orange-500">
          <div className="font-bold text-orange-400 mb-1">Terminate Condition:</div>
          <div className="font-mono">{terminateIf}</div>
        </div>
      )}
      {hasTerminateIf && (
        <Handle type="source" position={Position.Top} id="top-source" className="w-3 h-3 !bg-red-300 dark:!bg-red-400 !border-2 !border-red-600 dark:!border-red-500" />
      )}
      <Handle type="source" position={Position.Right} id="source-right" className="w-3 h-3 !bg-blue-300 dark:!bg-blue-400 !border-2 !border-blue-600 dark:!border-blue-500" />
    </div>
  )
})

// Custom Node: Code (memoized for performance) - Trap & Terminate get same red styling
const CodeNode = React.memo(({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) => {
  const label = data.label as string
  const hasCondition = Boolean(data.hasCondition)
  const isTrapOrTerminate = Boolean(data.isTrapOrTerminate)
  const optionLabel = data.optionLabel as string | null | undefined
  const trapOrTerminateStyle = isTrapOrTerminate
  const bgColor = trapOrTerminateStyle ? 'bg-red-500 dark:bg-red-600' : hasCondition ? 'bg-orange-200 dark:bg-orange-800' : 'bg-gray-200 dark:bg-gray-700'
  const borderColor = trapOrTerminateStyle ? 'border-red-400 dark:border-red-500' : hasCondition ? 'border-orange-500 dark:border-orange-400' : 'border-gray-300 dark:border-gray-600'
  const textColor = trapOrTerminateStyle ? 'text-white' : hasCondition ? 'text-orange-900 dark:text-orange-100' : 'text-gray-900 dark:text-gray-100'
  return (
    <div className={`px-3 py-2 ${bgColor} ${textColor} rounded-lg shadow-md border-2 ${borderColor} min-w-[100px] text-center relative group ${trapOrTerminateStyle ? 'ring-2 ring-red-400 dark:ring-red-500' : hasCondition ? 'ring-2 ring-orange-400 dark:ring-orange-500' : ''} ${selected ? 'ring-4 ring-yellow-400 shadow-xl' : ''}`}>
      <Handle type="target" position={Position.Left} className={`w-3 h-3 ${trapOrTerminateStyle ? '!bg-red-300 dark:!bg-red-400 !border-2 !border-red-600 dark:!border-red-500' : hasCondition ? '!bg-orange-400 dark:!bg-orange-500 !border-2 !border-orange-600 dark:!border-orange-400' : '!bg-gray-400 dark:!bg-gray-500 !border-2 !border-gray-600 dark:!border-gray-400'}`} />
      <div className={`font-semibold text-xs ${hasCondition || trapOrTerminateStyle ? 'font-bold' : ''}`}>
        {label}
        {(hasCondition || trapOrTerminateStyle) && <span className="ml-1">⚠️</span>}
      </div>
      {optionLabel != null && optionLabel !== '' && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-blue-500 min-w-[200px] max-w-md">
          <div className="font-bold text-blue-400 mb-1">Label:</div>
          <div className="break-words whitespace-normal">{optionLabel}</div>
        </div>
      )}
      <Handle type="source" position={Position.Right} className={`w-3 h-3 ${trapOrTerminateStyle ? '!bg-red-300 dark:!bg-red-400 !border-2 !border-red-600 dark:!border-red-500' : hasCondition ? '!bg-orange-400 dark:!bg-orange-500 !border-2 !border-orange-600 dark:!border-orange-400' : '!bg-gray-400 dark:!bg-gray-500 !border-2 !border-gray-600 dark:!border-gray-400'}`} />
    </div>
  )
})

// Custom Node: Intermediate (MA_Grid row)
const IntermediateNode = React.memo(({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) => {
  const label = data.label as string
  return (
    <div className={`px-4 py-3 bg-purple-500 dark:bg-purple-600 text-white rounded-lg shadow-lg border-2 border-purple-400 dark:border-purple-500 min-w-[120px] text-center relative ${selected ? 'ring-4 ring-yellow-400 shadow-xl' : ''}`}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-purple-300 dark:!bg-purple-400 !border-2 !border-purple-600 dark:!border-purple-500" />
      <div className="font-bold text-sm">{label}</div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-purple-300 dark:!bg-purple-400 !border-2 !border-purple-600 dark:!border-purple-500" />
    </div>
  )
})

// Custom Node: Terminate (memoized for performance) - target at Bottom for top-to-bottom routing
const TerminateNode = React.memo(({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) => {
  const formattedCondition = data.formattedCondition as string | undefined
  return (
    <div className={`px-3 py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg shadow-md border-2 border-red-400 dark:border-red-500 min-w-[100px] text-center text-xs ${selected ? 'ring-4 ring-yellow-400 shadow-xl' : ''}`}>
      <Handle type="target" position={Position.Bottom} id="top-target" className="w-3 h-3 !bg-red-300 dark:!bg-red-400 !border-2 !border-red-600 dark:!border-red-500" />
      <div className="font-semibold">Terminate</div>
      {formattedCondition && <div className="text-[10px] opacity-90 mt-1 truncate max-w-[140px]" title={formattedCondition}>{formattedCondition}</div>}
    </div>
  )
})

const nodeTypes = {
  question: QuestionNode,
  code: CodeNode,
  intermediate: IntermediateNode,
  terminate: TerminateNode,
}

// Custom Bezier Edge with label (memoized, no animation for performance)
const CustomBezierEdge = React.memo(({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  data,
  selected,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = useMemo(
    () =>
      getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      }),
    [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]
  )
  const condition = data && typeof data === 'object' && 'condition' in data ? (data as { condition?: string }).condition : null
  const isTerminateEdge = data && typeof data === 'object' && 'isTerminateEdge' in data ? (data as { isTerminateEdge?: boolean }).isTerminateEdge : false
  const selectedStyle = selected
    ? { stroke: '#3B82F6', strokeWidth: 4, strokeDasharray: 'none' as const }
    : {}
  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, ...selectedStyle }} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div className="relative group cursor-pointer inline-block">
              <div className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-sm text-xs font-semibold">
                {label}
              </div>
              {condition && (
                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[9999] ${isTerminateEdge ? 'border border-red-500' : 'border border-green-500'}`}>
                  <div className={`font-bold mb-1 ${isTerminateEdge ? 'text-red-400' : 'text-green-400'}`}>
                    {isTerminateEdge ? 'Terminate Condition:' : 'Ask if Condition:'}
                  </div>
                  <div className="font-mono">{condition}</div>
                </div>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})

const edgeTypes = { curved: CustomBezierEdge }

const getConnectionColor = (type: string): string => {
  switch (type) {
    case 'F0': return '#6B7280'
    case 'F1': return '#3B82F6'
    case 'F2': return '#8B5CF6'
    case 'ASK_IF': return '#10B981'
    case 'PIPING': return '#10B981'
    default: return '#6B7280'
  }
}

/** Extract question ID from any node (question, code, intermediate, terminate) */
function getQuestionIdFromNode(node: Node): string | null {
  if (node.type === 'question') return node.id
  const qId = node.data?.questionId as string | undefined
  if (qId) return qId
  if (node.type === 'terminate' && node.id.endsWith('_terminate')) {
    return node.id.replace(/_terminate$/, '')
  }
  // Code/intermediate nodes: id might be Q1R1 or Q1_1 - extract question part
  const match = node.id.match(/^([A-Z]\d+[A-Z]?\d*)/i)
  return match ? match[1] : null
}

/** Extract source question ID from source node ID (e.g. Q1R1 -> Q1, Q1 -> Q1) */
function getSourceQuestionId(sourceNodeId: string): string {
  const match = sourceNodeId.match(/^([A-Z]\d+[A-Z]?\d*)/i)
  return match ? match[1] : sourceNodeId
}

/** Extract code from piping source node ID for 1-to-1 binding (Q7R3 -> "3", Q7_1 -> "1") */
function extractCodeFromPipingSource(sourceNodeId: string): string | null {
  const rMatch = sourceNodeId.match(/R(\d+)$/)
  if (rMatch) return rMatch[1]
  const uMatch = sourceNodeId.match(/_(\d+)$/)
  return uMatch ? uMatch[1] : null
}

/** Question types that allow connection directly from parent (Aggregated Smart Node: no visual child nodes) */
const ALLOW_PARENT_CONNECTION_TYPES = ['SA_Grid', 'MA_Grid', 'OE_Grid', 'Numeric'] as const

/** Check if connecting from this source node is allowed. For SA/MA/OE/Rank, must connect from option nodes (CodeNode). */
function isConnectionFromSourceAllowed(sourceNode: Node): boolean {
  if (sourceNode.type !== 'question') return true // code/intermediate: always allowed
  const qt = sourceNode.data?.questionType as string | undefined
  if (!qt) return true
  if (ALLOW_PARENT_CONNECTION_TYPES.includes(qt as any)) return true
  // SA, MA, OE, Rank_Fixed, Rank_Upto: must connect from option nodes
  return false
}

/** Generate a basic ask_if condition from source node (e.g. "IF Q1 = 1" or "IF Q1R1 = 1") */
function generateBasicAskIfCondition(sourceNodeId: string, sourceHandle: string | null): string {
  const isTerminateHandle = sourceHandle === 'top-source' || sourceHandle === 'terminate'
  if (isTerminateHandle) {
    const qId = getSourceQuestionId(sourceNodeId)
    return `IF ${sourceNodeId} = 1`
  }
  if (sourceNodeId.includes('R') || sourceNodeId.includes('_')) {
    return `IF ${sourceNodeId} = 1`
  }
  return `IF ${sourceNodeId} = 1`
}

function QCLogicCanvas() {
  const { parsedQuestions, oldVariableMapping, generateQCLogicGraph, setEditingQuestionId, deleteQuestion, updateQuestion } = useSurveyStore()

  // Expand/Collapse: Set of collapsed question IDs (empty = all expanded)
  const [collapsedQuestions, setCollapsedQuestions] = useState<Set<string>>(() => new Set())

  // Context menu: position and selected node
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: Node } | null>(null)

  // Edge edit modal: which edge is being edited
  const [edgeEditModal, setEdgeEditModal] = useState<{ edge: Edge; x: number; y: number } | null>(null)

  // Connection rejection toast (for SA/MA parent connection rule)
  const [connectionRejectMsg, setConnectionRejectMsg] = useState<string | null>(null)

  // Bi-directional sync: deletedEdgeIds for F0; piping_excluded_codes for per-column piping (1-to-1 binding)
  const [deletedEdgeIds, setDeletedEdgeIds] = useState<Set<string>>(() => new Set())

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  // Clear connection rejection toast after 3 seconds
  useEffect(() => {
    if (!connectionRejectMsg) return
    const t = setTimeout(() => setConnectionRejectMsg(null), 3000)
    return () => clearTimeout(t)
  }, [connectionRejectMsg])

  // Compute qcLogicGraph lazily when user navigates here (for project save; display uses LogicModel)
  useEffect(() => {
    generateQCLogicGraph()
  }, [parsedQuestions, generateQCLogicGraph])
  const [showSyntaxBox, setShowSyntaxBox] = useState(false)
  const [syntaxFromFlow, setSyntaxFromFlow] = useState<string>('')
  const [syntaxError, setSyntaxError] = useState<string | null>(null)

  const initialGraph = useMemo(() => {
    if (parsedQuestions.length === 0) return { nodes: [], edges: [] }
    const graph = convertQuestionsToLogicModel(parsedQuestions, oldVariableMapping)
    const rfNodes: Node[] = graph.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    }))
    const rfEdges: Edge[] = graph.edges.map((edge) => {
      const connectionType = edge.type || 'F1'
      const color = getConnectionColor(connectionType)
      const isTerminateEdge = connectionType === 'ASK_IF' && edge.target.endsWith('_terminate')
      const label = isTerminateEdge ? 'Terminate' : (edge.label || connectionType)
      let sourceHandle: string | undefined
      let targetHandle: string | undefined
      if (connectionType === 'ASK_IF' && edge.target.endsWith('_terminate')) {
        sourceHandle = 'top-source'
        targetHandle = 'top-target'
      } else if (['F1', 'F0', 'PIPING', 'ASK_IF'].includes(connectionType)) {
        const sourceNode = rfNodes.find((n) => n.id === edge.source)
        if (sourceNode?.type === 'question') sourceHandle = 'source-right'
      }
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle,
        targetHandle,
        type: 'curved',
        label,
        animated: false,
        selectable: true,
        data: { connectionType, condition: edge.condition, isTerminateEdge },
        style: {
          stroke: color,
          strokeWidth: connectionType === 'ASK_IF' ? 2.5 : 2,
          strokeDasharray: ['ASK_IF', 'PIPING'].includes(connectionType) ? '5,5' : 'none',
        },
        markerEnd: { type: 'arrowclosed', color },
      }
    })
    return { nodes: rfNodes, edges: rfEdges }
  }, [parsedQuestions, oldVariableMapping])

  const handleToggleExpand = useCallback((questionId: string) => {
    setCollapsedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      return next
    })
  }, [])

  const { nodesWithExpansion, edgesWithExpansion } = useMemo(() => {
    const baseNodes = initialGraph.nodes
    const baseEdges = initialGraph.edges
    const collapsed = collapsedQuestions

    const childIdsByParent = new Map<string, string[]>()
    for (const n of baseNodes) {
      if (n.type === 'question') continue
      const qId = getQuestionIdFromNode(n)
      if (qId) {
        const arr = childIdsByParent.get(qId) || []
        arr.push(n.id)
        childIdsByParent.set(qId, arr)
      }
    }

    const hiddenNodeIds = new Set<string>()
    for (const [qId, childIds] of childIdsByParent) {
      if (collapsed.has(qId)) childIds.forEach((id) => hiddenNodeIds.add(id))
    }
    for (const n of baseNodes) {
      if (n.type === 'terminate' && n.id.endsWith('_terminate')) {
        const qId = n.id.replace(/_terminate$/, '')
        if (collapsed.has(qId)) hiddenNodeIds.add(n.id)
      }
    }

    const nodesWithExpansion = baseNodes.map((node) => {
      const dup = { ...node, data: { ...node.data } }
      if (node.type === 'question') {
        dup.data.hasChildren = (childIdsByParent.get(node.id) || []).length > 0 || baseNodes.some((n) => n.type === 'terminate' && n.id === `${node.id}_terminate`)
        dup.data.isExpanded = !collapsed.has(node.id)
        dup.data.onToggleExpand = handleToggleExpand
      } else {
        const qId = getQuestionIdFromNode(node)
        dup.hidden = qId ? collapsed.has(qId) : false
      }
      return dup
    })

    const edgesWithExpansion = baseEdges.map((edge) => ({
      ...edge,
      hidden: hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target),
    }))

    return { nodesWithExpansion, edgesWithExpansion }
  }, [initialGraph.nodes, initialGraph.edges, collapsedQuestions, handleToggleExpand])

  const edgesFiltered = useMemo(
    () => edgesWithExpansion.filter((e) => !deletedEdgeIds.has(e.id)),
    [edgesWithExpansion, deletedEdgeIds]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithExpansion)
  const [edges, setEdges, onEdgesChange] = useEdgesState(edgesFiltered)

  const dragInitialPositions = useRef<Map<string, { x: number; y: number }>>(new Map())

  const getAllDownstream = useCallback((node: Node, nodesList: Node[], edgesList: Edge[]): Set<string> => {
    const visited = new Set<string>()
    const queue: Node[] = [node]
    while (queue.length > 0) {
      const n = queue.shift()!
      if (visited.has(n.id)) continue
      visited.add(n.id)
      const out = getOutgoers(n, nodesList, edgesList)
      out.forEach((o) => queue.push(o))
    }
    return visited
  }, [])

  const getAllUpstream = useCallback((node: Node, nodesList: Node[], edgesList: Edge[]): Set<string> => {
    const visited = new Set<string>()
    const queue: Node[] = [node]
    while (queue.length > 0) {
      const n = queue.shift()!
      if (visited.has(n.id)) continue
      visited.add(n.id)
      const inc = getIncomers(n, nodesList, edgesList)
      inc.forEach((i) => queue.push(i))
    }
    return visited
  }, [])

  const onNodeDragStart = useCallback((_: React.MouseEvent, _node: Node) => {
    dragInitialPositions.current.clear()
    nodes.forEach((n) => {
      dragInitialPositions.current.set(n.id, { x: n.position.x, y: n.position.y })
    })
  }, [nodes])

  const onNodeDrag = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (!event.altKey) return
      const initial = dragInitialPositions.current.get(node.id)
      if (!initial) return
      const deltaX = node.position.x - initial.x
      const deltaY = node.position.y - initial.y
      const nodesList = nodes
      const edgesList = edges
      let nodeIdsToMove: Set<string>
      if (deltaX > 0) {
        nodeIdsToMove = getAllDownstream(node, nodesList, edgesList)
      } else if (deltaX < 0) {
        nodeIdsToMove = getAllUpstream(node, nodesList, edgesList)
      } else {
        return
      }
      const updated = nodesList.map((n) => {
        if (!nodeIdsToMove.has(n.id)) return n
        const init = dragInitialPositions.current.get(n.id)
        if (!init) return n
        return {
          ...n,
          position: {
            x: init.x + deltaX,
            y: init.y + deltaY,
          },
        }
      })
      setNodes(updated)
    },
    [nodes, edges, getAllDownstream, getAllUpstream, setNodes]
  )

  const onNodeDragStop = useCallback(() => {
    dragInitialPositions.current.clear()
  }, [])

  useEffect(() => {
    setNodes(nodesWithExpansion)
    setEdges(edgesFiltered)
  }, [nodesWithExpansion, edgesFiltered, setNodes, setEdges])

  useEffect(() => {
    if (parsedQuestions.length > 0) {
      try {
        setSyntaxError(null)
        const graph = convertQuestionsToLogicModel(parsedQuestions, oldVariableMapping)
        const filteredGraph = {
          ...graph,
          edges: graph.edges.filter((e) => !deletedEdgeIds.has(e.id)),
        }
        const syntax = generateQCSyntaxFromFlow(filteredGraph, parsedQuestions, oldVariableMapping)
        setSyntaxFromFlow(syntax)
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        console.error('Error generating QC syntax:', err)
        setSyntaxFromFlow('')
        setSyntaxError(err.message)
      }
    } else {
      setSyntaxFromFlow('')
      setSyntaxError(null)
    }
  }, [parsedQuestions, oldVariableMapping, initialGraph, deletedEdgeIds])

  const handleExportSyntax = useCallback(() => {
    if (!syntaxFromFlow) return
    const blob = new Blob([syntaxFromFlow], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qc_logic_syntax_${new Date().toISOString().split('T')[0]}.sps`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [syntaxFromFlow])

  const handleToggleSyntaxBox = useCallback(() => {
    setShowSyntaxBox((prev) => !prev)
  }, [])

  const handleCloseSyntaxBox = useCallback(() => {
    setShowSyntaxBox(false)
  }, [])

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const questionId = getQuestionIdFromNode(node)
      if (!questionId) return
      const context = node.type === 'terminate' ? 'terminate' : node.data?.isTrapOrTerminate ? 'trap' : 'default'
      setEditingQuestionId(questionId, context)
    },
    [setEditingQuestionId]
  )

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }, [])

  const handleEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setEdgeEditModal({ edge, x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 100 })
  }, [])

  const handleNodesDelete = useCallback(
    (deleted: Node[]) => {
      if (deleted.length === 0) return
      setNodes((nds) => nds.filter((node) => !deleted.some((dn) => dn.id === node.id)))
      for (const node of deleted) {
        if (node.type === 'question') {
          deleteQuestion(node.id)
        } else {
          const questionId = getQuestionIdFromNode(node)
          if (questionId) deleteQuestion(questionId)
        }
      }
    },
    [setNodes, deleteQuestion]
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      const { source, target, sourceHandle } = connection
      if (!source || !target) return

      // Canvas connection rules: SA/MA must connect from option nodes; Grid/Numeric may connect from parent
      const sourceNode = nodes.find((n) => n.id === source)
      if (sourceNode && !isConnectionFromSourceAllowed(sourceNode)) {
        setConnectionRejectMsg('For SA/MA, please connect from the specific option nodes (expand the question first).')
        return
      }

      const targetQuestionId = parsedQuestions.some((q) => q.id === target) ? target : getSourceQuestionId(target)
      const question = parsedQuestions.find((q) => q.id === targetQuestionId)
      if (!question) return
      const sourceQId = getSourceQuestionId(source)
      const condition = generateBasicAskIfCondition(source, sourceHandle)
      const code = extractCodeFromPipingSource(source)
      const excluded = question.logic?.piping_excluded_codes || []
      const newExcluded = code ? excluded.filter((c) => String(c) !== code) : excluded
      updateQuestion(question.id, {
        logic: {
          ...question.logic,
          piping_source: sourceQId,
          ask_if_condition: condition,
          piping_excluded_codes: newExcluded.length > 0 ? newExcluded : undefined,
        },
      })
    },
    [nodes, parsedQuestions, updateQuestion]
  )

  const handleReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      const { source, target, sourceHandle } = newConnection
      if (!source || !target) return
      const connType = (oldEdge.data as { connectionType?: string })?.connectionType
      if (!['ASK_IF', 'PIPING'].includes(connType || '')) return

      // Canvas connection rules: SA/MA must connect from option nodes
      const sourceNode = nodes.find((n) => n.id === source)
      if (sourceNode && !isConnectionFromSourceAllowed(sourceNode)) {
        setConnectionRejectMsg('For SA/MA, please connect from the specific option nodes (expand the question first).')
        return
      }

      const oldTargetId = parsedQuestions.some((q) => q.id === oldEdge.target) ? oldEdge.target : getSourceQuestionId(oldEdge.target)
      const newTargetId = parsedQuestions.some((q) => q.id === target) ? target : getSourceQuestionId(target)
      const oldQuestion = parsedQuestions.find((q) => q.id === oldTargetId)
      const newQuestion = parsedQuestions.find((q) => q.id === newTargetId)

      if (oldQuestion && oldTargetId !== newTargetId) {
        updateQuestion(oldQuestion.id, { logic: { ...oldQuestion.logic, piping_source: null, ask_if_condition: null } })
      }
      if (newQuestion) {
        const sourceQId = getSourceQuestionId(source)
        const condition = generateBasicAskIfCondition(source, sourceHandle)
        updateQuestion(newQuestion.id, {
          logic: { ...newQuestion.logic, piping_source: sourceQId, ask_if_condition: condition },
        })
      }
    },
    [nodes, parsedQuestions, updateQuestion]
  )

  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (deleted.length === 0) return
      setEdges((eds) => eds.filter((edge) => !deleted.some((de) => de.id === edge.id)))
      const idsToDelete = new Set<string>()
      for (const edge of deleted) {
        const connType = (edge.data as { connectionType?: string })?.connectionType
        // PIPING: add code to piping_excluded_codes (1-to-1 binding; sibling edges unchanged)
        if (connType === 'PIPING') {
          const targetId = parsedQuestions.some((q) => q.id === edge.target) ? edge.target : getSourceQuestionId(edge.target)
          const question = parsedQuestions.find((q) => q.id === targetId)
          const code = extractCodeFromPipingSource(edge.source)
          if (question && code) {
            const excluded = new Set((question.logic?.piping_excluded_codes || []).map(String))
            excluded.add(code)
            updateQuestion(question.id, {
              logic: { ...question.logic, piping_excluded_codes: Array.from(excluded) },
            })
          }
        } else if (connType === 'ASK_IF') {
          const targetId = parsedQuestions.some((q) => q.id === edge.target) ? edge.target : getSourceQuestionId(edge.target)
          const question = parsedQuestions.find((q) => q.id === targetId)
          if (question) {
            updateQuestion(question.id, { logic: { ...question.logic, piping_source: null, ask_if_condition: null } })
          }
        } else {
          // F0 (structural): add to deletedEdgeIds so syntax generator excludes it
          idsToDelete.add(edge.id)
        }
      }
      if (idsToDelete.size > 0) {
        setDeletedEdgeIds((prev) => {
          const next = new Set(prev)
          idsToDelete.forEach((id) => next.add(id))
          return next
        })
      }
    },
    [setEdges, parsedQuestions, updateQuestion]
  )

  const handleContextMenuExpandCollapse = useCallback(() => {
    if (!contextMenu) return
    const questionId = getQuestionIdFromNode(contextMenu.node)
    if (questionId) handleToggleExpand(questionId)
    setContextMenu(null)
  }, [contextMenu, handleToggleExpand])

  const handleContextMenuDelete = useCallback(() => {
    if (!contextMenu) return
    const questionId = getQuestionIdFromNode(contextMenu.node)
    if (questionId) deleteQuestion(questionId)
    setContextMenu(null)
  }, [contextMenu, deleteQuestion])

  const handleEdgeTypeChange = useCallback(
    (edge: Edge, newType: string) => {
      const targetId = parsedQuestions.some((q) => q.id === edge.target) ? edge.target : getSourceQuestionId(edge.target)
      const question = parsedQuestions.find((q) => q.id === targetId)
      if (!question) return
      if (['ASK_IF', 'PIPING'].includes(newType)) {
        const sourceId = edge.source
        const sourceQId = getSourceQuestionId(sourceId)
        updateQuestion(question.id, {
          logic: {
            ...question.logic,
            piping_source: sourceQId,
            ask_if_condition: `IF ${sourceId} = 1`,
          },
        })
      } else {
        updateQuestion(question.id, { logic: { ...question.logic, piping_source: null, ask_if_condition: null } })
      }
      setEdgeEditModal(null)
    },
    [parsedQuestions, updateQuestion]
  )

  return (
    <MainLayout>
      <header className="h-16 flex items-center justify-between px-8 border-b border-border-light dark:border-border-dark flat-panel z-40 relative bg-background-light dark:bg-background-dark">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Network className="w-5 h-5 text-primary" />
            <span className="text-foreground font-semibold">QC Logic Canvas</span>
            {nodes.length > 0 && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                {nodes.length} nodes, {edges.length} edges
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {nodes.length > 0 && (
            <>
              <button
                onClick={handleToggleSyntaxBox}
                className="flex items-center gap-2 px-3 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg transition-all"
              >
                <FileText className="w-4 h-4" />
                <span>Show QC Logic Syntax</span>
              </button>
              {syntaxFromFlow && (
                <button
                  onClick={handleExportSyntax}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
              )}
            </>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 relative flex flex-col overflow-hidden">
        <div className="absolute inset-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            defaultEdgeOptions={{ selectable: true, interactionWidth: 20 }}
            deleteKeyCode={['Backspace', 'Delete']}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodesDelete={handleNodesDelete}
            onEdgesDelete={handleEdgesDelete}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onNodeDoubleClick={handleNodeDoubleClick}
            onNodeContextMenu={handleNodeContextMenu}
            onEdgeDoubleClick={handleEdgeDoubleClick}
            onConnect={handleConnect}
            onReconnect={handleReconnect}
            edgesReconnectable
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2}
            onlyRenderVisibleElements
          >
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                const t = node.type ?? 'question'
                if (t === 'question') return '#3B82F6'
                if (t === 'code') return '#6B7280'
                if (t === 'intermediate') return '#8B5CF6'
                if (t === 'terminate') return '#EF4444'
                return '#6B7280'
              }}
              maskColor="rgba(0,0,0,0.1)"
              pannable
              zoomable
            />
            <Panel position="top-center" className="m-4 flex justify-center">
              {connectionRejectMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-4 py-2 bg-amber-500/90 dark:bg-amber-600/90 text-amber-950 dark:text-amber-100 rounded-lg shadow-lg text-sm font-medium"
                >
                  {connectionRejectMsg}
                </motion.div>
              )}
            </Panel>
            <Panel position="top-left" className="m-4">
              {showSyntaxBox && (syntaxFromFlow || syntaxError) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[500px] max-h-[400px] flex flex-col overflow-hidden"
                >
                  <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <div className="flex items-center gap-2">
                      <Code className="w-5 h-5 text-primary" />
                      <h3 className="font-bold text-gray-900 dark:text-white">QC Logic Syntax</h3>
                    </div>
                    <button
                      onClick={handleCloseSyntaxBox}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 bg-[#1e1e1e] font-mono text-xs">
                    {syntaxError ? (
                      <div className="text-red-400">
                        <div className="font-bold mb-2">Error:</div>
                        <pre className="whitespace-pre-wrap" style={{ whiteSpace: 'pre-wrap', color: 'inherit' }}>{syntaxError}</pre>
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap text-gray-300" style={{ whiteSpace: 'pre-wrap', color: 'inherit' }}>{syntaxFromFlow}</pre>
                    )}
                  </div>
                  <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end">
                    <button
                      onClick={handleExportSyntax}
                      className="px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </Panel>
          </ReactFlow>
        </div>

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Network className="w-16 h-16 text-primary/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No QC Logic Graph</h3>
              <p className="text-sm text-muted-foreground">
                {parsedQuestions.length === 0
                  ? 'Import questions first to generate QC Logic Graph'
                  : 'QC Logic Graph will be generated when you navigate here'}
              </p>
            </div>
          </div>
        )}

        {/* Node Context Menu */}
        {contextMenu && (
          <div
            className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.node.type === 'question' && Boolean(contextMenu.node.data?.hasChildren) ? (
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                onClick={handleContextMenuExpandCollapse}
              >
                {Boolean(contextMenu.node.data?.isExpanded) ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Expand
                  </>
                )}
              </button>
            ) : null}
            <button
              type="button"
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
              onClick={handleContextMenuDelete}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}

        {/* Edge Edit Modal */}
        {edgeEditModal && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30"
            onClick={() => setEdgeEditModal(null)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 w-[280px]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold text-sm mb-3">Edit Connection Type</h3>
              <div className="flex flex-wrap gap-2">
                {['F0', 'F1', 'F2', 'ASK_IF', 'PIPING'].map((t) => {
                  const current = (edgeEditModal.edge.data as { connectionType?: string })?.connectionType || 'F1'
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${current === t ? 'bg-primary text-white border-primary' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600'}`}
                      onClick={() => handleEdgeTypeChange(edgeEditModal.edge, t)}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                className="mt-3 w-full py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setEdgeEditModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    </MainLayout>
  )
}

export default function QCLogicNebula() {
  return (
    <ReactFlowProvider>
      <QCLogicCanvas />
    </ReactFlowProvider>
  )
}
