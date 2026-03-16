'use client'

import { useState } from 'react'
import { useSurveyStore } from '@/store/surveyStore'
import { ParsedQuestion } from '@/lib/types'
import { Copy, Download, CheckCircle2, AlertCircle, Settings, Zap } from 'lucide-react'
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
  { id: 'topbox', label: 'Top Box', description: 'Top/Bottom Box recode' },
  { id: 'rerank', label: 'Rerank', description: 'Rank-order conversion' },
  { id: 'reloop', label: 'Reloop', description: 'Grid re-loop' },
  { id: 'restruct', label: 'Restruct', description: 'VARSTOCASES' },
  { id: 'coding-oa', label: 'Coding OA', description: 'Open-ended coding' },
  { id: 'recode-means', label: 'Recode Means', description: 'Range to means' },
  { id: 'ctables', label: 'CTables', description: 'CTABLES syntax' },
  { id: 'ctables-v2', label: 'CTables V2', description: 'CTABLES formula-first' },
  { id: 'netcode', label: 'NET Code', description: 'NET code aggregation' },
]

export default function ProcessingHub() {
  const [activeMode, setActiveMode] = useState<'manual' | 'auto'>('manual')
  const [selectedTool, setSelectedTool] = useState<ProcessingTool>('topbox')
  const [globalSyntax, setGlobalSyntax] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { parsedQuestions } = useSurveyStore()

  const handleCopy = async () => {
    if (!globalSyntax) return
    try {
      await navigator.clipboard.writeText(globalSyntax)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDownload = () => {
    if (!globalSyntax) return
    const blob = new Blob([globalSyntax], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spss_syntax_${selectedTool}.sps`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleToolSelect = (tool: ProcessingTool) => {
    setSelectedTool(tool)
    setGlobalSyntax('')
    setError(null)
  }

  const handleModeChange = (mode: 'manual' | 'auto') => {
    setActiveMode(mode)
    setGlobalSyntax('')
    setError(null)
  }

  return (
    <div className="grid grid-cols-12 h-full min-h-screen gap-4 p-4 overflow-hidden">
      {/* Left Pane: Tool Navigation */}
      <aside className="col-span-2 flex flex-col bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="p-4 border-b border-border-light dark:border-border-dark">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Processing Tools</h2>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => handleToolSelect(tool.id)}
              className={`w-full text-left px-4 py-3 rounded-lg mb-1 transition-all ${
                selectedTool === tool.id
                  ? 'bg-primary text-white shadow-md'
                  : 'text-gray-400 dark:text-gray-500 hover:bg-white/5 hover:text-white dark:hover:text-white'
              }`}
            >
              <span className="font-medium block">{tool.label}</span>
              <span className={`text-xs block mt-0.5 ${selectedTool === tool.id ? 'text-white/80' : 'text-gray-500 dark:text-gray-600'}`}>
                {tool.description}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Center Pane: Mode Toggle + Form */}
      <main className="col-span-6 flex flex-col gap-4 overflow-hidden">
        <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
          {/* Mode Toggle */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              {tools.find((t) => t.id === selectedTool)?.label}
            </h2>
            <div className="flex gap-1 p-1 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
              <button
                onClick={() => handleModeChange('manual')}
                className={`px-4 py-2 rounded-md transition-all text-sm flex items-center gap-2 ${
                  activeMode === 'manual'
                    ? 'bg-primary text-white shadow-md'
                    : 'text-gray-400 dark:text-gray-500 hover:text-white'
                }`}
                title="Manual input"
              >
                <Settings className="size-4" />
                Manual
              </button>
              <button
                onClick={() => handleModeChange('auto')}
                className={`px-4 py-2 rounded-md transition-all text-sm flex items-center gap-2 ${
                  activeMode === 'auto'
                    ? 'bg-primary text-white shadow-md'
                    : 'text-gray-400 dark:text-gray-500 hover:text-white'
                }`}
                title="Auto from questions"
              >
                <Zap className="size-4" />
                Auto
              </button>
            </div>
          </div>

          {/* Tool Form */}
          {activeMode === 'manual' ? (
            <ManualInputForm
              tool={selectedTool}
              setGlobalSyntax={setGlobalSyntax}
              onError={setError}
            />
          ) : (
            <AutoInputForm
              tool={selectedTool}
              questions={parsedQuestions}
              setGlobalSyntax={setGlobalSyntax}
              onError={setError}
            />
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-500">
              <AlertCircle className="size-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
      </main>

      {/* Right Pane: Live Syntax Preview */}
      <aside className="col-span-4 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Live Syntax Preview</h3>
          <button
            onClick={handleDownload}
            disabled={!globalSyntax}
            className="px-3 py-1.5 bg-primary text-white rounded-md text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Download className="size-4" />
            Download
          </button>
        </div>
        <div className="relative flex-1 min-h-[300px] bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
          <button
            onClick={handleCopy}
            disabled={!globalSyntax}
            className="absolute top-2 right-2 z-10 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-sm flex items-center gap-1.5 text-green-400 border border-gray-600"
          >
            {copied ? <CheckCircle2 className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <pre className="h-full p-4 pt-12 font-mono text-sm text-green-400 overflow-y-auto custom-scrollbar">
            <code>{globalSyntax || '// Generated syntax will appear here'}</code>
          </pre>
        </div>
      </aside>
    </div>
  )
}

// Manual Input Form Component
function ManualInputForm({
  tool,
  setGlobalSyntax,
  onError,
}: {
  tool: ProcessingTool
  setGlobalSyntax: (syntax: string) => void
  onError: (error: string) => void
}) {
  const commonProps = { setGlobalSyntax, onError }
  switch (tool) {
    case 'topbox':
      return <TopboxForm mode="manual" {...commonProps} />
    case 'netcode':
      return <NetcodeForm mode="manual" {...commonProps} />
    case 'rerank':
      return <RerankForm mode="manual" questions={[]} {...commonProps} />
    case 'reloop':
      return <ReloopForm mode="manual" questions={[]} {...commonProps} />
    case 'restruct':
      return <RestructForm mode="manual" questions={[]} {...commonProps} />
    case 'recode-means':
      return <RecodeMeansForm mode="manual" questions={[]} {...commonProps} />
    case 'coding-oa':
      return <CodingOAForm mode="manual" questions={[]} {...commonProps} />
    case 'ctables':
      return <CTablesForm mode="manual" questions={[]} {...commonProps} />
    case 'ctables-v2':
      return <CTablesV2Form mode="manual" questions={[]} {...commonProps} />
    default:
      return (
        <div className="p-4 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
          <p className="text-gray-400 dark:text-gray-600">Manual input form for {tool}</p>
        </div>
      )
  }
}

// Auto Input Form Component
function AutoInputForm({
  tool,
  questions,
  setGlobalSyntax,
  onError,
}: {
  tool: ProcessingTool
  questions: ParsedQuestion[]
  setGlobalSyntax: (syntax: string) => void
  onError: (error: string) => void
}) {
  const commonProps = { questions, setGlobalSyntax, onError }
  switch (tool) {
    case 'topbox':
      return <TopboxForm mode="auto" {...commonProps} />
    case 'netcode':
      return <NetcodeForm mode="auto" {...commonProps} />
    case 'rerank':
      return <RerankForm mode="auto" {...commonProps} />
    case 'reloop':
      return <ReloopForm mode="auto" {...commonProps} />
    case 'restruct':
      return <RestructForm mode="auto" {...commonProps} />
    case 'recode-means':
      return <RecodeMeansForm mode="auto" {...commonProps} />
    case 'coding-oa':
      return <CodingOAForm mode="auto" {...commonProps} />
    case 'ctables':
      return <CTablesForm mode="auto" {...commonProps} />
    case 'ctables-v2':
      return <CTablesV2Form mode="auto" {...commonProps} />
    default:
      return (
        <div className="p-4 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
          <p className="text-gray-400 dark:text-gray-600">Auto form for {tool}</p>
        </div>
      )
  }
}
