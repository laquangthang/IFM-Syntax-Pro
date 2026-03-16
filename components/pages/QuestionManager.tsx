'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSurveyStore } from '@/store/surveyStore'
import { parseSPSSExcel } from '@/lib/parsers/excelParser'
import { ParsedQuestion } from '@/lib/types'
import * as XLSX from 'xlsx'
import MainLayout from '@/components/Layout/MainLayout'
import { 
  Upload, 
  Search, 
  Filter, 
  Trash2,
  FileText,
  AlertCircle,
  X,
  Download,
  Plus,
  Copy,
  Code,
  Check,
  GripVertical,
  List,
  Table2,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import QuestionCard from '@/components/questions/QuestionCard'
import QuestionsTablePDFView from '@/components/questions/QuestionsTablePDFView'
import ThemeToggle from '@/components/ThemeToggle'
import { generateCompleteSyntax, sortQuestionsByIdWithPrefix } from '@/lib/syntaxGenerator'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Sortable Question Item Component
interface SortableQuestionItemProps {
  question: ParsedQuestion
  index: number
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (q: Partial<ParsedQuestion>) => void
  onDelete: () => void
}

function SortableQuestionItem({
  question,
  index,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
}: SortableQuestionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 ${isDragging ? 'relative' : ''}`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex flex-col items-center gap-1 pt-3 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
        <div className="text-xs text-gray-500 text-center font-mono">
          {index + 1}
        </div>
      </div>

      {/* Question Card */}
      <div className="flex-1">
        <QuestionCard
          question={question}
          isExpanded={isExpanded}
          onToggle={onToggle}
          index={index}
          onUpdate={onUpdate}
        />
      </div>

      {/* Delete Button */}
      <button
        onClick={onDelete}
        className="p-2 mt-2 text-muted-foreground hover:text-red-500 rounded-lg transition-colors"
        title="Delete question"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// Drag Overlay Component (shown while dragging)
function QuestionDragOverlay({ question, index }: { question: ParsedQuestion; index: number }) {
  return (
    <div className="flex items-start gap-2 opacity-90">
      <div className="flex flex-col items-center gap-1 pt-3">
        <GripVertical className="w-5 h-5 text-primary" />
        <div className="text-xs text-primary text-center font-mono">
          {index + 1}
        </div>
      </div>
      <div className="flex-1 bg-white dark:bg-surface-dark rounded-lg border-2 border-primary shadow-xl p-4">
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 bg-primary/10 text-primary text-sm font-mono rounded">
            {question.id}
          </span>
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
            {question.label.substring(0, 50)}...
          </span>
        </div>
      </div>
    </div>
  )
}

export default function QuestionManager() {
  const { 
    parsedQuestions, 
    questionsMap, 
    setParsedQuestions,
    oldVariableMapping,
    setQuestionOldVariables,
    setOldVariableMapping,
    isLoading,
    setLoading,
    setError,
    error
  } = useSurveyStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'table'>('list')
  const [pdfZoom, setPdfZoom] = useState(100)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showSyntaxModal, setShowSyntaxModal] = useState(false)
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false)
  const [generatedSyntax, setGeneratedSyntax] = useState<string>('')
  const [copied, setCopied] = useState(false)
  
  // New question form state
  const [newQuestion, setNewQuestion] = useState<Partial<ParsedQuestion>>({
    id: '',
    type: 'SA',
    label: '',
    options: [],
  })

  // Load questions from map and sort by ID with prefix priority (Q1, Q2... H1, H2...)
  const questions = useMemo(() => {
    const allQuestions = Array.from(questionsMap.values())
    // Sort questions by ID with prefix priority for consistent display
    return sortQuestionsByIdWithPrefix(allQuestions)
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
    setExpandedQuestions((prev) => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(id)) {
        newExpanded.delete(id)
      } else {
        newExpanded.add(id)
      }
      return newExpanded
    })
  }

  // Handle Excel file import (SPSS format: 2 columns - variable name, label)
  const handleFileImport = async (file: File) => {
    try {
      setLoading(true)
      setError(null)
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const result = parseSPSSExcel(workbook)
      const questions = result.questions
      if (questions.length === 0) {
        throw new Error('No questions found in Excel file. Please check the file format (2 columns: variable name, label).')
      }
      setParsedQuestions(questions)
      if (result.oldVariableMapping) {
        setOldVariableMapping(result.oldVariableMapping)
      }
      setExpandedQuestions(new Set([questions[0].id]))
      setSelectedQuestion(questions[0].id)
    } catch (err) {
      console.error('❌ Error loading Excel:', err)
      setError(err instanceof Error ? err.message : 'Failed to load Excel file')
    } finally {
      setLoading(false)
    }
  }

  // Export JSON
  const handleExport = () => {
    const json = {
      questions: questions
    }
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `questions_export_${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Generate SPSS Syntax
  const handleGenerateSyntax = () => {
    if (parsedQuestions.length === 0) return
    
    const { oldVariableMapping } = useSurveyStore.getState()
    const syntax = generateCompleteSyntax(parsedQuestions, oldVariableMapping)
    setGeneratedSyntax(syntax)
    setShowSyntaxModal(true)
  }

  // Copy syntax to clipboard
  const handleCopySyntax = async () => {
    try {
      await navigator.clipboard.writeText(generatedSyntax)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Export syntax to file
  const handleExportSyntax = () => {
    if (!generatedSyntax) return

    const blob = new Blob([generatedSyntax], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clean_label_syntax_${new Date().toISOString().split('T')[0]}.sps`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Add new question
  const handleAddQuestion = () => {
    if (!newQuestion.id || !newQuestion.label) {
      setError('Question ID and Label are required')
      return
    }
    
    // Check if ID already exists
    if (questionsMap.has(newQuestion.id)) {
      setError(`Question ID "${newQuestion.id}" already exists`)
      return
    }
    
    const question: ParsedQuestion = {
      id: newQuestion.id,
      type: newQuestion.type || 'SA',
      label: newQuestion.label,
      options: newQuestion.options && newQuestion.options.length > 0 ? newQuestion.options : undefined,
    }
    
    // Add to store
    const newQuestions = [...parsedQuestions, question]
    setParsedQuestions(newQuestions)
    
    // Reset form and close modal
    setNewQuestion({ id: '', type: 'SA', label: '', options: [] })
    setShowAddQuestionModal(false)
    setError(null)
    
    // Expand the new question
    setExpandedQuestions(prev => new Set([...prev, question.id]))
  }

  // Delete question
  const handleDeleteQuestion = (questionId: string) => {
    if (!confirm(`Are you sure you want to delete question "${questionId}"?`)) {
      return
    }
    
    const { deleteQuestion } = useSurveyStore.getState()
    deleteQuestion(questionId)
    
    // Remove from expanded set
    setExpandedQuestions(prev => {
      const newSet = new Set(prev)
      newSet.delete(questionId)
      return newSet
    })
  }

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // State for active dragging item
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeQuestion = activeId ? questions.find(q => q.id === activeId) : null

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  // Handle drag end - reorder in the original unfiltered array to preserve absolute order
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const oldIndex = questions.findIndex(q => q.id === active.id)
    const newIndex = questions.findIndex(q => q.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const newQuestions = arrayMove(questions, oldIndex, newIndex)
    setParsedQuestions(newQuestions)
  }

  return (
    <MainLayout>
      <div className="flex-1 flex flex-col min-h-0 px-6">
        {/* Unified Sticky Header */}
        <header className="sticky top-0 z-10 bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark pb-4 pt-4 -mx-6 mb-6 px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Left: Title + Question Count */}
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-foreground" />
                <span className="font-semibold text-foreground">Question Manager</span>
                {questions.length > 0 && (
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                    {questions.length} questions
                  </span>
                )}
              </div>

              {/* Right: View Toggle + Action Buttons */}
              <div className="flex items-center gap-2">
                {questions.length > 0 && (
                  <>
                    <div className="flex rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
                      <button
                        onClick={() => setViewMode('list')}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs transition-all ${
                          viewMode === 'list'
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <List className="w-4 h-4" />
                        <span>List</span>
                      </button>
                      <button
                        onClick={() => setViewMode('table')}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs transition-all ${
                          viewMode === 'table'
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Table2 className="w-4 h-4" />
                        <span>Table</span>
                      </button>
                    </div>
                    <button
                      onClick={handleGenerateSyntax}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg transition-all"
                    >
                      <Code className="w-4 h-4" />
                      <span>Generate Syntax</span>
                    </button>
                    <button
                      onClick={handleExport}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg transition-all"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export JSON</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowAddQuestionModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/30 rounded-lg transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Question</span>
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-all text-sm font-medium"
                >
                  <Upload className="w-4 h-4" />
                  <span>Import Excel</span>
                </button>
                <ThemeToggle />
              </div>
            </div>

            {/* Middle: Search + Filter (when questions exist) */}
            {questions.length > 0 && (
              <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search questions by ID, label, or instruction..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="relative">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="appearance-none pl-4 pr-10 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground cursor-pointer"
                  >
                    <option value="all">All Types</option>
                    {questionTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 relative">
        {questions.length === 0 ? (
          // Empty State
          <div className="flex-1 flex items-center justify-center p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-md"
            >
              <div className="size-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto mb-6">
                <FileText className="size-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                No Questions Loaded
              </h2>
              <p className="dark:text-gray-400 text-gray-600 mb-6">
                Import an Excel file to start managing questions
              </p>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg transition-all mx-auto"
              >
                <Upload className="w-5 h-5" />
                <span>Import Excel File</span>
              </button>
            </motion.div>
          </div>
        ) : viewMode === 'table' ? (
          /* Table View */
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0 border-r border-border-light dark:border-border-dark">
              <div className="h-12 shrink-0 flex items-center justify-end px-4 border-b border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPdfZoom(Math.max(50, pdfZoom - 10))}
                    className="p-1.5 hover:bg-white/5 rounded disabled:opacity-50"
                    disabled={pdfZoom <= 50}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-muted-foreground min-w-[48px] text-center">{pdfZoom}%</span>
                  <button
                    onClick={() => setPdfZoom(Math.min(200, pdfZoom + 10))}
                    className="p-1.5 hover:bg-white/5 rounded disabled:opacity-50"
                    disabled={pdfZoom >= 200}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-surface-light dark:bg-surface-dark">
                <QuestionsTablePDFView
                  questions={filteredQuestions}
                  questionsMap={questionsMap}
                  pdfZoom={pdfZoom}
                  selectedQuestionId={selectedQuestion}
                  expandedQuestions={expandedQuestions}
                  onSelectQuestion={setSelectedQuestion}
                  onToggleExpand={toggleQuestion}
                />
              </div>
            </div>
            <div className="w-[400px] shrink-0 flex flex-col bg-background-light dark:bg-background-dark overflow-hidden">
              <div className="p-4 border-b border-border-light dark:border-border-dark">
                <h3 className="text-sm font-semibold text-foreground">Question Details</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {selectedQuestion ? (
                  (() => {
                    const q = questions.find(x => x.id === selectedQuestion)
                    if (!q) return <p className="text-muted-foreground text-sm">Question not found</p>
                    return (
                      <QuestionCard
                        question={q}
                        isExpanded={expandedQuestions.has(q.id)}
                        onToggle={() => toggleQuestion(q.id)}
                        index={0}
                        onUpdate={(upd) => {
                          const { updateQuestion } = useSurveyStore.getState()
                          updateQuestion(q.id, upd)
                        }}
                      />
                    )
                  })()
                ) : (
                  <p className="text-muted-foreground text-sm">Select a question from the table</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* List View */
          <div className="flex-1 flex flex-col min-h-0 p-8">
            <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full h-full min-h-0">
              {searchQuery || filterType !== 'all' ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 shrink-0">
                  Showing {filteredQuestions.length} of {questions.length} questions
                </div>
              ) : null}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 shrink-0"
                >
                  <AlertCircle className="size-5 text-red-500" />
                  <span className="text-red-400 text-sm">{error}</span>
                  <button onClick={() => setError(null)} className="ml-auto">
                    <X className="w-4 h-4 text-red-400" />
                  </button>
                </motion.div>
              )}

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 pb-4 relative z-0">
                  <SortableContext
                    items={filteredQuestions.map(q => q.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredQuestions.map((question, index) => {
                      const isExpanded = expandedQuestions.has(question.id)
                      return (
                        <SortableQuestionItem
                          key={question.id}
                          question={question}
                          index={index}
                          isExpanded={isExpanded}
                          onToggle={() => toggleQuestion(question.id)}
                          onUpdate={(updatedQuestion) => {
                            const { updateQuestion } = useSurveyStore.getState()
                            updateQuestion(question.id, updatedQuestion)
                          }}
                          onDelete={() => handleDeleteQuestion(question.id)}
                        />
                      )
                    })}
                  </SortableContext>
                  
                  {filteredQuestions.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-gray-600 dark:text-gray-400">
                        No questions match your search criteria
                      </p>
                    </div>
                  )}
                </div>

                {/* Drag Overlay - shows while dragging */}
                <DragOverlay>
                  {activeQuestion ? (
                    <QuestionDragOverlay
                      question={activeQuestion}
                      index={filteredQuestions.findIndex(q => q.id === activeQuestion.id)}
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </div>
        )}
      </main>
      </div>

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowImportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="flat-card p-6 rounded-2xl max-w-md w-full"
            >
              <h3 className="text-xl font-bold text-white mb-4">
                Import Excel File
              </h3>
              <p className="text-sm dark:text-gray-400 text-gray-600 mb-6">
                Select an Excel (.xlsx) file containing parsed questions
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleFileImport(file)
                    setShowImportModal(false)
                  }
                }}
                className="w-full mb-4"
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-sm dark:text-gray-400 text-gray-600 hover:dark:text-white hover:text-black transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Question Modal */}
      <AnimatePresence>
        {showAddQuestionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddQuestionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-card dark:shadow-card-dark max-w-lg w-full border border-border-light dark:border-border-dark"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-border-dark">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Plus className="w-5 h-5 text-green-500" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add New Question</h2>
                </div>
                <button
                  onClick={() => setShowAddQuestionModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {/* Form */}
              <div className="p-6 space-y-4">
                {/* Question ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Question ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newQuestion.id || ''}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, id: e.target.value.toUpperCase() }))}
                    placeholder="e.g., Q1, Q2, H1"
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                  />
                </div>

                {/* Question Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Question Type
                  </label>
                  <select
                    value={newQuestion.type || 'SA'}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, type: e.target.value as ParsedQuestion['type'] }))}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                  >
                    <option value="SA">SA (Single Answer)</option>
                    <option value="MA">MA (Multiple Answer)</option>
                    <option value="SA_Grid">SA Grid</option>
                    <option value="MA_Grid">MA Grid</option>
                    <option value="OE">OE (Open Ended)</option>
                    <option value="Rank_Fixed">Rank Fixed</option>
                    <option value="Rank_Upto">Rank Upto</option>
                    <option value="Numeric">Numeric</option>
                  </select>
                </div>

                {/* Question Label */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Question Label <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newQuestion.label || ''}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="Enter question text..."
                    rows={3}
                    className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white resize-none"
                  />
                </div>

                {/* Options (for SA/MA) */}
                {(newQuestion.type === 'SA' || newQuestion.type === 'MA') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Options (one per line, format: code|label)
                    </label>
                    <textarea
                      placeholder={"1|Option 1\n2|Option 2\n3|Option 3"}
                      rows={4}
                      onChange={(e) => {
                        const lines = e.target.value.split('\n').filter(l => l.trim())
                        const options = lines.map(line => {
                          const [code, ...labelParts] = line.split('|')
                          return {
                            code: parseInt(code) || code,
                            label: labelParts.join('|') || code,
                          }
                        })
                        setNewQuestion(prev => ({ ...prev, options }))
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white resize-none font-mono text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark">
                <button
                  onClick={() => setShowAddQuestionModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddQuestion}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Question</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Syntax Modal */}
      <AnimatePresence>
        {showSyntaxModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSyntaxModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-card dark:shadow-card-dark max-w-5xl w-full max-h-[90vh] flex flex-col border border-border-light dark:border-border-dark"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Code className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">SPSS Clean Label Syntax</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{parsedQuestions.length} questions</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopySyntax}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-surface-light dark:bg-surface-dark hover:bg-surface-light dark:hover:bg-surface-dark text-foreground rounded-lg transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleExportSyntax}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                  </button>
                  <button
                    onClick={() => setShowSyntaxModal(false)}
                    className="p-2 hover:bg-surface-light dark:hover:bg-surface-dark rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Syntax Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#1e1e1e] font-mono text-sm">
                <pre className="text-gray-300 whitespace-pre-wrap">
                  {generatedSyntax || 'No syntax generated'}
                </pre>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MainLayout>
  )
}

