'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useSurveyStore } from '@/store/surveyStore'
import { ParsedQuestion } from '@/lib/geminiParser'
import { Copy, Download, X, CheckCircle2, AlertCircle, ArrowLeft, Settings } from 'lucide-react'
import TopboxForm from '@/components/processing/TopboxForm'
import NetcodeForm from '@/components/processing/NetcodeForm'
import RerankForm from '@/components/processing/RerankForm'
import ReloopForm from '@/components/processing/ReloopForm'
import RestructForm from '@/components/processing/RestructForm'
import RecodeMeansForm from '@/components/processing/RecodeMeansForm'
import CodingOAForm from '@/components/processing/CodingOAForm'
import CTablesForm from '@/components/processing/CTablesForm'
import CTablesV2Form from '@/components/processing/CTablesV2Form'

type ProcessingTool = 
  | 'topbox' 
  | 'rerank' 
  | 'reloop' 
  | 'restruct' 
  | 'coding-oa' 
  | 'recode-means' 
  | 'ctables' 
  | 'ctables-v2' 
  | 'netcode'

interface ToolConfig {
  id: ProcessingTool
  label: string
  description: string
}

const tools: ToolConfig[] = [
  { id: 'topbox', label: 'Top Box', description: 'Tạo syntax cho Top/Bottom Box' },
  { id: 'rerank', label: 'Rerank', description: 'Tạo syntax cho Rerank' },
  { id: 'reloop', label: 'Reloop', description: 'Tạo syntax cho Reloop' },
  { id: 'restruct', label: 'Restruct', description: 'Tạo syntax cho VARSTOCASES Restruct' },
  { id: 'coding-oa', label: 'Coding OA', description: 'Tạo syntax cho Coding Open-Ended Answers' },
  { id: 'recode-means', label: 'Recode Means', description: 'Tạo syntax cho Recode Means' },
  { id: 'ctables', label: 'CTables', description: 'Tạo syntax cho CTABLES' },
  { id: 'ctables-v2', label: 'CTables V2', description: 'Tạo syntax cho CTABLES V2' },
  { id: 'netcode', label: 'NET Code', description: 'Tạo syntax cho NET Code' },
]

export default function ProcessingHub() {
  const [activeMode, setActiveMode] = useState<'manual' | 'auto'>('manual')
  const [selectedTool, setSelectedTool] = useState<ProcessingTool | null>(null)
  const [syntax, setSyntax] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  
  const { parsedQuestions } = useSurveyStore()

  const handleCopy = async () => {
    if (!syntax) return
    try {
      await navigator.clipboard.writeText(syntax)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDownload = () => {
    if (!syntax) return
    const blob = new Blob([syntax], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spss_syntax_${selectedTool || 'output'}.sps`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full w-full p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Processing Hub</h1>
          <p className="text-gray-400 dark:text-gray-600">Generate SPSS syntax for data processing</p>
        </div>
      </div>

      {/* Mode Toggle - Only show when no tool selected or allow switching while tool is selected */}
      {!selectedTool && (
        <div className="flex gap-4 p-1 bg-glass-panel rounded-lg border border-glass-border-dark dark:border-glass-border-light">
          <button
            onClick={() => {
              setActiveMode('manual')
              setSyntax('')
              setError(null)
            }}
            className={`flex-1 px-4 py-2 rounded-md transition-all flex items-center justify-center gap-2 ${
              activeMode === 'manual'
                ? 'bg-primary text-white shadow-lg'
                : 'text-gray-400 dark:text-gray-600 hover:text-white dark:hover:text-black'
            }`}
          >
            <Settings className="size-4" />
            Manual Input
          </button>
          <button
            onClick={() => {
              setActiveMode('auto')
              setSyntax('')
              setError(null)
            }}
            className={`flex-1 px-4 py-2 rounded-md transition-all flex items-center justify-center gap-2 ${
              activeMode === 'auto'
                ? 'bg-primary text-white shadow-lg'
                : 'text-gray-400 dark:text-gray-600 hover:text-white dark:hover:text-black'
            }`}
          >
            <Settings className="size-4" />
            Auto from Questions
          </button>
        </div>
      )}

      {/* Tool Selection */}
      {!selectedTool && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <motion.button
              key={tool.id}
              onClick={() => setSelectedTool(tool.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="p-4 bg-glass-panel rounded-lg border border-glass-border-dark dark:border-glass-border-light text-left hover:border-primary/50 transition-all"
            >
              <h3 className="font-semibold text-white mb-1">{tool.label}</h3>
              <p className="text-sm text-gray-400 dark:text-gray-600">{tool.description}</p>
            </motion.button>
          ))}
        </div>
      )}

      {/* Tool Form */}
      {selectedTool && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          {/* Header with Back button and Mode Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedTool(null)
                  setSyntax('')
                  setError(null)
                }}
                className="p-2 hover:bg-glass-panel rounded-lg transition-colors border border-glass-border-dark dark:border-glass-border-light flex items-center gap-2 text-white"
                title="Trở về chọn tool"
              >
                <ArrowLeft className="size-5" />
              </button>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {tools.find(t => t.id === selectedTool)?.label}
                </h2>
                <p className="text-sm text-gray-400 dark:text-gray-600">
                  {tools.find(t => t.id === selectedTool)?.description}
                </p>
              </div>
            </div>
            
            {/* Mode Toggle - Compact version when tool is selected */}
            <div className="flex gap-2 p-1 bg-glass-panel rounded-lg border border-glass-border-dark dark:border-glass-border-light">
              <button
                onClick={() => {
                  setActiveMode('manual')
                  setSyntax('')
                  setError(null)
                }}
                className={`px-3 py-1.5 rounded-md transition-all text-sm flex items-center gap-1.5 ${
                  activeMode === 'manual'
                    ? 'bg-primary text-white shadow-lg'
                    : 'text-gray-400 dark:text-gray-600 hover:text-white dark:hover:text-black'
                }`}
                title="Chế độ nhập thủ công"
              >
                <Settings className="size-3.5" />
                Manual
              </button>
              <button
                onClick={() => {
                  setActiveMode('auto')
                  setSyntax('')
                  setError(null)
                }}
                className={`px-3 py-1.5 rounded-md transition-all text-sm flex items-center gap-1.5 ${
                  activeMode === 'auto'
                    ? 'bg-primary text-white shadow-lg'
                    : 'text-gray-400 dark:text-gray-600 hover:text-white dark:hover:text-black'
                }`}
                title="Chế độ tự động từ câu hỏi"
              >
                <Settings className="size-3.5" />
                Auto
              </button>
            </div>
          </div>

          {activeMode === 'manual' ? (
            <ManualInputForm 
              tool={selectedTool} 
              onSyntaxGenerated={setSyntax}
              onError={setError}
            />
          ) : (
            <AutoInputForm 
              tool={selectedTool}
              questions={parsedQuestions}
              onSyntaxGenerated={setSyntax}
              onError={setError}
            />
          )}
        </motion.div>
      )}

      {/* Syntax Output */}
      {syntax && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Generated Syntax</h3>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-glass-panel rounded-lg border border-glass-border-dark dark:border-glass-border-light hover:border-primary/50 transition-all flex items-center gap-2 text-white"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="size-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="size-4" />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all flex items-center gap-2"
              >
                <Download className="size-4" />
                Download
              </button>
            </div>
          </div>
          <pre className="p-4 bg-glass-panel rounded-lg border border-glass-border-dark dark:border-glass-border-light font-mono text-sm overflow-y-auto max-h-96 text-white custom-scrollbar" style={{ scrollBehavior: 'smooth' }}>
            {syntax}
          </pre>
        </motion.div>
      )}

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-500"
        >
          <AlertCircle className="size-5" />
          <p>{error}</p>
        </motion.div>
      )}
    </div>
  )
}

// Manual Input Form Component
function ManualInputForm({ 
  tool, 
  onSyntaxGenerated, 
  onError 
}: { 
  tool: ProcessingTool
  onSyntaxGenerated: (syntax: string) => void
  onError: (error: string) => void
}) {
  switch (tool) {
    case 'topbox':
      return <TopboxForm mode="manual" onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    case 'netcode':
      return <NetcodeForm mode="manual" onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    case 'rerank':
      return <RerankForm mode="manual" onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    case 'reloop':
      return <ReloopForm mode="manual" questions={[]} onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    case 'restruct':
      return <RestructForm mode="manual" questions={[]} onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    case 'recode-means':
      return <RecodeMeansForm mode="manual" questions={[]} onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    case 'coding-oa':
      return <CodingOAForm mode="manual" questions={[]} onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    case 'ctables':
      return <CTablesForm mode="manual" questions={[]} onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    case 'ctables-v2':
      return <CTablesV2Form mode="manual" questions={[]} onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    default:
      return (
        <div className="p-4 bg-glass-panel rounded-lg border border-glass-border-dark dark:border-glass-border-light">
          <p className="text-gray-400 dark:text-gray-600">Manual input form for {tool} - Coming soon</p>
        </div>
      )
  }
}

// Auto Input Form Component
function AutoInputForm({ 
  tool, 
  questions, 
  onSyntaxGenerated, 
  onError 
}: { 
  tool: ProcessingTool
  questions: ParsedQuestion[]
  onSyntaxGenerated: (syntax: string) => void
  onError: (error: string) => void
}) {
  switch (tool) {
    case 'topbox':
      return <TopboxForm mode="auto" questions={questions} onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    case 'netcode':
      return <NetcodeForm mode="auto" questions={questions} onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    case 'rerank':
      return <RerankForm mode="auto" questions={questions} onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    case 'reloop':
      return <ReloopForm mode="auto" questions={questions} onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    case 'restruct':
      return <RestructForm mode="auto" questions={questions} onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    case 'recode-means':
      return <RecodeMeansForm mode="auto" questions={questions} onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    case 'coding-oa':
      return <CodingOAForm mode="auto" questions={questions} onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    case 'ctables':
      return <CTablesForm mode="auto" questions={questions} onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    case 'ctables-v2':
      return <CTablesV2Form mode="auto" questions={questions} onSyntaxGenerated={onSyntaxGenerated} onError={onError} />
    default:
      return (
        <div className="p-4 bg-glass-panel rounded-lg border border-glass-border-dark dark:border-glass-border-light">
          <p className="text-gray-400 dark:text-gray-600">
            Auto input form for {tool} - Select from {questions.length} questions - Coming soon
          </p>
        </div>
      )
  }
}
