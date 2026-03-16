'use client'

import { useState, useEffect } from 'react'
import { Loader2, Search } from 'lucide-react'
import { ParsedQuestion } from '@/lib/types'
import QuestionSelectorModal from './QuestionSelectorModal'
import { useSurveyStore } from '@/store/surveyStore'
import { getGridVariablesForRestruct } from '@/lib/processingHelpers'

interface RestructFormProps {
  mode: 'manual' | 'auto'
  questions?: ParsedQuestion[]
  setGlobalSyntax: (syntax: string) => void
  onError: (error: string) => void
}

export default function RestructForm({ mode, questions = [], setGlobalSyntax, onError }: RestructFormProps) {
  const [loading, setLoading] = useState(false)
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const { oldVariableMapping } = useSurveyStore()
  const [modalOpen, setModalOpen] = useState(false)
  
  const [formData, setFormData] = useState({
    variables: '',
    numBrands: '',
    brandNames: '',
    outputVars: '',
    keepVars: '',
    indexVarName: '',
  })

  // Auto mode: extract from selected Grid questions
  useEffect(() => {
    if (mode === 'auto' && selectedQuestions.length > 0) {
      const selected = questions.filter(q => selectedQuestions.includes(q.id))
      const gridQuestions = selected.filter(q => q.type === 'SA_Grid' || q.type === 'MA_Grid')
      
      if (gridQuestions.length > 0) {
        const { variablesByCode, numBrands, brandNames, codes, indexVarName } = getGridVariablesForRestruct(
          gridQuestions,
          oldVariableMapping
        )
        
        // Set form data
        setFormData(prev => ({
          ...prev,
          numBrands: String(numBrands),
          brandNames: brandNames.join('\n'),
          indexVarName: indexVarName,
        }))
      }
    }
  }, [selectedQuestions, mode, questions, oldVariableMapping])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    onError('')

    try {
      let requestBody: any = { ...formData }
      
      // Auto mode: send Grid question data
      if (mode === 'auto' && selectedQuestions.length > 0) {
        const selected = questions.filter(q => selectedQuestions.includes(q.id))
        const gridQuestions = selected.filter(q => q.type === 'SA_Grid' || q.type === 'MA_Grid')
        
        if (gridQuestions.length > 0) {
          const { variablesByCode, numBrands, brandNames, indexVarName: autoIndexVarName } = getGridVariablesForRestruct(
            gridQuestions,
            oldVariableMapping
          )
          
          // Use indexVarName from formData (may have been edited by user)
          // If empty, use the one from getGridVariablesForRestruct as fallback
          const finalIndexVarName = formData.indexVarName.trim() || autoIndexVarName
          
          requestBody = {
            variablesByCode,
            numBrands,
            brandNames, // Keep as array
            indexVarName: finalIndexVarName,
            keepVars: formData.keepVars,
            questionIds: gridQuestions.map(q => q.id),
          }
        }
      }

      const response = await fetch('/api/processing/restruct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()
      if (result.success) {
        setGlobalSyntax(result.syntax)
      } else {
        onError(result.error || 'Failed to generate syntax')
      }
    } catch (err: any) {
      onError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Filter Grid questions
  const availableQuestions = questions.filter(
    q => q.type === 'SA_Grid' || q.type === 'MA_Grid'
  )

  if (mode === 'auto') {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-white font-semibold text-sm mb-2">
            1. Chọn các câu hỏi Grid (có thể chọn nhiều):
          </label>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full px-4 py-3 bg-surface-light dark:bg-surface-dark border-2 border-border-light dark:border-border-dark rounded-lg text-left flex items-center justify-between text-white hover:border-primary/50 transition-all shadow-sm"
          >
            <span className="text-sm font-medium text-white flex items-center gap-2">
              <Search className="size-4 text-gray-400" />
              {selectedQuestions.length > 0 ? (
                selectedQuestions.length === 1 && availableQuestions.find(q => q.id === selectedQuestions[0]) ? (
                  <>[{selectedQuestions[0]}] {availableQuestions.find(q => q.id === selectedQuestions[0])?.label?.substring(0, 40)}{(availableQuestions.find(q => q.id === selectedQuestions[0])?.label?.length || 0) > 40 ? '...' : ''}</>
                ) : (
                  `Đã chọn ${selectedQuestions.length} câu hỏi`
                )
              ) : (
                'Select Question...'
              )}
            </span>
          </button>
          <QuestionSelectorModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            onSelect={(ids) => setSelectedQuestions(Array.isArray(ids) ? ids : ids ? [ids] : [])}
            parsedQuestions={availableQuestions}
            multiSelect={true}
            title="Select Grid Questions (Restruct)"
            initialSelection={selectedQuestions}
          />
        </div>

        {selectedQuestions.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white font-semibold text-sm mb-2">
                2. Số lượng Brand:
              </label>
              <input
                type="number"
                value={formData.numBrands}
                onChange={(e) => setFormData({ ...formData, numBrands: e.target.value })}
                placeholder="Tự động điền"
                readOnly
                className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
              />
            </div>
            <div>
              <label className="block text-white font-semibold text-sm mb-2">
                3. Tên biến INDEX:
              </label>
              <input
                type="text"
                value={formData.indexVarName}
                onChange={(e) => setFormData({ ...formData, indexVarName: e.target.value })}
                placeholder="Tự động điền"
                className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
              />
            </div>
          </div>
        )}

        {selectedQuestions.length > 0 && (
          <div>
            <label className="block text-white font-semibold text-sm mb-2">
              4. Tên các Brand (mỗi tên 1 dòng):
            </label>
            <textarea
              value={formData.brandNames}
              onChange={(e) => setFormData({ ...formData, brandNames: e.target.value })}
              rows={6}
              placeholder={"Vietinbank\nMilitary Bank\nLPBank"}
              className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg font-mono text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
            />
          </div>
        )}

        <div>
          <label className="block text-white font-semibold text-sm mb-2">
            5. Biến KEEP (cách nhau bởi dấu phẩy, tùy chọn):
          </label>
          <input
            type="text"
            value={formData.keepVars}
            onChange={(e) => setFormData({ ...formData, keepVars: e.target.value })}
            placeholder={"Vrid\nQ00"}
            className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
          />
        </div>

        <button
          type="submit"
          disabled={loading || selectedQuestions.length === 0}
          className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Restruct Syntax'
          )}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-white font-semibold text-sm mb-2">
            1. Danh sách biến (mỗi biến 1 dòng):
          </label>
          <textarea
            value={formData.variables}
            onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
            rows={8}
            placeholder={"Q10R1\nQ10R2\nQ10R3"}
            required
            className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg font-mono text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
          />
        </div>
        <div>
          <label className="block text-white font-semibold text-sm mb-2">
            2. Số lượng Brand:
          </label>
          <input
            type="number"
            value={formData.numBrands}
            onChange={(e) => setFormData({ ...formData, numBrands: e.target.value })}
            placeholder="16"
            required
            min="1"
            className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg mb-4 text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
          />
          
          <label className="block text-white font-semibold text-sm mb-2">
            3. Tên các Brand (mỗi tên 1 dòng):
          </label>
          <textarea
            value={formData.brandNames}
            onChange={(e) => setFormData({ ...formData, brandNames: e.target.value })}
            rows={6}
            placeholder={"Vietinbank\nMilitary Bank\nLPBank"}
            required
            className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg font-mono text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-white font-semibold text-sm mb-2">
            4. Tên các biến output (mỗi tên 1 dòng):
          </label>
          <textarea
            value={formData.outputVars}
            onChange={(e) => setFormData({ ...formData, outputVars: e.target.value })}
            rows={4}
            placeholder={"Q1\nQ2\nQ3\nQ4"}
            required
            className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg font-mono text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
          />
        </div>
        <div>
          <label className="block text-white font-semibold text-sm mb-2">
            5. Biến KEEP (cách nhau bởi dấu phẩy):
          </label>
          <input
            type="text"
            value={formData.keepVars}
            onChange={(e) => setFormData({ ...formData, keepVars: e.target.value })}
            placeholder={"Total\nBN1\nBN2"}
            className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Generating...
          </>
        ) : (
          'Generate Restruct Syntax'
        )}
      </button>
    </form>
  )
}
