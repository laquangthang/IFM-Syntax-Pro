'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSurveyStore } from '@/store/surveyStore'
import { loadJSONFromFile } from '@/lib/jsonLoader'
import { ParsedQuestion } from '@/lib/geminiParser'
import MainLayout from '@/components/Layout/MainLayout'
import { 
  Upload, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  Download,
  Plus,
  Copy,
  Code,
  Check
} from 'lucide-react'
import QuestionCard from '@/components/questions/QuestionCard'
import { generateCompleteSyntax } from '@/lib/syntaxGenerator'

export default function QuestionManager() {
  const { 
    parsedQuestions, 
    questionsMap, 
    setParsedQuestions,
    oldVariableMapping,
    setQuestionOldVariables,
    isLoading,
    setLoading,
    setError,
    error
  } = useSurveyStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showSyntaxModal, setShowSyntaxModal] = useState(false)
  const [generatedSyntax, setGeneratedSyntax] = useState<string>('')
  const [copied, setCopied] = useState(false)

  // Load questions from map - preserve original order from JSON file
  const questions = useMemo(() => {
    // Map maintains insertion order, so we preserve the original order from JSON
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

  // Debug: Log when expandedQuestions changes
  useEffect(() => {
    console.log('🔄 [QuestionManager] expandedQuestions state changed:', Array.from(expandedQuestions))
    console.log('📊 [QuestionManager] Total expanded questions:', expandedQuestions.size)
  }, [expandedQuestions])

  // Toggle question expansion
  const toggleQuestion = (id: string) => {
    console.log('🔄 [QuestionManager] toggleQuestion called:', id)
    console.log('📊 [QuestionManager] Current expandedQuestions:', Array.from(expandedQuestions))
    
    setExpandedQuestions((prev) => {
      const newExpanded = new Set(prev)
      const wasExpanded = newExpanded.has(id)
      
      if (wasExpanded) {
        newExpanded.delete(id)
        console.log('⬇️ [QuestionManager] Collapsing question:', id)
      } else {
        newExpanded.add(id)
        console.log('⬆️ [QuestionManager] Expanding question:', id)
      }
      
      console.log('📊 [QuestionManager] New expandedQuestions:', Array.from(newExpanded))
      return newExpanded
    })
  }

  // Handle JSON file import
  const handleFileImport = async (file: File) => {
    try {
      setLoading(true)
      setError(null)
      
      const json = await loadJSONFromFile(file)
      console.log('📥 Loaded JSON:', json)
      console.log('📊 Questions count:', json.questions.length)
      if (json.questions.length > 0) {
        console.log('🔍 First question sample:', json.questions[0])
        console.log('📋 First question options:', json.questions[0].options)
      }
      
      setParsedQuestions(json.questions)
      
      // Auto-expand first question
      if (json.questions.length > 0) {
        setExpandedQuestions(new Set([json.questions[0].id]))
        setSelectedQuestion(json.questions[0].id)
      }
    } catch (err) {
      console.error('❌ Error loading JSON:', err)
      setError(err instanceof Error ? err.message : 'Failed to load JSON file')
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

  return (
    <MainLayout>
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-glass-border-light dark:border-glass-border-dark glass-panel z-40 relative bg-background-light dark:bg-background-dark">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 dark:text-gray-400 text-gray-600 text-sm font-medium">
            <FileText className="w-5 h-5 text-white" />
            <span className="text-white font-semibold">Question Manager</span>
            {questions.length > 0 && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                {questions.length} questions
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {questions.length > 0 && (
            <>
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
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-all text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            <span>Import JSON</span>
          </button>
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
                Import a JSON file to start managing questions
              </p>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg transition-all mx-auto"
              >
                <Upload className="w-5 h-5" />
                <span>Import JSON File</span>
              </button>
            </motion.div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 p-8">
            <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full h-full min-h-0">
              {/* Search and Filter Bar */}
              <div className="flex gap-4 items-center shrink-0">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search questions by ID, label, or instruction..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-surface-dark-lighter border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                </div>
                
                {/* Type Filter */}
                <div className="relative">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="appearance-none pl-4 pr-10 py-2.5 bg-white dark:bg-surface-dark-lighter border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white cursor-pointer"
                  >
                    <option value="all">All Types</option>
                    {questionTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Results Count */}
              {searchQuery || filterType !== 'all' ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 shrink-0">
                  Showing {filteredQuestions.length} of {questions.length} questions
                </div>
              ) : null}

              {/* Error Display */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 shrink-0"
                >
                  <AlertCircle className="size-5 text-red-500" />
                  <span className="text-red-400 text-sm">{error}</span>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto"
                  >
                    <X className="w-4 h-4 text-red-400" />
                  </button>
                </motion.div>
              )}

              {/* Questions List - Scrollable */}
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 pb-4 relative z-0">
                <AnimatePresence mode="popLayout">
                  {filteredQuestions.map((question, index) => {
                    const isExpanded = expandedQuestions.has(question.id)
                    // Only log MA questions to reduce noise
                    if (question.type === 'MA') {
                      console.log(`📋 [QuestionManager] Rendering QuestionCard - ID: ${question.id}, Type: ${question.type}, isExpanded: ${isExpanded}`)
                    }
                    return (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        isExpanded={isExpanded}
                        onToggle={() => {
                          console.log(`🔘 [QuestionManager] onToggle callback triggered for: ${question.id}`)
                          toggleQuestion(question.id)
                        }}
                        index={index}
                        onUpdate={(updatedQuestion) => {
                          const { updateQuestion } = useSurveyStore.getState()
                          updateQuestion(question.id, updatedQuestion)
                        }}
                      />
                    )
                  })}
                </AnimatePresence>
                
                {filteredQuestions.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-600 dark:text-gray-400">
                      No questions match your search criteria
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

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
              className="glass-card p-6 rounded-2xl max-w-md w-full"
            >
              <h3 className="text-xl font-bold text-white mb-4">
                Import JSON File
              </h3>
              <p className="text-sm dark:text-gray-400 text-gray-600 mb-6">
                Select a JSON file containing parsed questions
              </p>
              <input
                type="file"
                accept=".json"
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
              className="bg-white dark:bg-surface-dark-lighter rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark">
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
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
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
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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

