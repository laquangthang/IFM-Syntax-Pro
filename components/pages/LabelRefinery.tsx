'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSurveyStore } from '@/store/surveyStore'
import { ParsedQuestion } from '@/lib/geminiParser'
import MainLayout from '../Layout/MainLayout'
import QuestionCard from '../questions/QuestionCard'
import { 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  FileText,
  Save
} from 'lucide-react'
import ThemeToggle from '../ThemeToggle'

export default function LabelRefinery() {
  const { parsedQuestions, questionsMap, updateQuestion } = useSurveyStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null)
  const [pdfZoom, setPdfZoom] = useState(100)
  const [currentPage, setCurrentPage] = useState(1)

  // Load questions from map
  const questions = useMemo(() => {
    return Array.from(questionsMap.values())
  }, [questionsMap])

  // Filter questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchesSearch = 
        q.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.instruction?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      
      const matchesType = filterType === 'all' || q.type === filterType
      
      return matchesSearch && matchesType
    })
  }, [questions, searchQuery, filterType])

  // Get unique question types
  const questionTypes = useMemo(() => {
    const types = new Set(questions.map(q => q.type))
    return Array.from(types).sort()
  }, [questions])

  // Toggle question expansion
  const toggleQuestion = (id: string) => {
    const newExpanded = new Set(expandedQuestions)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
      setSelectedQuestionId(id)
    }
    setExpandedQuestions(newExpanded)
  }

  // Handle question update
  const handleQuestionUpdate = (id: string, updatedQuestion: ParsedQuestion) => {
    updateQuestion(id, updatedQuestion)
  }

  // Render PDF-like view from questions as table
  const renderPDFView = () => {
    if (questions.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          <div className="text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No questions loaded. Please import questions first.</p>
          </div>
        </div>
      )
    }

    return (
      <div 
        className="w-full h-full overflow-auto bg-white"
        style={{ transform: `scale(${pdfZoom / 100})`, transformOrigin: 'top left' }}
      >
        <div className="p-8">
          {/* Header */}
          <div className="text-center border-b pb-4 mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">RESEARCH STUDY Q3</h1>
            <p className="text-sm text-gray-600">CONFIDENTIAL</p>
          </div>

          {/* Questions with individual tables */}
          <div className="space-y-8">
            {questions.map((question, qIndex) => {
              const isSelected = selectedQuestionId === question.id
              
              // Check if this is a Matrix MA question (MA or MA_Grid with rows and columns)
              const isMatrixMA = (question.type === 'MA' || question.type === 'MA_Grid') && 
                                  question.rows && question.rows.length > 0 && 
                                  question.columns && question.columns.length > 0

              // Get table rows for this question (only codes/options) - NOT for Matrix MA
              const tableRows: Array<{
                code: string | number
                label: string
                logic: string
              }> = []

              // For Matrix MA, skip building tableRows - we'll render Matrix table instead
              if (!isMatrixMA) {
                // Add options
                if (question.options && question.options.length > 0) {
                  question.options.forEach((option) => {
                    let logicText = 'Normal'
                    
                    // Use codeType directly (Exclusive, Trap, Other, Terminate, Normal)
                    if (option.codeType === 'Exclusive') {
                      logicText = 'Exclusive'
                    } else if (option.codeType === 'Trap') {
                      logicText = 'Trap'
                    } else if (option.codeType === 'Other') {
                      logicText = 'Other'
                    } else if (option.codeType === 'Terminate') {
                      logicText = 'Terminate'
                    }
                    
                    tableRows.push({
                      code: option.code,
                      label: option.label,
                      logic: logicText
                    })
                  })
                }

                // Add rows for Grid questions (non-Matrix)
                if (question.rows && question.rows.length > 0 && !question.columns) {
                  question.rows.forEach((row) => {
                    tableRows.push({
                      code: row.code,
                      label: row.label,
                      logic: row.codeType || 'Normal'
                    })
                  })
                }

                // Add columns for Grid questions (non-Matrix, only if no rows)
                if (question.columns && question.columns.length > 0 && !question.rows) {
                  question.columns.forEach((col) => {
                    tableRows.push({
                      code: col.code,
                      label: col.label,
                      logic: col.codeType || 'Normal'
                    })
                  })
                }
              }

              // If no options/rows/columns, show empty state
              if (!isMatrixMA && tableRows.length === 0) {
                return (
                  <div
                    key={question.id}
                    className={`p-6 rounded-lg border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-lg'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedQuestionId(question.id)
                      if (!expandedQuestions.has(question.id)) {
                        toggleQuestion(question.id)
                      }
                    }}
                  >
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {question.id}. {question.label}
                      </h3>
                      {question.instruction && (
                        <p className="text-sm text-gray-600 italic mb-3">{question.instruction}</p>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">No options available for this question type</p>
                  </div>
                )
              }

              return (
                <div
                  key={question.id}
                  className={`transition-all ${
                    isSelected ? 'ring-2 ring-primary ring-offset-2' : ''
                  }`}
                >
                  {/* Question Header */}
                  <div
                    className={`p-4 rounded-t-lg border-2 border-b-0 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setSelectedQuestionId(question.id)
                      if (!expandedQuestions.has(question.id)) {
                        toggleQuestion(question.id)
                      }
                    }}
                  >
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {question.id}. {question.label}
                    </h3>
                    {question.instruction && (
                      <p className="text-sm text-gray-600 italic">{question.instruction}</p>
                    )}
                    {question.logic && question.logic.type !== 'Normal' && (
                      <p className="text-xs text-primary mt-2 font-mono">
                        Logic: {question.logic.type}
                      </p>
                    )}
                  </div>

                  {/* Matrix Table for MA_Grid questions */}
                  {isMatrixMA ? (
                    <div className="overflow-x-auto border-2 border-t-0 rounded-b-lg border-gray-200 bg-white">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900">
                              <div className="flex flex-col">
                                <span>CODE</span>
                                <span className="text-xs font-normal opacity-70">VN</span>
                              </div>
                            </th>
                            {question.columns.map((column, colIdx) => (
                              <th key={colIdx} className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">
                                <div className="flex flex-col items-center">
                                  <span className="text-gray-900 font-bold font-mono">{column.code}</span>
                                  <span className="text-xs font-normal opacity-70 mt-1">{column.label}</span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {question.rows.map((row, rowIdx) => (
                            <tr
                              key={rowIdx}
                              className={`border-b border-gray-300 hover:bg-gray-50 transition-colors ${
                                isSelected ? 'bg-primary/5' : ''
                              }`}
                              onClick={() => {
                                setSelectedQuestionId(question.id)
                                if (!expandedQuestions.has(question.id)) {
                                  toggleQuestion(question.id)
                                }
                              }}
                            >
                              <td className="border border-gray-300 px-4 py-2">
                                <div className="flex flex-col">
                                  <span className="text-gray-900 font-bold font-mono text-sm">{row.code}</span>
                                  <span className="text-xs text-gray-700 mt-0.5">{row.label}</span>
                                </div>
                              </td>
                              {question.columns.map((column, colIdx) => (
                                <td
                                  key={colIdx}
                                  className="border border-gray-300 px-4 py-2 text-center"
                                >
                                  <span className="text-gray-900 font-bold font-mono text-sm">
                                    {column.code}
                                  </span>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {/* Matrix Info */}
                      <div className="px-4 py-2 bg-gray-50 border-t border-gray-300 text-xs text-gray-600">
                        Matrix: {question.rows.length} rows × {question.columns.length} columns = {question.rows.length * question.columns.length} variables
                      </div>
                    </div>
                  ) : (
                    /* Regular Table for codes only */
                    <div className="overflow-x-auto border-2 border-t-0 rounded-b-lg border-gray-200">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900 w-32">
                              Code
                            </th>
                            <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900">
                              Label
                            </th>
                            <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900 w-32">
                              Logic
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.map((row, index) => (
                            <tr
                              key={`${question.id}-${row.code}-${index}`}
                              className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                                isSelected ? 'bg-primary/5' : ''
                              }`}
                              onClick={() => {
                                setSelectedQuestionId(question.id)
                                if (!expandedQuestions.has(question.id)) {
                                  toggleQuestion(question.id)
                                }
                              }}
                            >
                              <td className="border border-gray-300 px-4 py-2 font-mono text-sm text-gray-700">
                                {row.code}
                              </td>
                              <td className="border border-gray-300 px-4 py-2 text-gray-700">
                                {row.label}
                              </td>
                              <td className="border border-gray-300 px-4 py-2 text-sm">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  row.logic === 'Exclusive'
                                    ? 'bg-orange-100 text-orange-700'
                                    : row.logic === 'Trap'
                                    ? 'bg-red-100 text-red-700'
                                    : row.logic === 'Terminate'
                                    ? 'bg-amber-100 text-amber-700'
                                    : row.logic === 'Other'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {row.logic}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <MainLayout>
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-glass-border-light dark:border-glass-border-dark glass-panel z-40 relative bg-background-light dark:bg-background-dark">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <a href="#" className="hover:text-foreground">Projects</a>
            <span className="text-[16px]">›</span>
            <a href="#" className="hover:text-foreground">Project Alpha</a>
            <span className="text-[16px]">›</span>
            <span className="text-foreground bg-primary/10 dark:bg-primary/10 px-2 py-0.5 rounded text-xs border border-primary/30">
              Label Refinery
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 px-3 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg transition-all">
            <Save className="w-4 h-4" />
            <span>Save Changes</span>
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg transition-all">
            <Download className="w-4 h-4" />
            <span>Export to 3D</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content - Split View */}
      <main className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Panel - PDF Viewer */}
        <div className="w-1/2 flex flex-col bg-white border-r border-gray-300 relative">
          {/* PDF Toolbar */}
          <div className="h-12 bg-gray-100 border-b border-gray-300 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPdfZoom(Math.max(50, pdfZoom - 10))}
                className="p-1 hover:bg-gray-200 rounded"
                disabled={pdfZoom <= 50}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 min-w-[60px] text-center">{pdfZoom}%</span>
              <button
                onClick={() => setPdfZoom(Math.min(200, pdfZoom + 10))}
                className="p-1 hover:bg-gray-200 rounded"
                disabled={pdfZoom >= 200}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <button className="p-1 hover:bg-gray-200 rounded">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>{currentPage} / {Math.ceil(questions.length / 5)}</span>
              <button className="p-1 hover:bg-gray-200 rounded">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* PDF Content */}
          <div className="flex-1 overflow-auto bg-gray-50">
            {renderPDFView()}
          </div>
        </div>

        {/* Right Panel - Logic Cards */}
        <div className="w-1/2 flex flex-col bg-background-dark border-l border-surface-border">
          {/* Logic Cards Header */}
          <div className="p-6 pb-4 border-b border-surface-border bg-background-dark/95 backdrop-blur z-10 shrink-0">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Logic Cards
                <span className="text-xs font-normal text-gray-400 bg-surface-border px-2 py-0.5 rounded-full">
                  {questions.length} Detected
                </span>
              </h2>
              <div className="flex gap-2">
              <div className="relative">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-dark border border-surface-border text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="all">All Types</option>
                  {questionTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <Filter className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            </div>
            
            {/* Search Bar */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Filter by question text, type, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border-none rounded-lg leading-5 bg-surface-dark text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm transition-all"
              />
            </div>
          </div>

          {/* Logic Cards List - Only show selected question */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {!selectedQuestionId ? (
              <div className="text-center py-12">
                <p className="text-gray-400">
                  Select a question from the PDF table to view its details
                </p>
              </div>
            ) : (() => {
              const selectedQuestion = questions.find(q => q.id === selectedQuestionId)
              if (!selectedQuestion) {
                return (
                  <div className="text-center py-12">
                    <p className="text-gray-400">
                      Question not found
                    </p>
                  </div>
                )
              }
              
              // Check if selected question matches filter
              const matchesSearch = 
                selectedQuestion.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                selectedQuestion.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (selectedQuestion.instruction?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
              
              const matchesType = filterType === 'all' || selectedQuestion.type === filterType
              
              if (!matchesSearch || !matchesType) {
                return (
                  <div className="text-center py-12">
                    <p className="text-gray-400">
                      Selected question does not match current filter
                    </p>
                  </div>
                )
              }
              
              return (
                <AnimatePresence>
                  <QuestionCard
                    key={selectedQuestion.id}
                    question={selectedQuestion}
                    isExpanded={expandedQuestions.has(selectedQuestion.id)}
                    onToggle={() => toggleQuestion(selectedQuestion.id)}
                    index={0}
                    onUpdate={(updatedQuestion) => {
                      handleQuestionUpdate(selectedQuestion.id, updatedQuestion)
                    }}
                  />
                </AnimatePresence>
              )
            })()}
          </div>

          {/* Auto-Generate Button */}
          {questions.length > 0 && (
            <div className="p-6 border-t border-surface-border shrink-0">
              <button className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium">
                <span className="text-lg">⭐</span>
                <span>Auto-Generate Remaining</span>
              </button>
            </div>
          )}
        </div>
      </main>
    </MainLayout>
  )
}

