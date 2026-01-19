'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useSurveyStore } from '@/store/surveyStore'
import { parseSurveyPDFStructured } from '@/lib/pdfParser'
import MainLayout from '../Layout/MainLayout'
import ThemeToggle from '../ThemeToggle'
import { Upload, FileText, AlertCircle, Loader2, Download } from 'lucide-react'

export default function DataImport() {
  const router = useRouter()
  const { setParsedQuestions, setLoading, setError, setCurrentStep, isLoading, error, parsedQuestions } = useSurveyStore()
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [phaseInfo, setPhaseInfo] = useState<{ phase: string; details: string } | null>(null)

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

  const [workbookBase64, setWorkbookBase64] = useState<string | null>(null)
  const [workbookFileName, setWorkbookFileName] = useState<string | null>(null)

  // Export JSON from memory
  const exportJSON = () => {
    if (!parsedQuestions || parsedQuestions.length === 0) {
      alert('No data to export. Please extract PDF first.')
      return
    }
    
    const jsonString = JSON.stringify({ questions: parsedQuestions }, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `parsed_survey_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Export Excel (XLSX) from ConvertAPI result
  const exportExcel = () => {
    if (!workbookBase64 || !workbookFileName) {
      alert('No Excel data available. Please extract PDF first.')
      return
    }
    
    try {
      // Convert base64 to blob
      const binaryString = atob(workbookBase64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      
      // Download
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = workbookFileName || `extracted_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
    } catch (error) {
      console.error('❌ Error exporting Excel:', error)
      alert('Failed to export Excel file')
    }
  }

  const processFile = async (file: File) => {
    setUploadedFile(file)
    setLoading(true)
    setError(null)
    setProgress(0)
    setPhaseInfo(null)
    
    const onProgress = (progressValue: number, phase?: string, details?: string) => {
      setProgress(progressValue)
      if (phase && details) {
        setPhaseInfo({ phase, details })
      }
    }

    try {
      setParsedQuestions([])
      setWorkbookBase64(null)
      setWorkbookFileName(null)
      
      // Call API directly to get workbook data
      const formData = new FormData()
      formData.append('file', file)
      
      onProgress(10, 'Uploading', 'Sending PDF to server...')
      
      const response = await fetch('/api/parse-survey-structured', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const msg =
          errorData.details ||
          errorData.error ||
          `Failed to extract PDF: ${response.statusText}`
        throw new Error(msg)
      }
      
      onProgress(90, 'Processing', 'Finalizing results...')
      
      const data = await response.json()
      
      if (!data.success || !Array.isArray(data.questions)) {
        throw new Error('Invalid response format from extraction API')
      }
      
      // Store questions
      setParsedQuestions(data.questions)
      
      // Store workbook data for Excel export
      if (data.workbookBase64 && data.workbookFileName) {
        setWorkbookBase64(data.workbookBase64)
        setWorkbookFileName(data.workbookFileName)
      
      onProgress(100, 'Complete', `Extracted ${data.questions.length} questions`)
      
      // Auto-navigate to next step
      setCurrentStep('mapping')
      router.push('/refinery')
    } catch (err) {
      console.error('Error processing PDF:', err)
      setError(err instanceof Error ? err.message : 'Failed to extract PDF. Please try again.')
      setProgress(0)
      setPhaseInfo(null)
    } finally {
      setLoading(false)
      setPhaseInfo(null)
    }
  }

  return (
    <MainLayout>
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-glass-border-light dark:border-glass-border-dark glass-panel z-40 relative bg-background-light dark:bg-background-dark">
        <div className="flex items-center gap-6">
          <span className="text-white font-medium">PDF Extraction</span>
        </div>
        <div className="flex items-center gap-4">
          {parsedQuestions && parsedQuestions.length > 0 && (
            <>
              <button
                onClick={exportJSON}
                className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg transition-all duration-200 text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                <span>Export JSON ({parsedQuestions.length})</span>
              </button>
              <button
                onClick={exportExcel}
                disabled={!workbookBase64}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all duration-200 text-sm font-medium ${
                  workbookBase64
                    ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/30 cursor-pointer active:scale-95'
                    : 'bg-gray-600/30 text-gray-400 border-gray-600/40 cursor-not-allowed hover:bg-gray-600/40'
                }`}
                title={workbookBase64 ? 'Export Excel file from ConvertAPI' : 'Excel export not available (no workbook data from ConvertAPI)'}
              >
                <FileText className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
            </>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 relative flex flex-col overflow-hidden">
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
          {/* Title */}
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-white">Extract from PDF</h1>
            <p className="text-gray-400 text-sm">
              Upload a questionnaire PDF to extract questions, options, and logic using rule-based extraction
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
              relative border-2 border-dashed rounded-xl p-12
              transition-all duration-300
              ${
                isDragging
                  ? 'border-primary bg-primary/10 scale-[1.02]'
                  : 'border-glass-border-light dark:border-glass-border-dark'
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
                  <div className="relative">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="size-20 rounded-full border-4 border-primary/30"
                    >
                      <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="absolute inset-0 rounded-full border-t-4 border-primary"
                      />
                    </motion.div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="size-6 text-primary animate-spin" />
                    </div>
                  </div>
                  <div className="text-center w-full">
                    <h3 className="text-lg font-bold text-white mb-2">Extracting from PDF...</h3>
                    {phaseInfo && (
                      <p className="text-xs text-gray-400 mb-3">
                        {phaseInfo.phase}: {phaseInfo.details}
                      </p>
                    )}
                    <div className="w-full max-w-xs mx-auto">
                      <div className="h-2 bg-glass-bg-light dark:bg-glass-bg-dark rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-primary to-primary-light"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2 text-center">{Math.round(progress)}%</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="size-16 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                    <Upload className="size-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-white mb-2">
                      {uploadedFile ? 'File Ready' : 'Drop PDF here or click to upload'}
                    </h3>
                    {uploadedFile ? (
                      <div className="flex items-center gap-2 text-primary text-sm">
                        <FileText className="size-4" />
                        <span>{uploadedFile.name}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">Supported format: PDF</p>
                    )}
                  </div>
                </>
              )}
            </label>
          </motion.div>

          {/* Results Summary */}
          {parsedQuestions && parsedQuestions.length > 0 && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    Extraction Complete
                  </h3>
                  <p className="text-sm text-gray-400">
                    {parsedQuestions.length} questions extracted successfully
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportJSON}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg transition-all text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Export JSON
                  </button>
                  <button
                    onClick={exportExcel}
                    disabled={!workbookBase64}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all text-sm font-medium ${
                      workbookBase64
                        ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/30 cursor-pointer active:scale-95'
                        : 'bg-gray-600/30 text-gray-400 border-gray-600/40 cursor-not-allowed hover:bg-gray-600/40'
                    }`}
                    title={workbookBase64 ? 'Export Excel file from ConvertAPI' : 'Excel export not available (no workbook data from ConvertAPI)'}
                  >
                    <FileText className="w-4 h-4" />
                    Export Excel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </MainLayout>
  )
}
