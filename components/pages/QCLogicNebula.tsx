'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import MainLayout from '../Layout/MainLayout'
import ThemeToggle from '../ThemeToggle'
import { Network, AlertCircle, CheckCircle2, Code, Download, X } from 'lucide-react'
import { useSurveyStore } from '@/store/surveyStore'
import { generateQCSyntax } from '@/lib/qcSyntaxGenerator'
import { QCNode, QCEdge, EdgeType, GeneratedQCSyntax } from '@/lib/qcLogicTypes'
import { generateQCSyntaxFromJSON } from '@/lib/qcSyntaxGeneratorFromJSON'
import { FileText } from 'lucide-react'

// Map edge types to colors
const getEdgeColor = (type: EdgeType) => {
  switch (type) {
    case 'F0':
      return '#6B7280' // Gray
    case 'F1':
      return '#3B82F6' // Blue
    case 'F2':
      return '#8B5CF6' // Purple
    case 'ASK_IF':
      return '#EF5B21' // Orange
    case 'PIPING':
      return '#10B981' // Green
    default:
      return '#EF5B21'
  }
}

export default function QCLogicNebula() {
  const { qcLogicGraph, parsedQuestions } = useSurveyStore()
  const [generatedSyntax, setGeneratedSyntax] = useState<GeneratedQCSyntax | null>(null)
  const [showSyntaxModal, setShowSyntaxModal] = useState(false)
  const [showSyntaxBox, setShowSyntaxBox] = useState(false)
  const [syntaxFromJSON, setSyntaxFromJSON] = useState<string>('')

  // Use QC Logic Graph if available, otherwise show empty state
  const nodes: QCNode[] = useMemo(() => {
    return qcLogicGraph?.nodes || []
  }, [qcLogicGraph])

  const edges: QCEdge[] = useMemo(() => {
    return qcLogicGraph?.edges || []
  }, [qcLogicGraph])

  // Generate syntax when graph changes
  useEffect(() => {
    if (qcLogicGraph && qcLogicGraph.nodes.length > 0) {
      const syntax = generateQCSyntax(qcLogicGraph)
      setGeneratedSyntax(syntax)
    } else {
      setGeneratedSyntax(null)
    }
  }, [qcLogicGraph])

  // Generate syntax from JSON when questions change
  useEffect(() => {
    if (parsedQuestions && parsedQuestions.length > 0) {
      try {
        const syntax = generateQCSyntaxFromJSON(parsedQuestions)
        setSyntaxFromJSON(syntax)
      } catch (error) {
        console.error('Error generating syntax from JSON:', error)
        setSyntaxFromJSON('')
      }
    } else {
      setSyntaxFromJSON('')
    }
  }, [parsedQuestions])

  const handleGenerateSyntax = () => {
    if (qcLogicGraph) {
      const syntax = generateQCSyntax(qcLogicGraph)
      setGeneratedSyntax(syntax)
      setShowSyntaxModal(true)
    }
  }

  const handleExportSyntax = () => {
    if (!generatedSyntax) return

    const blob = new Blob([generatedSyntax.fullSyntax], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qc_logic_syntax_${new Date().toISOString().split('T')[0]}.sps`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <MainLayout>
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-glass-border-dark dark:border-glass-border-light glass-panel z-40 relative bg-background-dark dark:bg-background-light">
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
                onClick={handleGenerateSyntax}
                className="flex items-center gap-2 px-3 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg transition-all"
              >
                <Code className="w-4 h-4" />
                <span>Generate Syntax</span>
              </button>
              {generatedSyntax && (
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

      {/* Main Content - 3D Logic Visualization */}
      <main className="flex-1 p-8 relative flex flex-col overflow-hidden">
        <div className="flex-1 relative glass-card rounded-xl overflow-hidden">
          {/* Show QC Logic Syntax Box - Top Left */}
          <div className="absolute top-4 left-4 z-30">
            <button
              onClick={() => setShowSyntaxBox(!showSyntaxBox)}
              className="flex items-center gap-2 px-4 py-2 bg-primary/90 hover:bg-primary text-white rounded-lg shadow-lg transition-all font-medium text-sm"
            >
              <FileText className="w-4 h-4" />
              <span>Show QC Logic Syntax</span>
            </button>
            
            {showSyntaxBox && syntaxFromJSON && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[600px] max-h-[600px] flex flex-col overflow-hidden"
              >
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <div className="flex items-center gap-2">
                    <Code className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-gray-900 dark:text-white">QC Logic Syntax (From JSON)</h3>
                  </div>
                  <button
                    onClick={() => setShowSyntaxBox(false)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-[#1e1e1e] font-mono text-xs">
                  <pre className="text-gray-300 whitespace-pre-wrap">{syntaxFromJSON}</pre>
                </div>
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end">
                  <button
                    onClick={() => {
                      const blob = new Blob([syntaxFromJSON], { type: 'text/plain' })
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
          </div>

          {/* Background Grid */}
          <div className="absolute inset-0 bg-grid-pattern opacity-20" />

          {/* SVG Container for Logic Graph */}
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              {/* Orange Glow Filter for Normal Edges */}
              <filter id="orangeGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Electric Red Glow for Error Edges */}
              <filter id="redGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Render Edges (Connections) */}
            {edges.map((edge) => {
              const fromNode = nodes.find((n) => n.id === edge.from)
              const toNode = nodes.find((n) => n.id === edge.to)

              if (!fromNode || !toNode || !fromNode.position || !toNode.position) return null

              const strokeColor = getEdgeColor(edge.type)
              const filterId = 'orangeGlow'

              return (
                <g key={edge.id}>
                  {/* Main edge line with glow */}
                  <line
                    x1={fromNode.position.x + 50}
                    y1={fromNode.position.y + 25}
                    x2={toNode.position.x + 50}
                    y2={toNode.position.y + 25}
                    stroke={strokeColor}
                    strokeWidth="2"
                    filter={`url(#${filterId})`}
                    opacity="0.7"
                  />
                  {/* Edge label */}
                  {edge.label && (
                    <text
                      x={(fromNode.position.x + toNode.position.x) / 2 + 50}
                      y={(fromNode.position.y + toNode.position.y) / 2 + 25}
                      fill={strokeColor}
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                      dy="-5"
                      className="pointer-events-none"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Render Nodes */}
            {nodes.map((node, index) => {
              if (!node.position) return null
              
              return (
                <g key={node.id}>
                  <motion.foreignObject
                    x={node.position.x}
                    y={node.position.y}
                    width="120"
                    height="60"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                  >
                    <div className="glass-card rounded-lg p-2 border-2 border-primary/30 dark:border-primary/20 shadow-[0_0_15px_rgba(239,91,33,0.3)] flex flex-col items-center justify-center h-full">
                      <div className="text-[10px] font-mono font-bold text-primary">{node.name}</div>
                      <div className="text-[8px] text-muted-foreground text-center mt-1 px-1">
                        {node.type}
                      </div>
                    </div>
                  </motion.foreignObject>
                </g>
              )
            })}
          </svg>

          {/* Empty State */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Network className="w-16 h-16 text-primary/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No QC Logic Graph</h3>
                <p className="text-sm text-muted-foreground">
                  {parsedQuestions.length === 0
                    ? 'Import questions first to generate QC Logic Graph'
                    : 'QC Logic Graph will be auto-generated from parsed questions'}
                </p>
              </div>
            </div>
          )}

          {/* Legend */}
          {nodes.length > 0 && (
            <div className="absolute bottom-4 left-4 glass-card p-4 rounded-lg">
              <div className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">Edge Types</div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-[2px]" style={{ backgroundColor: getEdgeColor('F1') }} />
                  <span className="text-xs text-muted-foreground">F1 (Hierarchy)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-[2px]" style={{ backgroundColor: getEdgeColor('F2') }} />
                  <span className="text-xs text-muted-foreground">F2 (Sub-hierarchy)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-[2px]" style={{ backgroundColor: getEdgeColor('ASK_IF') }} />
                  <span className="text-xs text-muted-foreground">Ask If (Dependency)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-[2px]" style={{ backgroundColor: getEdgeColor('PIPING') }} />
                  <span className="text-xs text-muted-foreground">Piping (Data Flow)</span>
                </div>
              </div>
            </div>
          )}

          {/* Syntax Modal */}
          {showSyntaxModal && generatedSyntax && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-surface-dark-lighter rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark">
                  <div className="flex items-center gap-3">
                    <Code className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">QC Logic Syntax</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportSyntax}
                      className="px-3 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export</span>
                    </button>
                    <button
                      onClick={() => setShowSyntaxModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#1e1e1e] font-mono text-sm">
                  <pre className="text-gray-300 whitespace-pre-wrap">{generatedSyntax.fullSyntax}</pre>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </main>
    </MainLayout>
  )
}

