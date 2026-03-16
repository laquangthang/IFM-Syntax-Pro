'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useSurveyStore } from '@/store/surveyStore'
import MainLayout from '../Layout/MainLayout'
import { Upload, AlertCircle, Loader2, Download, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { parseSPSSExcel, type SPSSParseResult } from '@/lib/parsers/excelParser'
import { generateCompleteSyntax } from '@/lib/syntaxGenerator'
import ThemeToggle from '../ThemeToggle'

export default function DataImport() {
  const router = useRouter()
  const { setParsedQuestions, setLoading, setError, setCurrentStep, isLoading, error, setOldVariableMapping } = useSurveyStore()
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [phaseInfo, setPhaseInfo] = useState<{ phase: string; details: string } | null>(null)
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
    },
    [setError]
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
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
    },
    [setError]
  )

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
      const arrayBuffer = await file.arrayBuffer()
      setProgress(30)
      setPhaseInfo({ phase: 'Parsing', details: 'Extracting SPSS variables...' })
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      setProgress(50)
      setPhaseInfo({ phase: 'Processing', details: 'Analyzing variable structure...' })
      const result = parseSPSSExcel(workbook)
      setProgress(70)
      setPhaseInfo({ phase: 'Generating', details: 'Creating SPSS syntax...' })
      const syntax = generateCompleteSyntax(result.questions, result.oldVariableMapping)
      setProgress(90)
      setPhaseInfo({ phase: 'Finalizing', details: 'Preparing results...' })
      setSpssResult(result)
      setSpssSyntax(syntax)
      if (result.questions.length > 0) {
        setParsedQuestions(result.questions)
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

  return (
    <MainLayout>
      <header className="h-16 flex items-center justify-between px-8 border-b border-border-light dark:border-border-dark flat-panel z-40 relative bg-background-light dark:bg-background-dark">
        <span className="text-white font-medium">SPSS Import</span>
        <div className="flex items-center gap-4">
          {spssSyntax && (
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

      <main className="flex-1 p-8 relative flex flex-col overflow-hidden">
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-white">Import SPSS Variables</h1>
            <p className="text-gray-400 text-sm">
              Upload an Excel file with 2 columns (variable name, label) to generate SPSS syntax and extract questions
            </p>
          </div>

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

          <motion.div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-xl p-12 transition-all duration-300
              ${isDragging ? 'border-purple-500 bg-purple-500/10 scale-[1.02]' : 'border-glass-border-light dark:border-glass-border-dark'}
              ${isLoading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              flat-card
            `}
            whileHover={!isLoading ? { scale: 1.01 } : {}}
          >
            <input
              type="file"
              accept=".xlsx,.xls"
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
                      className="size-20 rounded-full border-4 border-purple-500/30"
                    >
                      <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="absolute inset-0 rounded-full border-t-4 border-purple-500"
                      />
                    </motion.div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="size-6 animate-spin text-purple-500" />
                    </div>
                  </div>
                  <div className="text-center w-full">
                    <h3 className="text-lg font-bold text-white mb-2">Processing SPSS Excel...</h3>
                    {phaseInfo && (
                      <p className="text-xs text-gray-400 mb-3">{phaseInfo.phase}: {phaseInfo.details}</p>
                    )}
                    <div className="w-full max-w-xs mx-auto">
                      <div className="h-2 bg-glass-bg-light dark:bg-glass-bg-dark rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-purple-600 to-purple-400"
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
                  <div className="size-16 rounded-full border-2 flex items-center justify-center bg-purple-500/10 border-purple-500/30">
                    <FileSpreadsheet className="size-8 text-purple-500" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-white mb-2">
                      {uploadedFile ? 'File Ready' : 'Drop Excel file here or click to upload'}
                    </h3>
                    {uploadedFile ? (
                      <div className="flex items-center gap-2 text-sm text-purple-400">
                        <FileSpreadsheet className="size-4" />
                        <span>{uploadedFile.name}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">Supported format: Excel (.xlsx, .xls)</p>
                    )}
                  </div>
                </>
              )}
            </label>
          </motion.div>

          {spssResult && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4"
            >
              <div className="flat-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">SPSS Import Complete</h3>
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
                        router.push('/questions')
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg transition-all text-sm font-medium"
                    >
                      Go to Questions
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-2xl font-bold text-purple-400">{spssResult.questions.length}</div>
                    <div className="text-xs text-gray-400">Questions</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-2xl font-bold text-blue-400">{spssResult.variables.length}</div>
                    <div className="text-xs text-gray-400">Variables</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-2xl font-bold text-green-400">{Object.keys(spssResult.oldVariableMapping).length}</div>
                    <div className="text-xs text-gray-400">Mapped Questions</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-2xl font-bold text-amber-400">{spssSyntax.split('\n').filter(l => l.trim()).length}</div>
                    <div className="text-xs text-gray-400">Syntax Lines</div>
                  </div>
                </div>
              </div>

              <div className="flat-card p-6">
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

              {spssResult.questions.length > 0 && (
                <div className="flat-card p-6">
                  <h4 className="text-sm font-medium text-white mb-3">Extracted Questions</h4>
                  <div className="space-y-2 max-h-60 overflow-auto">
                    {spssResult.questions.slice(0, 20).map((q) => (
                      <div key={q.id} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/10">
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-mono rounded">{q.id}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          q.type === 'SA' ? 'bg-blue-500/20 text-blue-400' :
                          q.type === 'MA' ? 'bg-green-500/20 text-green-400' :
                          q.type.includes('Grid') ? 'bg-amber-500/20 text-amber-400' :
                          q.type.includes('Rank') ? 'bg-pink-500/20 text-pink-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>{q.type}</span>
                        <span className="text-gray-300 text-sm truncate flex-1">{q.label || q.id}</span>
                        {q.options && <span className="text-xs text-gray-500">{q.options.length} options</span>}
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
