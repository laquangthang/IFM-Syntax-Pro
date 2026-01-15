'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useSurveyStore } from '@/store/surveyStore'
import { parseSurveyPDF, listAvailableModels } from '@/lib/geminiParser'
import MainLayout from '../Layout/MainLayout'
import ThemeToggle from '../ThemeToggle'
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Download, Eye, EyeOff } from 'lucide-react'

export default function DataImport() {
  // Run diagnostic on mount
  useEffect(() => {
    listAvailableModels()
  }, [])
  const router = useRouter()
  const { setParsedQuestions, setLoading, setError, setCurrentStep, isLoading, error, parsedQuestions } = useSurveyStore()
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [showJSON, setShowJSON] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file && file.type === 'application/pdf') {
        await processFile(file)
      } else {
        setError('Please upload a PDF file')
      }
    },
    [setError]
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file && file.type === 'application/pdf') {
        await processFile(file)
      } else {
        setError('Please upload a PDF file')
      }
    },
    [setError]
  )

  // Function to download JSON file
  const downloadJSON = (data: any, filename: string) => {
    const jsonString = JSON.stringify(data, null, 2) // Pretty print with 2 spaces
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    console.log(`✅ JSON exported: ${filename}`)
  }

  // Export JSON from memory (store)
  const exportStoredJSON = () => {
    if (!parsedQuestions || parsedQuestions.length === 0) {
      alert('Không có dữ liệu JSON trong bộ nhớ. Vui lòng parse PDF trước.')
      return
    }
    
    const filename = `parsed_survey_${new Date().toISOString().split('T')[0]}.json`
    downloadJSON({ questions: parsedQuestions }, filename)
    console.log(`📥 Exported ${parsedQuestions.length} questions from memory`)
  }

  const processFile = async (file: File) => {
    setUploadedFile(file)
    setLoading(true)
    setError(null)
    setProgress(0)

    try {
      const questions = await parseSurveyPDF(file, (progressValue) => {
        setProgress(progressValue)
      })
      setParsedQuestions(questions)
      
      // Export JSON to file for inspection
      const pdfName = file.name.replace(/\.pdf$/i, '')
      const jsonFilename = `${pdfName}_parsed_${new Date().toISOString().split('T')[0]}.json`
      downloadJSON({ questions }, jsonFilename)
      
      // Auto-navigate to mapping step
      setCurrentStep('mapping')
      router.push('/refinery')
    } catch (err) {
      console.error('Error processing PDF:', err)
      setError(err instanceof Error ? err.message : 'Failed to parse PDF. Please try again.')
      setProgress(0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <MainLayout>
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-glass-border-dark dark:border-glass-border-light glass-panel z-40 relative bg-background-dark dark:bg-background-light">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 dark:text-gray-400 text-gray-600 text-sm font-medium">
            <span className="text-white">Data Import</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {parsedQuestions && parsedQuestions.length > 0 && (
            <button
              onClick={exportStoredJSON}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 rounded-lg transition-all duration-200 text-sm font-medium"
              title="Export JSON từ bộ nhớ"
            >
              <Download className="w-4 h-4" />
              <span>Export JSON ({parsedQuestions.length} questions)</span>
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 relative flex flex-col overflow-hidden">
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-8">
          {/* Title */}
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-white">Upload Survey PDF</h1>
            <p className="text-white">
              Upload your questionnaire PDF to automatically extract questions, options, and logic
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3"
            >
              <AlertCircle className="size-5 text-red-500" />
              <span className="text-red-400 text-sm">{error}</span>
            </motion.div>
          )}

          {/* Upload Area */}
          <motion.div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-2xl p-12
              transition-all duration-300
              ${
                isDragging
                  ? 'border-primary bg-primary/10 scale-[1.02]'
                  : 'border-glass-border-dark dark:border-glass-border-light'
              }
              ${isLoading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              glass-card
            `}
            whileHover={!isLoading ? { scale: 1.01 } : {}}
          >
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
              id="pdf-upload"
              disabled={isLoading}
            />
            <label htmlFor="pdf-upload" className="flex flex-col items-center gap-6 cursor-pointer">
              {isLoading ? (
                <>
                  {/* Holographic Scanning Effect */}
                  <div className="relative">
                    <motion.div
                      animate={{
                        rotate: 360,
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                      className="size-24 rounded-full border-4 border-primary/30"
                    >
                      <motion.div
                        animate={{
                          rotate: -360,
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                        className="absolute inset-0 rounded-full border-t-4 border-primary"
                      />
                    </motion.div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="size-8 text-primary animate-spin" />
                    </div>
                  </div>
                  <div className="text-center mt-6 w-full">
                    <h3 className="text-lg font-bold text-white mb-2">Processing PDF...</h3>
                    <p className="text-sm dark:text-gray-400 text-gray-600 mb-4">
                      Extracting questions and logic with AI
                    </p>
                    {/* Progress Bar */}
                    <div className="w-full max-w-xs mx-auto">
                      <div className="h-2 bg-glass-bg-dark dark:bg-glass-bg-light rounded-full overflow-hidden border border-glass-border-dark dark:border-glass-border-light">
                        <motion.div
                          className="h-full bg-gradient-to-r from-primary to-primary-light"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.3, ease: 'easeOut' }}
                        />
                      </div>
                      <p className="text-xs dark:text-gray-400 text-gray-600 mt-2 text-center">
                        {Math.round(progress)}%
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="size-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                    <Upload className="size-10 text-primary" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-white mb-2">
                      {uploadedFile ? 'File Ready' : 'Drop PDF here or click to upload'}
                    </h3>
                    {uploadedFile ? (
                      <div className="flex items-center gap-2 text-primary">
                        <FileText className="size-4" />
                        <span className="text-sm">{uploadedFile.name}</span>
                      </div>
                    ) : (
                      <p className="text-sm dark:text-gray-400 text-gray-600">
                        Supported format: PDF (Questionnaire files)
                      </p>
                    )}
                  </div>
                </>
              )}
            </label>
          </motion.div>

          {/* Instructions */}
          {!isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card p-6"
            >
              <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
                What will be extracted:
              </h3>
              <ul className="space-y-2 text-sm dark:text-gray-400 text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Question IDs (Q1, Q2, Q3A, etc.)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Clean question labels (removed notes, scripts, terminate conditions)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Answer options with codes</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Grid/Matrix structures (rows and columns)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Logic conditions (Ask IF, Terminate)</span>
                </li>
              </ul>
            </motion.div>
          )}

          {/* View Parsed JSON */}
          {parsedQuestions && parsedQuestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Parsed JSON Data ({parsedQuestions.length} questions)
                </h3>
                <button
                  onClick={() => setShowJSON(!showJSON)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg transition-all"
                >
                  {showJSON ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      <span>Ẩn JSON</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      <span>Xem JSON</span>
                    </>
                  )}
                </button>
              </div>
              
              {showJSON && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4"
                >
                  <div className="relative bg-[#1e1e1e] dark:bg-[#0d1117] rounded-lg border border-glass-border-dark dark:border-glass-border-light overflow-hidden">
                    <pre className="p-4 overflow-auto max-h-[600px] text-xs font-mono text-gray-300 dark:text-gray-200">
                      <code>{JSON.stringify({ questions: parsedQuestions }, null, 2)}</code>
                    </pre>
                  </div>
                  <p className="text-xs dark:text-gray-500 text-gray-500 mt-2">
                    💡 JSON này được lưu trong bộ nhớ (Zustand store). Refresh page sẽ mất dữ liệu.
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>
      </main>
    </MainLayout>
  )
}

