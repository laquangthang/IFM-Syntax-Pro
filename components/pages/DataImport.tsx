'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useSurveyStore } from '@/store/surveyStore'
import { parseSurveyPDFStructured } from '@/lib/pdfParser'
import MainLayout from '../Layout/MainLayout'
import ThemeToggle from '../ThemeToggle'
import { Upload, FileText, AlertCircle, Loader2, Download, Database, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { parseSPSSExcel, generateSPSSSyntaxFromResult, SPSSParseResult } from '@/lib/spssExcelParser'

type ImportMode = 'pdf' | 'spss'

export default function DataImport() {
  const router = useRouter()
  const { setParsedQuestions, setLoading, setError, setCurrentStep, isLoading, error, parsedQuestions, setOldVariableMapping } = useSurveyStore()
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [phaseInfo, setPhaseInfo] = useState<{ phase: string; details: string } | null>(null)
  
  // Import mode state
  const [importMode, setImportMode] = useState<ImportMode>('pdf')
  
  // SPSS Import state
  const [spssResult, setSpssResult] = useState<SPSSParseResult | null>(null)
  const [spssSyntax, setSpssSyntax] = useState<string>('')

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
      
      if (importMode === 'pdf') {
        if (file && file.type === 'application/pdf') {
          await processFile(file)
        } else {
          setError('Please upload a PDF file')
        }
      } else {
        // SPSS mode - accept Excel files
        const isExcel = file && (
          file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') ||
          file.name.endsWith('.xls')
        )
        if (isExcel) {
          await processSPSSFile(file)
        } else {
          setError('Please upload an Excel file (.xlsx or .xls)')
        }
      }
    },
    [setError, importMode]
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      
      if (importMode === 'pdf') {
        if (file && file.type === 'application/pdf') {
          await processFile(file)
        } else {
          setError('Please upload a PDF file')
        }
      } else {
        // SPSS mode - accept Excel files
        const isExcel = file && (
          file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') ||
          file.name.endsWith('.xls')
        )
        if (isExcel) {
          await processSPSSFile(file)
        } else {
          setError('Please upload an Excel file (.xlsx or .xls)')
        }
      }
    },
    [setError, importMode]
  )

  // Process SPSS Excel file
  const processSPSSFile = async (file: File) => {
    setUploadedFile(file)
    setLoading(true)
    setError(null)
    setProgress(0)
    setPhaseInfo(null)
    setSpssResult(null)
    setSpssSyntax('')

    try {
      setProgress(10)
      setPhaseInfo({ phase: 'Reading', details: 'Loading Excel file...' })

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer()
      
      setProgress(30)
      setPhaseInfo({ phase: 'Parsing', details: 'Extracting SPSS variables...' })
      
      // Parse Excel
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      
      setProgress(50)
      setPhaseInfo({ phase: 'Processing', details: 'Analyzing variable structure...' })
      
      // Parse SPSS variables
      const result = parseSPSSExcel(workbook)
      
      setProgress(70)
      setPhaseInfo({ phase: 'Generating', details: 'Creating SPSS syntax...' })
      
      // Generate syntax
      const syntax = generateSPSSSyntaxFromResult(result)
      
      setProgress(90)
      setPhaseInfo({ phase: 'Finalizing', details: 'Preparing results...' })
      
      // Store results
      setSpssResult(result)
      setSpssSyntax(syntax)
      
      // Set parsed questions and old variable mapping to store
      if (result.questions.length > 0) {
        setParsedQuestions(result.questions)
        // Save old variable mapping so Generate Syntax in Question Manager uses correct variable names
        if (result.oldVariableMapping) {
          setOldVariableMapping(result.oldVariableMapping)
        }
      }
      
      setProgress(100)
      setPhaseInfo({ phase: 'Complete', details: `Extracted ${result.questions.length} questions, ${result.variables.length} variables` })
      
    } catch (err) {
      console.error('Error processing SPSS Excel:', err)
      setError(err instanceof Error ? err.message : 'Failed to process Excel file. Please try again.')
      setProgress(0)
      setPhaseInfo(null)
    } finally {
      setLoading(false)
    }
  }

  // Export SPSS syntax
  const exportSPSSSyntax = () => {
    if (!spssSyntax) {
      alert('No syntax generated. Please import an SPSS Excel file first.')
      return
    }
    
    const blob = new Blob([spssSyntax], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `spss_syntax_${new Date().toISOString().split('T')[0]}.sps`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

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
      }
      
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
          <span className="text-white font-medium">
            {importMode === 'pdf' ? 'PDF Extraction' : 'SPSS Import'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {importMode === 'pdf' && parsedQuestions && parsedQuestions.length > 0 && (
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
          {importMode === 'spss' && spssSyntax && (
            <button
              onClick={exportSPSSSyntax}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 rounded-lg transition-all duration-200 text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              <span>Export SPSS Syntax</span>
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 relative flex flex-col overflow-hidden">
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
          {/* Import Mode Tabs */}
          <div className="flex items-center gap-2 p-1 bg-glass-bg-light dark:bg-glass-bg-dark rounded-lg border border-glass-border-light dark:border-glass-border-dark w-fit">
            <button
              onClick={() => {
                setImportMode('pdf')
                setError(null)
                setUploadedFile(null)
                setProgress(0)
                setPhaseInfo(null)
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 text-sm font-medium ${
                importMode === 'pdf'
                  ? 'bg-primary text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Import PDF</span>
            </button>
            <button
              onClick={() => {
                setImportMode('spss')
                setError(null)
                setUploadedFile(null)
                setProgress(0)
                setPhaseInfo(null)
                setSpssResult(null)
                setSpssSyntax('')
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 text-sm font-medium ${
                importMode === 'spss'
                  ? 'bg-purple-500 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Import SPSS</span>
            </button>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-white">
              {importMode === 'pdf' ? 'Extract from PDF' : 'Import SPSS Variables'}
            </h1>
            <p className="text-gray-400 text-sm">
              {importMode === 'pdf'
                ? 'Upload a questionnaire PDF to extract questions, options, and logic using rule-based extraction'
                : 'Upload an Excel file with 2 columns (variable name, label) to generate SPSS syntax and extract questions'
              }
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
                  ? importMode === 'pdf' 
                    ? 'border-primary bg-primary/10 scale-[1.02]'
                    : 'border-purple-500 bg-purple-500/10 scale-[1.02]'
                  : 'border-glass-border-light dark:border-glass-border-dark'
              }
              ${isLoading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              glass-card
            `}
            whileHover={!isLoading ? { scale: 1.01 } : {}}
          >
            <input
              type="file"
              accept={importMode === 'pdf' ? 'application/pdf' : '.xlsx,.xls'}
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              disabled={isLoading}
            />
            <label htmlFor="file-upload" className="flex flex-col items-center gap-6 cursor-pointer">
              {isLoading ? (
                <>
                  <div className="relative">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className={`size-20 rounded-full border-4 ${importMode === 'pdf' ? 'border-primary/30' : 'border-purple-500/30'}`}
                    >
                      <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className={`absolute inset-0 rounded-full border-t-4 ${importMode === 'pdf' ? 'border-primary' : 'border-purple-500'}`}
                      />
                    </motion.div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className={`size-6 animate-spin ${importMode === 'pdf' ? 'text-primary' : 'text-purple-500'}`} />
                    </div>
                  </div>
                  <div className="text-center w-full">
                    <h3 className="text-lg font-bold text-white mb-2">
                      {importMode === 'pdf' ? 'Extracting from PDF...' : 'Processing SPSS Excel...'}
                    </h3>
                    {phaseInfo && (
                      <p className="text-xs text-gray-400 mb-3">
                        {phaseInfo.phase}: {phaseInfo.details}
                      </p>
                    )}
                    <div className="w-full max-w-xs mx-auto">
                      <div className="h-2 bg-glass-bg-light dark:bg-glass-bg-dark rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full ${importMode === 'pdf' ? 'bg-gradient-to-r from-primary to-primary-light' : 'bg-gradient-to-r from-purple-600 to-purple-400'}`}
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
                  <div className={`size-16 rounded-full border-2 flex items-center justify-center ${
                    importMode === 'pdf' 
                      ? 'bg-primary/10 border-primary/30' 
                      : 'bg-purple-500/10 border-purple-500/30'
                  }`}>
                    {importMode === 'pdf' ? (
                      <Upload className="size-8 text-primary" />
                    ) : (
                      <FileSpreadsheet className="size-8 text-purple-500" />
                    )}
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-white mb-2">
                      {uploadedFile 
                        ? 'File Ready' 
                        : importMode === 'pdf'
                          ? 'Drop PDF here or click to upload'
                          : 'Drop Excel file here or click to upload'
                      }
                    </h3>
                    {uploadedFile ? (
                      <div className={`flex items-center gap-2 text-sm ${importMode === 'pdf' ? 'text-primary' : 'text-purple-400'}`}>
                        {importMode === 'pdf' ? <FileText className="size-4" /> : <FileSpreadsheet className="size-4" />}
                        <span>{uploadedFile.name}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">
                        {importMode === 'pdf' ? 'Supported format: PDF' : 'Supported format: Excel (.xlsx, .xls)'}
                      </p>
                    )}
                  </div>
                </>
              )}
            </label>
          </motion.div>

          {/* PDF Results Summary */}
          {importMode === 'pdf' && parsedQuestions && parsedQuestions.length > 0 && !isLoading && (
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

          {/* SPSS Results Summary */}
          {importMode === 'spss' && spssResult && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4"
            >
              {/* Summary Card */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">
                      SPSS Import Complete
                    </h3>
                    <p className="text-sm text-gray-400">
                      {spssResult.questions.length} questions, {spssResult.variables.length} variables extracted
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportSPSSSyntax}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 rounded-lg transition-all text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Export Syntax (.sps)
                    </button>
                    <button
                      onClick={() => {
                        setCurrentStep('mapping')
                        router.push('/refinery')
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg transition-all text-sm font-medium"
                    >
                      Go to Refinery
                    </button>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-2xl font-bold text-purple-400">{spssResult.syntax.rename.length}</div>
                    <div className="text-xs text-gray-400">Rename Syntax</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-2xl font-bold text-blue-400">{spssResult.syntax.varLab.length}</div>
                    <div className="text-xs text-gray-400">Var Labels</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-2xl font-bold text-green-400">{spssResult.syntax.recode.length}</div>
                    <div className="text-xs text-gray-400">Recode/Val Lab</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-2xl font-bold text-amber-400">{spssResult.questions.length}</div>
                    <div className="text-xs text-gray-400">Questions</div>
                  </div>
                </div>
              </div>

              {/* Syntax Preview */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-white">Generated SPSS Syntax Preview</h4>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(spssSyntax)
                      alert('Syntax copied to clipboard!')
                    }}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Copy to Clipboard
                  </button>
                </div>
                <div className="bg-black/30 rounded-lg p-4 max-h-80 overflow-auto">
                  <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                    {spssSyntax.substring(0, 3000)}
                    {spssSyntax.length > 3000 && (
                      <span className="text-gray-500">
                        {'\n\n... and {0} more characters'.replace('{0}', String(spssSyntax.length - 3000))}
                      </span>
                    )}
                  </pre>
                </div>
              </div>

              {/* Questions Preview */}
              {spssResult.questions.length > 0 && (
                <div className="glass-card p-6">
                  <h4 className="text-sm font-medium text-white mb-3">Extracted Questions</h4>
                  <div className="space-y-2 max-h-60 overflow-auto">
                    {spssResult.questions.slice(0, 20).map((q, idx) => (
                      <div 
                        key={q.id} 
                        className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/10"
                      >
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-mono rounded">
                          {q.id}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          q.type === 'SA' ? 'bg-blue-500/20 text-blue-400' :
                          q.type === 'MA' ? 'bg-green-500/20 text-green-400' :
                          q.type.includes('Grid') ? 'bg-amber-500/20 text-amber-400' :
                          q.type.includes('Rank') ? 'bg-pink-500/20 text-pink-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {q.type}
                        </span>
                        <span className="text-gray-300 text-sm truncate flex-1">
                          {q.label || q.id}
                        </span>
                        {q.options && (
                          <span className="text-xs text-gray-500">
                            {q.options.length} options
                          </span>
                        )}
                      </div>
                    ))}
                    {spssResult.questions.length > 20 && (
                      <div className="text-center text-xs text-gray-500 py-2">
                        ... and {spssResult.questions.length - 20} more questions
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>
    </MainLayout>
  )
}
