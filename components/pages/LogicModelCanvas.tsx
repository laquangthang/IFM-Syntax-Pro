'use client'

import { useCallback, useMemo, useEffect, useState, useRef } from 'react'
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
  addEdge,
  Panel,
  ReactFlowProvider,
  Handle,
  Position,
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import MainLayout from '../Layout/MainLayout'
import ThemeToggle from '../ThemeToggle'
import { useSurveyStore } from '@/store/surveyStore'
import { convertQuestionsToLogicModel, LogicModelNode, LogicModelEdge, LogicModelGraph } from '@/lib/logicModelConverter'
import { Package2, Trash2, Edit2, Eye, EyeOff, X, FileText, Code, Download } from 'lucide-react'
import { generateQCSyntaxFromFlow } from '@/lib/qcSyntaxGeneratorFromFlow'
import { motion } from 'framer-motion'

// Custom Node Component for Questions
const QuestionNode = ({ data }: { data: any }) => {
  const hasTerminateIf = !!data.terminateIf
  
  return (
    <div 
      className="px-4 py-3 bg-blue-500 dark:bg-blue-600 text-white rounded-lg shadow-lg border-2 border-blue-400 dark:border-blue-500 min-w-[120px] text-center relative group"
      title={hasTerminateIf ? `Condition: ${data.terminateIf}` : undefined}
    >
      {/* Target Handle - Left side for incoming connections */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-blue-300 dark:!bg-blue-400 !border-2 !border-blue-600 dark:!border-blue-500"
      />
      
      <div className="font-bold text-sm">{data.label}</div>
      {data.questionType && (
        <div className="text-xs opacity-90 mt-1">{data.questionType}</div>
      )}
      {hasTerminateIf && (
        <div className="text-xs opacity-75 mt-1 text-orange-200 dark:text-orange-300">
          ⚠️ Has Condition
        </div>
      )}
      
      {/* Tooltip on hover */}
      {hasTerminateIf && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap border border-orange-500">
          <div className="font-bold text-orange-400 mb-1">Terminate Condition:</div>
          <div className="font-mono">{data.terminateIf}</div>
        </div>
      )}
      
      {/* Source Handle - Top side for terminate connections */}
      {hasTerminateIf && (
        <Handle
          type="source"
          position={Position.Top}
          id="terminate"
          className="w-3 h-3 !bg-red-300 dark:!bg-red-400 !border-2 !border-red-600 dark:!border-red-500"
        />
      )}
      
      {/* Source Handle - Right side for outgoing connections (F1, F0 edges) */}
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="w-3 h-3 !bg-blue-300 dark:!bg-blue-400 !border-2 !border-blue-600 dark:!border-blue-500"
      />
    </div>
  )
}

// Custom Node Component for Codes
const CodeNode = ({ data }: { data: any }) => {
  const hasCondition = data.hasCondition || false
  const optionLabel = data.optionLabel || null
  
  // Highlight color for nodes with condition
  const bgColor = hasCondition 
    ? 'bg-orange-200 dark:bg-orange-800' 
    : 'bg-gray-200 dark:bg-gray-700'
  const borderColor = hasCondition
    ? 'border-orange-500 dark:border-orange-400'
    : 'border-gray-300 dark:border-gray-600'
  const textColor = hasCondition
    ? 'text-orange-900 dark:text-orange-100'
    : 'text-gray-900 dark:text-gray-100'
  
  return (
    <div className={`px-3 py-2 ${bgColor} ${textColor} rounded-lg shadow-md border-2 ${borderColor} min-w-[100px] text-center relative group ${hasCondition ? 'ring-2 ring-orange-400 dark:ring-orange-500' : ''}`}>
      {/* Target Handle - Left side for incoming connections */}
      <Handle
        type="target"
        position={Position.Left}
        className={`w-3 h-3 ${hasCondition ? '!bg-orange-400 dark:!bg-orange-500 !border-2 !border-orange-600 dark:!border-orange-400' : '!bg-gray-400 dark:!bg-gray-500 !border-2 !border-gray-600 dark:!border-gray-400'}`}
      />
      
      <div className={`font-semibold text-xs ${hasCondition ? 'font-bold' : ''}`}>
        {data.label}
        {hasCondition && <span className="ml-1">⚠️</span>}
      </div>
      
      {/* Tooltip on hover - show option label if available */}
      {optionLabel && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-blue-500 min-w-[200px] max-w-md">
          <div className="font-bold text-blue-400 mb-1">Label:</div>
          <div className="break-words whitespace-normal">{optionLabel}</div>
        </div>
      )}
      
      {/* Source Handle - Right side for outgoing connections */}
      <Handle
        type="source"
        position={Position.Right}
        className={`w-3 h-3 ${hasCondition ? '!bg-orange-400 dark:!bg-orange-500 !border-2 !border-orange-600 dark:!border-orange-400' : '!bg-gray-400 dark:!bg-gray-500 !border-2 !border-gray-600 dark:!border-gray-400'}`}
      />
    </div>
  )
}

// Custom Node Component for Intermediate (MA_Grid row nodes)
const IntermediateNode = ({ data }: { data: any }) => {
  const isExpanded = data.isExpanded || false
  const hasChildren = data.hasChildren || false
  
  return (
    <div className="px-4 py-3 bg-purple-500 dark:bg-purple-600 text-white rounded-lg shadow-lg border-2 border-purple-400 dark:border-purple-500 min-w-[120px] text-center relative">
      {/* Target Handle - Left side for incoming connections */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-purple-300 dark:!bg-purple-400 !border-2 !border-purple-600 dark:!border-purple-500"
      />
      
      <div className="font-bold text-sm">{data.label}</div>
      {data.questionType && (
        <div className="text-xs opacity-90 mt-1">{data.questionType}</div>
      )}
      {hasChildren && (
        <div className="text-xs opacity-75 mt-1">
          {isExpanded ? '▼' : '▶'}
        </div>
      )}
      
      {/* Source Handle - Right side for outgoing connections */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-purple-300 dark:!bg-purple-400 !border-2 !border-purple-600 dark:!border-purple-500"
      />
    </div>
  )
}

// Custom Node Component for Terminate Condition
const TerminateNode = ({ data }: { data: any }) => {
  return (
    <div className="px-3 py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg shadow-lg border-2 border-red-400 dark:border-red-500 min-w-[120px] text-center relative">
      {/* Target Handle - Bottom side for incoming connections */}
      <Handle
        type="target"
        position={Position.Bottom}
        className="w-3 h-3 !bg-red-300 dark:!bg-red-400 !border-2 !border-red-600 dark:!border-red-500"
      />
      
      <div className="font-bold text-xs">⚠️ TERMINATE</div>
      {data.formattedCondition && (
        <div className="text-[10px] opacity-90 mt-1 font-mono break-all">
          {data.formattedCondition}
        </div>
      )}
    </div>
  )
}

const nodeTypes = {
  question: QuestionNode,
  code: CodeNode,
  intermediate: IntermediateNode,
  terminate: TerminateNode,
}

// Custom Bezier Edge Component for curved connections
const CustomBezierEdge = ({
  id, 
  sourceX, 
  sourceY, 
  targetX, 
  targetY, 
  sourcePosition, 
  targetPosition, 
  style = {}, 
  markerEnd,
  label,
  labelStyle = {},
  data,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd}
        style={style}
      />
      {label && (() => {
        const condition = data && typeof data === 'object' && 'condition' in data && data.condition 
          ? (typeof data.condition === 'string' ? data.condition : String(data.condition))
          : null
        
        return (
          <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                pointerEvents: 'all',
              }}
              className="nodrag nopan"
            >
              <div 
                className="relative group cursor-pointer inline-block"
                style={labelStyle}
              >
                <div className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-sm text-xs font-semibold">
                  {label}
                </div>
                {condition && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap border border-green-500"
                    style={{ zIndex: 9999 }}>
                    <div className="font-bold text-green-400 mb-1">Ask if Condition:</div>
                    <div className="font-mono">{condition}</div>
                  </div>
                )}
              </div>
            </div>
          </EdgeLabelRenderer>
        )
      })()}
    </>
  )
}

const edgeTypes = {
  curved: CustomBezierEdge,
}

// Map connection types to colors
const getConnectionColor = (type: string): string => {
  switch (type) {
    case 'F0':
      return '#6B7280' // Gray
    case 'F1':
      return '#3B82F6' // Blue
    case 'F2':
      return '#8B5CF6' // Purple
    case 'ASK_IF':
      return '#10B981' // Green (same as PIPING)
    case 'PIPING':
      return '#10B981' // Green
    default:
      return '#6B7280' // Default gray
  }
}

// Map connection types to React Flow edge types
const getEdgeType = (connectionType: string): 'curved' | 'default' | 'smoothstep' => {
  // Always use custom curved edge for all connections
  return 'curved'
}

interface ContextMenu {
  x: number
  y: number
  nodeId: string
}

export default function LogicModelCanvas() {
  const { parsedQuestions, oldVariableMapping } = useSurveyStore()
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const contextMenuRef = useRef<HTMLDivElement>(null)
  
  // QC Syntax box state
  const [showSyntaxBox, setShowSyntaxBox] = useState(false)
  const [syntaxFromFlow, setSyntaxFromFlow] = useState<string>('')
  
  // Convert questions to React Flow format
  const initialGraph = useMemo(() => {
    if (parsedQuestions.length === 0) {
      return { nodes: [], edges: [] }
    }
    
    const graph = convertQuestionsToLogicModel(parsedQuestions, oldVariableMapping)
    
    // Convert to React Flow format
    const rfNodes: Node[] = graph.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    }))
    
    const rfEdges: Edge[] = graph.edges.map((edge) => {
      const connectionType = edge.type || 'F1'
      const color = getConnectionColor(connectionType)
      const edgeType = getEdgeType(connectionType)
      
      // For ASK_IF edges, use the condition label if available
      const label = edge.label || connectionType
      
      // Determine sourceHandle and targetHandle based on edge type
      let sourceHandle: string | undefined = undefined
      let targetHandle: string | undefined = undefined
      
      // Only specify sourceHandle for ASK_IF edges to terminate nodes (use "terminate" handle at top)
      // For F1/F0/PIPING edges from question nodes, use "source-right" handle
      // For other edges, leave undefined to let React Flow auto-select
      if (connectionType === 'ASK_IF' && edge.target.endsWith('_terminate')) {
        sourceHandle = 'terminate'
      } else if (connectionType === 'F1' || connectionType === 'F0' || connectionType === 'PIPING' || connectionType === 'ASK_IF') {
        // Check if source is a question node by finding it in rfNodes
        const sourceNode = rfNodes.find(n => n.id === edge.source)
        if (sourceNode?.type === 'question') {
          sourceHandle = 'source-right'
        }
      }
      
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: sourceHandle,
        targetHandle: targetHandle,
        type: edgeType,
        label: label,
        data: { 
          connectionType,
          condition: edge.condition, // Store condition for tooltip
          originalLabel: edge.label, // Store original label
        },
        style: { 
          stroke: color, 
          strokeWidth: connectionType === 'ASK_IF' ? 2.5 : 2, // Slightly thicker for conditional edges
          strokeDasharray: '5,5', // Tạo nét đứt
        },
        labelStyle: { 
          fill: color, 
          fontWeight: connectionType === 'ASK_IF' ? 700 : 600, // Bold for conditional edges
          fontSize: connectionType === 'ASK_IF' ? 11 : 12, // Slightly smaller for longer labels
          background: connectionType === 'ASK_IF' ? '#FFF3E0' : 'white', // Light orange background for ASK_IF
          padding: '3px 6px',
          borderRadius: '4px',
          border: connectionType === 'ASK_IF' ? `1px solid ${color}` : 'none',
        },
        markerEnd: {
          type: 'arrowclosed',
          color: color,
        },
      }
    })
    
    return { nodes: rfNodes, edges: rfEdges }
  }, [parsedQuestions, oldVariableMapping])
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges)
  
  // Generate syntax from Flow graph when questions change
  useEffect(() => {
    if (parsedQuestions.length > 0) {
      try {
        const graph = convertQuestionsToLogicModel(parsedQuestions, oldVariableMapping)
        const syntax = generateQCSyntaxFromFlow(graph, parsedQuestions, oldVariableMapping)
        setSyntaxFromFlow(syntax)
      } catch (error) {
        console.error('Error generating syntax from Flow:', error)
        setSyntaxFromFlow('')
      }
    } else {
      setSyntaxFromFlow('')
    }
  }, [parsedQuestions, oldVariableMapping])
  
  // Track expanded nodes (collapsed by default for performance - only show parent nodes initially)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  
  // Track expansion mode for each node: 'all' (show all children) or 'summary' (show first 3 and last 3)
  const [expansionMode, setExpansionMode] = useState<Map<string, 'all' | 'summary'>>(new Map())
  
  // Track nodes that have been manually moved by user (to preserve their positions)
  const [manuallyMovedNodes, setManuallyMovedNodes] = useState<Set<string>>(new Set())
  
  // Track hidden edges and nodes for show/hide functionality (separate from expand/collapse)
  const [hiddenEdges, setHiddenEdges] = useState<Set<string>>(new Set())
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set())
  
  // State for changing types
  const [changeTypeTarget, setChangeTypeTarget] = useState<{
    type: 'node' | 'edge'
    id: string
  } | null>(null)
  
  // Update nodes and edges when graph changes
  useEffect(() => {
    setNodes(initialGraph.nodes)
    setEdges(initialGraph.edges)
    setHiddenEdges(new Set()) // Reset hidden edges when graph regenerates
    setHiddenNodes(new Set()) // Reset hidden nodes when graph regenerates
    setExpandedNodes(new Set()) // Reset expanded nodes - all collapsed by default for performance
    setExpansionMode(new Map()) // Reset expansion mode when graph regenerates
    setManuallyMovedNodes(new Set()) // Reset manually moved nodes when graph regenerates
  }, [initialGraph, setNodes, setEdges])
  
  // Track when nodes are manually moved by user
  const handleNodesChange = useCallback((changes: any[]) => {
    changes.forEach((change) => {
      if (change.type === 'position' && change.dragging === false && change.position) {
        // Node was dragged and released - mark as manually moved
        setManuallyMovedNodes((prev) => new Set(prev).add(change.id))
      }
    })
    onNodesChange(changes)
  }, [onNodesChange])
  
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )
  
  // Handle node right-click
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      })
    },
    []
  )
  
  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as HTMLElement)) {
        setContextMenu(null)
      }
    }
    
    if (contextMenu) {
      // Use setTimeout to avoid immediate closure
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 0)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [contextMenu])
  
  // Get child edges and nodes for a node
  const getChildEdges = useCallback(
    (nodeId: string): Edge[] => {
      return edges.filter((edge) => edge.source === nodeId)
    },
    [edges]
  )
  
  const getChildNodes = useCallback(
    (nodeId: string): Node[] => {
      const childEdgeIds = getChildEdges(nodeId).map((e) => e.target)
      return nodes.filter((node) => childEdgeIds.includes(node.id))
    },
    [nodes, getChildEdges]
  )
  
  // Check if child edges and nodes are hidden
  const areChildEdgesHidden = useCallback(
    (nodeId: string): boolean => {
      const childEdges = getChildEdges(nodeId)
      const childNodes = getChildNodes(nodeId)
      return (
        childEdges.length > 0 &&
        childEdges.every((edge) => hiddenEdges.has(edge.id)) &&
        childNodes.length > 0 &&
        childNodes.every((node) => hiddenNodes.has(node.id))
      )
    },
    [getChildEdges, getChildNodes, hiddenEdges, hiddenNodes]
  )
  
  // Handle delete node
  const handleDeleteNode = useCallback(() => {
    if (!contextMenu) return
    
    const nodeId = contextMenu.nodeId
    setNodes((nds) => nds.filter((node) => node.id !== nodeId))
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setContextMenu(null)
  }, [contextMenu, setNodes, setEdges])
  
  
  // Handle rename node
  const handleRenameNode = useCallback(() => {
    if (!contextMenu) return
    
    const node = nodes.find((n) => n.id === contextMenu.nodeId)
    if (node) {
      setEditingNodeId(contextMenu.nodeId)
      const label = (node.data as any)?.label
      setEditValue(typeof label === 'string' ? label : '')
      setContextMenu(null)
    }
  }, [contextMenu, nodes])
  
  // Save renamed node
  const handleSaveRename = useCallback(() => {
    if (!editingNodeId) return
    
    setNodes((nds) =>
      nds.map((node) =>
        node.id === editingNodeId
          ? { ...node, data: { ...node.data, label: editValue } }
          : node
      )
    )
    setEditingNodeId(null)
    setEditValue('')
  }, [editingNodeId, editValue, setNodes])
  
  // Cancel rename
  const handleCancelRename = useCallback(() => {
    setEditingNodeId(null)
    setEditValue('')
  }, [])
  
  // Check if a node has children
  const hasChildren = useCallback((nodeId: string): boolean => {
    return edges.some(edge => edge.source === nodeId)
  }, [edges])
  
  // Check if a node is expanded
  const isExpanded = useCallback((nodeId: string): boolean => {
    return expandedNodes.has(nodeId)
  }, [expandedNodes])
  
  // Handle expand all children (for performance optimization)
  const handleExpandAll = useCallback(() => {
    if (!contextMenu) return
    
    const nodeId = contextMenu.nodeId
    const isCurrentlyExpanded = expandedNodes.has(nodeId)
    
    setExpandedNodes((prev) => {
      const newSet = new Set(prev)
      newSet.add(nodeId) // Expand
      return newSet
    })
    
    setExpansionMode((prev) => {
      const newMap = new Map(prev)
      newMap.set(nodeId, 'all')
      return newMap
    })
    
    // When expanding, initialize child node positions if they haven't been positioned yet
    if (!isCurrentlyExpanded) {
      const parentNode = nodes.find(n => n.id === nodeId)
      if (parentNode && parentNode.type === 'question') {
        const childXOffset = 200
        const childYSpacing = 80
        const intermediateYSpacing = 150
        
        // Find all child edges
        const childEdges = edges.filter(e => e.source === nodeId)
        
        // Update child node positions
        setNodes((currentNodes) => {
          const updatedNodes = currentNodes.map((node) => {
            // Check if this node is a child of the expanded parent
            const isChild = childEdges.some(e => e.target === node.id)
            if (!isChild) return node
            
            // Always reposition child nodes when expanding (ignore previous position)
            
            // Calculate new position based on parent
            if (node.type === 'intermediate') {
              const siblingIntermediates = childEdges
                .filter(e => {
                  const childNode = currentNodes.find(n => n.id === e.target)
                  return childNode?.type === 'intermediate'
                })
                .map(e => currentNodes.find(n => n.id === e.target))
                .filter(Boolean)
                .sort((a, b) => {
                  const aOrig = initialGraph.nodes.find(n => n.id === a!.id)
                  const bOrig = initialGraph.nodes.find(n => n.id === b!.id)
                  return (aOrig?.position.y ?? 0) - (bOrig?.position.y ?? 0)
                })
              
              const intermediateIndex = siblingIntermediates.findIndex(n => n!.id === node.id)
              const intermediateX = parentNode.position.x + childXOffset
              const intermediateY = parentNode.position.y + (intermediateIndex - (siblingIntermediates.length - 1) / 2) * intermediateYSpacing
              
              return {
                ...node,
                position: { x: intermediateX, y: intermediateY },
              }
            } else if (node.type === 'code') {
              const parentEdge = childEdges.find(e => e.target === node.id)
              if (parentEdge) {
                const actualParent = currentNodes.find(n => n.id === parentEdge.source)
                if (actualParent) {
                  const siblingChildren = childEdges
                    .filter(e => {
                      const childNode = currentNodes.find(n => n.id === e.target)
                      return childNode?.type === 'code' && e.source === actualParent.id
                    })
                    .map(e => currentNodes.find(n => n.id === e.target))
                    .filter(Boolean)
                    .sort((a, b) => {
                      const aOrig = initialGraph.nodes.find(n => n.id === a!.id)
                      const bOrig = initialGraph.nodes.find(n => n.id === b!.id)
                      return (aOrig?.position.y ?? 0) - (bOrig?.position.y ?? 0)
                    })
                  
                  const childIndex = siblingChildren.findIndex(n => n!.id === node.id)
                  const xOffset = actualParent.type === 'intermediate' ? childXOffset * 2 : childXOffset
                  const childX = actualParent.position.x + xOffset
                  const childY = actualParent.position.y + (childIndex - (siblingChildren.length - 1) / 2) * childYSpacing
                  
                  return {
                    ...node,
                    position: { x: childX, y: childY },
                  }
                }
              }
            }
            
            return node
          })
          
          return updatedNodes
        })
      }
    }
    
    setContextMenu(null)
  }, [contextMenu, expandedNodes, nodes, edges, initialGraph, setNodes])
  
  // Handle expand summary (show first 3 and last 3 children)
  const handleExpandSummary = useCallback(() => {
    if (!contextMenu) return
    
    const nodeId = contextMenu.nodeId
    const isCurrentlyExpanded = expandedNodes.has(nodeId)
    
    setExpandedNodes((prev) => {
      const newSet = new Set(prev)
      newSet.add(nodeId) // Expand
      return newSet
    })
    
    setExpansionMode((prev) => {
      const newMap = new Map(prev)
      newMap.set(nodeId, 'summary')
      return newMap
    })
    
    // When expanding summary, initialize visible child node positions if they haven't been positioned yet
    if (!isCurrentlyExpanded) {
      const parentNode = nodes.find(n => n.id === nodeId)
      if (parentNode && parentNode.type === 'question') {
        const childXOffset = 200
        const childYSpacing = 80
        const intermediateYSpacing = 150
        
        // Find all child edges
        const childEdges = edges.filter(e => e.source === nodeId)
        
        // Get child nodes sorted by original position
        // Separate intermediate nodes and code nodes
        const allIntermediateNodes = childEdges
          .map(e => nodes.find(n => n.id === e.target))
          .filter(n => n?.type === 'intermediate')
          .sort((a, b) => {
            const aOrig = initialGraph.nodes.find(n => n.id === a!.id)
            const bOrig = initialGraph.nodes.find(n => n.id === b!.id)
            return (aOrig?.position.y ?? 0) - (bOrig?.position.y ?? 0)
          })
        
        const allCodeNodes = childEdges
          .map(e => nodes.find(n => n.id === e.target))
          .filter(n => n?.type === 'code')
          .sort((a, b) => {
            const aOrig = initialGraph.nodes.find(n => n.id === a!.id)
            const bOrig = initialGraph.nodes.find(n => n.id === b!.id)
            return (aOrig?.position.y ?? 0) - (bOrig?.position.y ?? 0)
          })
        
        // For summary mode: show first 3 and last 1
        const visibleIntermediateNodes = allIntermediateNodes.length > 4
          ? [...allIntermediateNodes.slice(0, 3), ...allIntermediateNodes.slice(-1)]
          : allIntermediateNodes
        
        const visibleCodeNodes = allCodeNodes.length > 4
          ? [...allCodeNodes.slice(0, 3), ...allCodeNodes.slice(-1)]
          : allCodeNodes
        
        const visibleIntermediateIds = new Set(visibleIntermediateNodes.map(n => n!.id))
        const visibleCodeIds = new Set(visibleCodeNodes.map(n => n!.id))
        
        // Update child node positions
        setNodes((currentNodes) => {
          const updatedNodes = currentNodes.map((node) => {
            // Check if this node is a child of the expanded parent
            const isChild = childEdges.some(e => e.target === node.id)
            if (!isChild) return node
            
            // Always reposition child nodes when expanding (ignore previous position)
            
            // Calculate new position based on parent
            if (node.type === 'intermediate') {
              // Only position visible intermediate nodes in summary mode
              if (visibleIntermediateIds.has(node.id)) {
                const visibleIntermediates = allIntermediateNodes.filter(n => visibleIntermediateIds.has(n!.id))
                const intermediateIndex = visibleIntermediates.findIndex(n => n!.id === node.id)
                const intermediateX = parentNode.position.x + childXOffset
                const intermediateY = parentNode.position.y + (intermediateIndex - (visibleIntermediates.length - 1) / 2) * intermediateYSpacing
                
                return {
                  ...node,
                  position: { x: intermediateX, y: intermediateY },
                }
              }
            } else if (node.type === 'code') {
              const parentEdge = childEdges.find(e => e.target === node.id)
              if (parentEdge) {
                const actualParent = currentNodes.find(n => n.id === parentEdge.source)
                if (actualParent) {
                  // If parent is intermediate, only show if intermediate is visible
                  if (actualParent.type === 'intermediate') {
                    if (!visibleIntermediateIds.has(actualParent.id)) {
                      return node // Don't position if parent intermediate is not visible
                    }
                  }
                  
                  // Get sibling children of the actual parent
                  const siblingChildren = childEdges
                    .filter(e => {
                      const childNode = currentNodes.find(n => n.id === e.target)
                      return childNode?.type === 'code' && e.source === actualParent.id
                    })
                    .map(e => currentNodes.find(n => n.id === e.target))
                    .filter(Boolean)
                    .sort((a, b) => {
                      const aOrig = initialGraph.nodes.find(n => n.id === a!.id)
                      const bOrig = initialGraph.nodes.find(n => n.id === b!.id)
                      return (aOrig?.position.y ?? 0) - (bOrig?.position.y ?? 0)
                    })
                  
                  // Determine which child nodes should be visible
                  let visibleChildren: typeof siblingChildren
                  if (actualParent.type === 'question') {
                    // Direct children of question: use visibleCodeIds
                    visibleChildren = siblingChildren.filter(n => visibleCodeIds.has(n!.id))
                  } else {
                    // Children of intermediate: show first 3 and last 1
                    visibleChildren = siblingChildren.length > 4
                      ? [...siblingChildren.slice(0, 3), ...siblingChildren.slice(-1)]
                      : siblingChildren
                  }
                  
                  // Only position visible children
                  if (visibleChildren.some(n => n!.id === node.id)) {
                    const childIndex = visibleChildren.findIndex(n => n!.id === node.id)
                    const xOffset = actualParent.type === 'intermediate' ? childXOffset * 2 : childXOffset
                    const childX = actualParent.position.x + xOffset
                    const childY = actualParent.position.y + (childIndex - (visibleChildren.length - 1) / 2) * childYSpacing
                    
                    return {
                      ...node,
                      position: { x: childX, y: childY },
                    }
                  }
                }
              }
            }
            
            return node
          })
          
          return updatedNodes
        })
      }
    }
    
    setContextMenu(null)
  }, [contextMenu, expandedNodes, nodes, edges, initialGraph, setNodes])
  
  // Handle collapse node
  const handleCollapse = useCallback(() => {
    if (!contextMenu) return
    
    const nodeId = contextMenu.nodeId
    
    // Reset child node positions to original positions from initialGraph
    const childEdges = edges.filter(e => e.source === nodeId)
    const childNodeIds = childEdges.map(e => e.target)
    
    setNodes((currentNodes) => {
      return currentNodes.map((node) => {
        if (childNodeIds.includes(node.id)) {
          // Reset to original position from initialGraph
          const originalNode = initialGraph.nodes.find(n => n.id === node.id)
          if (originalNode) {
            return {
              ...node,
              position: { ...originalNode.position },
            }
          }
        }
        return node
      })
    })
    
    setExpandedNodes((prev) => {
      const newSet = new Set(prev)
      newSet.delete(nodeId) // Collapse
      return newSet
    })
    
    setExpansionMode((prev) => {
      const newMap = new Map(prev)
      newMap.delete(nodeId) // Remove mode when collapsing
      return newMap
    })
    
    setContextMenu(null)
  }, [contextMenu, edges, initialGraph, setNodes])
  
  // Legacy function for backward compatibility
  const handleToggleExpand = useCallback(() => {
    if (!contextMenu) return
    const nodeId = contextMenu.nodeId
    const isCurrentlyExpanded = expandedNodes.has(nodeId)
    
    if (isCurrentlyExpanded) {
      handleCollapse()
    } else {
      handleExpandAll()
    }
  }, [contextMenu, expandedNodes, handleExpandAll, handleCollapse])
  
  // Handle show/hide child connections and nodes (legacy - redirect to expand/collapse)
  const handleToggleChildConnections = useCallback(() => {
    handleToggleExpand()
  }, [handleToggleExpand])
  
  // Filter edges and nodes based on hidden state
  // Get all descendants of a node (recursively)
  const getAllDescendants = useCallback((nodeId: string, visited = new Set<string>()): Set<string> => {
    if (visited.has(nodeId)) return new Set()
    visited.add(nodeId)
    
    const descendants = new Set<string>()
    const directChildren = edges.filter(e => e.source === nodeId).map(e => e.target)
    
    directChildren.forEach(childId => {
      descendants.add(childId)
      const childDescendants = getAllDescendants(childId, visited)
      childDescendants.forEach(desc => descendants.add(desc))
    })
    
    return descendants
  }, [edges])
  
  // Filter nodes based on expanded state: only show if parent is expanded (or if it's a parent node itself)
  const visibleNodes = useMemo(() => {
    return nodes
      .filter((node) => {
        // Skip if explicitly hidden
        if (hiddenNodes.has(node.id)) return false
        
        // Always show terminate nodes (auto show, not affected by expand/collapse)
        if (node.type === 'terminate') return true
        
        // Always show parent nodes (type === 'question')
        if (node.type === 'question') return true
        
        // For intermediate nodes (MA_Grid rows): show if parent question is expanded
        if (node.type === 'intermediate') {
          const parentEdge = edges.find(e => e.target === node.id)
          if (!parentEdge) return true // No parent, show it
          const parentId = parentEdge.source
          if (!expandedNodes.has(parentId)) return false
          
          // Check expansion mode: 'summary' means show only first 3 and last 1 intermediate nodes
          const mode = expansionMode.get(parentId)
          if (mode === 'summary') {
            // Get all intermediate nodes sorted by original position
            const allIntermediateNodes = edges
              .filter(e => e.source === parentId)
              .map(e => nodes.find(n => n.id === e.target))
              .filter(n => n?.type === 'intermediate')
              .sort((a, b) => {
                const aOrig = initialGraph.nodes.find(n => n.id === a!.id)
                const bOrig = initialGraph.nodes.find(n => n.id === b!.id)
                return (aOrig?.position.y ?? 0) - (bOrig?.position.y ?? 0)
              })
            
            if (allIntermediateNodes.length > 4) {
              const firstThree = allIntermediateNodes.slice(0, 3).map(n => n!.id)
              const lastOne = allIntermediateNodes.slice(-1).map(n => n!.id)
              return firstThree.includes(node.id) || lastOne.includes(node.id)
            }
            // If 4 or fewer intermediate nodes, show all (no summary needed)
            return true
          }
          return true
        }
        
        // For code nodes: show if their parent is expanded
        // Check if it's a direct child of a question (parent) or intermediate node
        const parentEdge = edges.find(e => e.target === node.id)
        if (!parentEdge) return true // No parent, show it
        
        const parentId = parentEdge.source
        const parentNode = nodes.find(n => n.id === parentId)
        
        // If parent is a question node, check if it's expanded
        if (parentNode?.type === 'question') {
          if (!expandedNodes.has(parentId)) return false
          
          // Check expansion mode: 'summary' means show only first 3 and last 1
          const mode = expansionMode.get(parentId)
          if (mode === 'summary') {
            // Get all child code nodes sorted by original position
            const allChildNodes = edges
              .filter(e => e.source === parentId)
              .map(e => nodes.find(n => n.id === e.target))
              .filter(n => n?.type === 'code')
              .sort((a, b) => {
                const aOrig = initialGraph.nodes.find(n => n.id === a!.id)
                const bOrig = initialGraph.nodes.find(n => n.id === b!.id)
                return (aOrig?.position.y ?? 0) - (bOrig?.position.y ?? 0)
              })
            
            if (allChildNodes.length > 4) {
              const firstThree = allChildNodes.slice(0, 3).map(n => n!.id)
              const lastOne = allChildNodes.slice(-1).map(n => n!.id)
              return firstThree.includes(node.id) || lastOne.includes(node.id)
            }
            // If 4 or fewer children, show all (no summary needed)
            return true
          }
          // 'all' mode or no mode specified: show all children
          return true
        }
        
        // If parent is an intermediate node, check if both the question and intermediate are expanded
        if (parentNode?.type === 'intermediate') {
          const questionEdge = edges.find(e => e.target === parentId)
          if (!questionEdge) return expandedNodes.has(parentId)
          
          const questionId = questionEdge.source
          if (!expandedNodes.has(parentId) || !expandedNodes.has(questionId)) return false
          
          // Check expansion mode for intermediate node
          // First check if the question parent has summary mode
          const questionMode = expansionMode.get(questionId)
          if (questionMode === 'summary') {
            // In summary mode, only show child nodes if intermediate is in the first 3 or last 1
            const allIntermediateNodes = edges
              .filter(e => e.source === questionId)
              .map(e => nodes.find(n => n.id === e.target))
              .filter(n => n?.type === 'intermediate')
              .sort((a, b) => {
                const aOrig = initialGraph.nodes.find(n => n.id === a!.id)
                const bOrig = initialGraph.nodes.find(n => n.id === b!.id)
                return (aOrig?.position.y ?? 0) - (bOrig?.position.y ?? 0)
              })
            
            const firstThreeIntermediate = allIntermediateNodes.slice(0, 3).map(n => n!.id)
            const lastOneIntermediate = allIntermediateNodes.slice(-1).map(n => n!.id)
            const isIntermediateVisible = firstThreeIntermediate.includes(parentId) || lastOneIntermediate.includes(parentId)
            
            if (!isIntermediateVisible) return false
            
            // If intermediate is visible, check if it's expanded
            if (!expandedNodes.has(parentId)) return false
            
            // For child nodes of visible intermediate, show only first 3 and last 1
            const allChildNodes = edges
              .filter(e => e.source === parentId)
              .map(e => nodes.find(n => n.id === e.target))
              .filter(n => n?.type === 'code')
              .sort((a, b) => {
                const aOrig = initialGraph.nodes.find(n => n.id === a!.id)
                const bOrig = initialGraph.nodes.find(n => n.id === b!.id)
                return (aOrig?.position.y ?? 0) - (bOrig?.position.y ?? 0)
              })
            
            if (allChildNodes.length > 4) {
              const firstThree = allChildNodes.slice(0, 3).map(n => n!.id)
              const lastOne = allChildNodes.slice(-1).map(n => n!.id)
              return firstThree.includes(node.id) || lastOne.includes(node.id)
            }
            return true
          }
          
          // If question is not in summary mode, check intermediate's own expansion mode
          const mode = expansionMode.get(parentId)
          if (mode === 'summary') {
            // Get all child code nodes of this intermediate node sorted by original position
            const allChildNodes = edges
              .filter(e => e.source === parentId)
              .map(e => nodes.find(n => n.id === e.target))
              .filter(n => n?.type === 'code')
              .sort((a, b) => {
                const aOrig = initialGraph.nodes.find(n => n.id === a!.id)
                const bOrig = initialGraph.nodes.find(n => n.id === b!.id)
                return (aOrig?.position.y ?? 0) - (bOrig?.position.y ?? 0)
              })
            
            if (allChildNodes.length > 4) {
              const firstThree = allChildNodes.slice(0, 3).map(n => n!.id)
              const lastOne = allChildNodes.slice(-1).map(n => n!.id)
              return firstThree.includes(node.id) || lastOne.includes(node.id)
            }
            return true
          }
          return true
        }
        
        return true
      })
      .map((node) => {
        // Enrich node data with hasChildren and isExpanded for UI rendering
        // Preserve all original data properties
        const originalData = node.data || {}
        return {
          ...node,
          data: {
            ...originalData,
            hasChildren: edges.some(e => e.source === node.id),
            isExpanded: expandedNodes.has(node.id),
            expansionMode: expansionMode.get(node.id) || 'collapsed', // Pass expansion mode to node for rendering
          },
        }
      })
  }, [nodes, edges, expandedNodes, hiddenNodes, expansionMode, initialGraph])
  
  // Simply return visible nodes with their current positions - no auto-layout
  // All nodes can be freely dragged and positions are preserved
  const layoutedNodes = useMemo(() => {
    if (visibleNodes.length === 0) return visibleNodes
    
    // Get current node positions from nodes state
    const currentNodePositions = new Map<string, { x: number; y: number }>()
    nodes.forEach(n => {
      currentNodePositions.set(n.id, { x: n.position.x, y: n.position.y })
    })
    
    // Return visible nodes with their current positions (preserves all manual moves)
    return visibleNodes.map((node) => {
      const currentPos = currentNodePositions.get(node.id)
      const position = currentPos ? { x: currentPos.x, y: currentPos.y } : node.position
      
      return {
        ...node,
        position,
      }
    })
  }, [visibleNodes, nodes])
  
  // Filter edges: only show if both source and target nodes are visible
  // Hide parent→next question edges when parent is expanded and has child nodes
  // BUT keep parent→terminate edges always visible (they are separate connections)
  const visibleEdges = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id))
    return edges.filter((edge) => {
      // Skip if explicitly hidden
      if (hiddenEdges.has(edge.id)) return false
      
      // Only show if both source and target are visible
      if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) {
        return false
      }
      
      // Hide parent→next question edge if:
      // 1. Edge is F0 type (flow edge)
      // 2. Source is a question node (parent)
      // 3. Source has child nodes (F1 edges)
      // 4. Source is expanded
      // BUT: Do NOT hide ASK_IF edges (terminate connections are always shown)
      if (edge.data?.connectionType === 'F0') {
        const sourceNode = nodes.find(n => n.id === edge.source)
        if (sourceNode?.type === 'question') {
          const hasChildNodes = edges.some(e => e.source === edge.source && e.data?.connectionType === 'F1')
          if (hasChildNodes && expandedNodes.has(edge.source)) {
            // Hide parent→next edge when expanded (child→next edges will show instead)
            return false
          }
        }
      }
      
      // Hide parent→target PIPING edge if:
      // 1. Edge is PIPING type
      // 2. Source is a question node (parent)
      // 3. Source has child nodes (F1 edges) or intermediate nodes
      // 4. Source is expanded
      if (edge.data?.connectionType === 'PIPING') {
        const sourceNode = nodes.find(n => n.id === edge.source)
        if (sourceNode?.type === 'question') {
          const hasChildNodes = edges.some(e => e.source === edge.source && (e.data?.connectionType === 'F1' || e.type === 'F1'))
          if (hasChildNodes && expandedNodes.has(edge.source)) {
            // Hide parent→target PIPING edge when expanded (intermediate/child→target PIPING edges will show instead)
            return false
          }
        }
      }
      
      return true
    })
  }, [edges, visibleNodes, hiddenEdges, expandedNodes, nodes])
  
  // Handle edge context menu
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    x: number
    y: number
    edgeId: string
  } | null>(null)
  const edgeContextMenuRef = useRef<HTMLDivElement>(null)
  
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault()
      setEdgeContextMenu({
        x: event.clientX,
        y: event.clientY,
        edgeId: edge.id,
      })
    },
    []
  )
  
  // Handle node double-click to change type
  const onNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setChangeTypeTarget({ type: 'node', id: node.id })
      setContextMenu(null)
    },
    []
  )
  
  // Handle edge double-click to change type
  const onEdgeDoubleClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      setChangeTypeTarget({ type: 'edge', id: edge.id })
      setEdgeContextMenu(null)
    },
    []
  )
  
  // Close edge context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (edgeContextMenuRef.current && !edgeContextMenuRef.current.contains(event.target as HTMLElement)) {
        setEdgeContextMenu(null)
      }
    }
    
    if (edgeContextMenu) {
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 0)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [edgeContextMenu])
  
  // Handle change node type from context menu
  const handleChangeNodeType = useCallback(() => {
    if (!contextMenu) return
    setChangeTypeTarget({ type: 'node', id: contextMenu.nodeId })
    setContextMenu(null)
  }, [contextMenu])
  
  // Handle change edge type from context menu
  const handleChangeEdgeType = useCallback(() => {
    if (!edgeContextMenu) return
    setChangeTypeTarget({ type: 'edge', id: edgeContextMenu.edgeId })
    setEdgeContextMenu(null)
  }, [edgeContextMenu])
  
  // Handle delete edge
  const handleDeleteEdge = useCallback(() => {
    if (!edgeContextMenu) return
    
    const edgeId = edgeContextMenu.edgeId
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId))
    setEdgeContextMenu(null)
  }, [edgeContextMenu, setEdges])
  
  // Save type change
  const handleSaveTypeChange = useCallback(
    (newType: string) => {
      if (!changeTypeTarget) return
      
      if (changeTypeTarget.type === 'node') {
        setNodes((nds) =>
          nds.map((node) =>
            node.id === changeTypeTarget.id
              ? { ...node, data: { ...node.data, questionType: newType } }
              : node
          )
        )
      } else {
        const connectionType = newType
        const color = getConnectionColor(connectionType)
        const edgeType = getEdgeType(connectionType)
        
        setEdges((eds) =>
          eds.map((edge) =>
            edge.id === changeTypeTarget.id
              ? {
                  ...edge,
                  type: edgeType,
                  data: { ...(edge.data || {}), connectionType },
                  label: newType,
                  style: { 
                    stroke: color,
                    strokeWidth: 2,
                    strokeDasharray: '5,5', // Tạo nét đứt
                  },
                  labelStyle: {
                    fill: color,
                    fontWeight: 600,
                    fontSize: 12,
                    background: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  },
                  markerEnd: {
                    type: 'arrowclosed',
                    color: color,
                  },
                }
              : edge
          )
        )
      }
      
      setChangeTypeTarget(null)
    },
    [changeTypeTarget, setNodes, setEdges]
  )
  
  return (
    <MainLayout>
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-glass-border-dark dark:border-glass-border-light glass-panel z-40 relative bg-background-dark dark:bg-background-light">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Package2 className="w-5 h-5 text-primary" />
            <span className="text-foreground font-semibold">Logic Model Canvas</span>
            {nodes.length > 0 && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                {nodes.length} nodes, {edges.length} edges
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content - React Flow Canvas */}
      <main className="flex-1 relative">
        {nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Package2 className="w-16 h-16 text-primary/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Logic Model</h3>
              <p className="text-sm text-muted-foreground">
                {parsedQuestions.length === 0
                  ? 'Import questions first to generate Logic Model'
                  : 'Logic Model will be generated from parsed questions'}
              </p>
            </div>
          </div>
        ) : (
          <ReactFlowProvider>
            <ReactFlow
              nodes={layoutedNodes}
              edges={visibleEdges}
              onNodesChange={handleNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeContextMenu={onNodeContextMenu}
              onNodeDoubleClick={onNodeDoubleClick}
              onEdgeContextMenu={onEdgeContextMenu}
              onEdgeDoubleClick={onEdgeDoubleClick}
              onPaneContextMenu={(e) => {
                e.preventDefault()
                setContextMenu(null)
                setEdgeContextMenu(null)
              }}
              onPaneClick={() => {
                setContextMenu(null)
                setEdgeContextMenu(null)
              }}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              className="bg-white"
            >
              <Controls />
              <MiniMap />
              <Background variant={BackgroundVariant.Cross} gap={20} size={1} color="#e5e7eb" />
              
              {/* Show QC Logic Syntax Box - Top Left */}
              <Panel position="top-left" className="z-30">
                <button
                  onClick={() => setShowSyntaxBox(!showSyntaxBox)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary/90 hover:bg-primary text-white rounded-lg shadow-lg transition-all font-medium text-sm"
                >
                  <FileText className="w-4 h-4" />
                  <span>Show Syntax</span>
                </button>
                
                {showSyntaxBox && syntaxFromFlow && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[600px] max-h-[600px] flex flex-col overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-center gap-2">
                        <Code className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-gray-900 dark:text-white">SPSS Check Missing Syntax</h3>
                      </div>
                      <button
                        onClick={() => setShowSyntaxBox(false)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 bg-[#1e1e1e] font-mono text-xs">
                      <pre className="text-gray-300 whitespace-pre-wrap">{syntaxFromFlow}</pre>
                    </div>
                    <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end">
                      <button
                        onClick={() => {
                          const blob = new Blob([syntaxFromFlow], { type: 'text/plain' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `qc_logic_syntax_${new Date().toISOString().split('T')[0]}.sps`
                          document.body.appendChild(a)
                          a.click()
                          document.body.removeChild(a)
                          URL.revokeObjectURL(url)
                        }}
                        className="px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Download className="w-3 h-3" />
                        <span>Export</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </Panel>
              
              <Panel position="bottom-left" className="glass-card p-3 rounded-lg bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg">
                <div className="text-xs font-bold text-gray-900 mb-2 uppercase tracking-wider">Connection Types</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-[2px] rounded" style={{ backgroundColor: getConnectionColor('F0') }} />
                    <span className="text-xs text-gray-700">F0 (Default)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-[2px] rounded" style={{ backgroundColor: getConnectionColor('F1') }} />
                    <span className="text-xs text-gray-700">F1 (Hierarchy)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-[2px] rounded" style={{ backgroundColor: getConnectionColor('F2') }} />
                    <span className="text-xs text-gray-700">F2 (Sub-hierarchy)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-[2px] rounded" style={{ backgroundColor: getConnectionColor('ASK_IF') }} />
                    <span className="text-xs text-gray-700">ASK_IF (Conditional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-[2px] rounded" style={{ backgroundColor: getConnectionColor('PIPING') }} />
                    <span className="text-xs text-gray-700">PIPING (Data Flow)</span>
                  </div>
                </div>
              </Panel>
            </ReactFlow>
            
            {/* Context Menu */}
            {contextMenu && (
              <div
                ref={contextMenuRef}
                className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[180px]"
                style={{
                  left: contextMenu.x,
                  top: contextMenu.y,
                }}
              >
                <button
                  onClick={handleRenameNode}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Rename</span>
                </button>
                {hasChildren(contextMenu.nodeId) && (
                  <>
                    {!isExpanded(contextMenu.nodeId) ? (
                      <>
                        <button
                          onClick={handleExpandAll}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Expand All</span>
                        </button>
                        <button
                          onClick={handleExpandSummary}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Expand Summary</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleCollapse}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <EyeOff className="w-4 h-4" />
                        <span>Collapse</span>
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={handleChangeNodeType}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Change Type</span>
                </button>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                <button
                  onClick={handleDeleteNode}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            )}
            
            {/* Edge Context Menu */}
            {edgeContextMenu && (
              <div
                ref={edgeContextMenuRef}
                className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[180px]"
                style={{
                  left: edgeContextMenu.x,
                  top: edgeContextMenu.y,
                }}
              >
                <button
                  onClick={handleChangeEdgeType}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Change Type</span>
                </button>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                <button
                  onClick={handleDeleteEdge}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            )}
            
            {/* Change Type Modal */}
            {changeTypeTarget && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Change {changeTypeTarget.type === 'node' ? 'Variable' : 'Connection'} Type
                    </h3>
                    <button
                      onClick={() => setChangeTypeTarget(null)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {changeTypeTarget.type === 'node' ? (
                      <>
                        {(['SA', 'MA', 'SA_Grid', 'MA_Grid', 'OE', 'OE_Grid', 'Rank_Fixed', 'Rank_Upto', 'Numeric'] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => handleSaveTypeChange(type)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                          >
                            {type}
                          </button>
                        ))}
                      </>
                    ) : (
                      <>
                        {(['F0', 'F1', 'F2', 'ASK_IF', 'PIPING'] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => handleSaveTypeChange(type)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                          >
                            {type}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Rename Modal */}
            {editingNodeId && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Rename Node</h3>
                    <button
                      onClick={handleCancelRename}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename()
                      if (e.key === 'Escape') handleCancelRename()
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={handleCancelRename}
                      className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveRename}
                      className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </ReactFlowProvider>
        )}
      </main>
    </MainLayout>
  )
}

