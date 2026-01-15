'use client'

import { useState } from 'react'
import { Loader2, Upload, CheckCircle2 } from 'lucide-react'

interface CodingOAFormProps {
  mode: 'manual' | 'auto'
  questions?: any[]
  onSyntaxGenerated: (syntax: string) => void
  onError: (error: string) => void
}

export default function CodingOAForm({ mode, questions = [], onSyntaxGenerated, onError }: CodingOAFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    excelFile: null as File | null,
    codelistFile: null as File | null,
    variableName: '',
  })

  const handleFileChange = (field: 'excelFile' | 'codelistFile', file: File | null) => {
    setFormData({ ...formData, [field]: file })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    onError('')

    if (!formData.excelFile || !formData.codelistFile || !formData.variableName) {
      onError('Vui lòng điền đầy đủ thông tin')
      setLoading(false)
      return
    }

    try {
      const submitFormData = new FormData()
      submitFormData.append('excelFile', formData.excelFile)
      submitFormData.append('codelistFile', formData.codelistFile)
      submitFormData.append('variableName', formData.variableName)

      const response = await fetch('/api/processing/coding-oa', {
        method: 'POST',
        body: submitFormData,
      })

      const result = await response.json()
      if (result.success) {
        onSyntaxGenerated(result.syntax)
      } else {
        onError(result.error || 'Failed to generate syntax')
      }
    } catch (err: any) {
      onError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            1. Upload file Excel (Vrid, Response, R1, R2, ...Rn):
          </label>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-glass-border-dark dark:border-glass-border-light rounded-lg cursor-pointer hover:bg-glass-panel transition-colors">
            {formData.excelFile ? (
              <div className="flex flex-col items-center">
                <CheckCircle2 className="size-8 text-green-500 mb-2" />
                <p className="text-sm font-medium">{formData.excelFile.name}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="size-8 text-gray-400 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-400 dark:text-gray-600">Click to upload Excel file</p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">.xlsx, .xls</p>
              </div>
            )}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleFileChange('excelFile', e.target.files?.[0] || null)}
              className="hidden"
              required
            />
          </label>
          <small className="text-xs text-gray-400 dark:text-gray-600 mt-1 block">
            File phải có cột 1: Vrid, cột 2: Response, cột 3+: R1, R2, ...Rn
          </small>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            2. Upload file TXT Codelist (cho Value Labels):
          </label>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-glass-border-dark dark:border-glass-border-light rounded-lg cursor-pointer hover:bg-glass-panel transition-colors">
            {formData.codelistFile ? (
              <div className="flex flex-col items-center">
                <CheckCircle2 className="size-8 text-green-500 mb-2" />
                <p className="text-sm font-medium">{formData.codelistFile.name}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="size-8 text-gray-400 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-400 dark:text-gray-600">Click to upload TXT file</p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">.txt</p>
              </div>
            )}
            <input
              type="file"
              accept=".txt"
              onChange={(e) => handleFileChange('codelistFile', e.target.files?.[0] || null)}
              className="hidden"
              required
            />
          </label>
          <small className="text-xs text-gray-400 dark:text-gray-600 mt-1 block">
            Format: 1"Label 1" hoặc 1 Label 1
          </small>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-white dark:text-black">
          3. Tên biến (VD: Q18D):
        </label>
        <input
          type="text"
          value={formData.variableName}
          onChange={(e) => setFormData({ ...formData, variableName: e.target.value })}
          placeholder="Q18D"
          required
          className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !formData.excelFile || !formData.codelistFile || !formData.variableName}
        className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Processing...
          </>
        ) : (
          'Generate Coding OA Syntax'
        )}
      </button>
    </form>
  )
}
