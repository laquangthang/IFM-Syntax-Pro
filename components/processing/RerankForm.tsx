'use client'

import { useState, useEffect } from 'react'
import { Loader2, Search } from 'lucide-react'
import { ParsedQuestion } from '@/lib/types'
import QuestionSelectorModal from './QuestionSelectorModal'

interface RerankFormProps {
  mode: 'manual' | 'auto'
  questions?: ParsedQuestion[]
  setGlobalSyntax: (syntax: string) => void
  onError: (error: string) => void
}

export default function RerankForm({ mode, questions = [], setGlobalSyntax, onError }: RerankFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    baseVar: '',
    numRanks: '',
    labels: '',
  })

  const [selectedQuestion, setSelectedQuestion] = useState<string>('')
  const [modalOpen, setModalOpen] = useState(false)

  // Auto-populate from selected question
  useEffect(() => {
    if (mode === 'auto' && selectedQuestion) {
      const question = questions.find(q => q.id === selectedQuestion)
      if (question) {
        const labels = question.options?.map(opt => opt.label).join('\n') || ''
        setFormData({
          baseVar: question.id,
          numRanks: question.limit ? String(question.limit) : '',
          labels,
        })
      }
    }
  }, [selectedQuestion, mode, questions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    onError('')

    try {
      const response = await fetch('/api/processing/rerank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseVar: formData.baseVar,
          numRanks: parseInt(formData.numRanks),
          labels: formData.labels,
        }),
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

  // Filter questions that are Rank type
  const availableQuestions = questions.filter(q => 
    q.type === 'Rank_Fixed' || q.type === 'Rank_Upto'
  )

  if (mode === 'auto') {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-white font-semibold text-sm mb-2">
            1. Chọn câu hỏi Rank:
          </label>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full px-4 py-3 bg-surface-light dark:bg-surface-dark border-2 border-border-light dark:border-border-dark rounded-lg text-left flex items-center justify-between text-white hover:border-primary/50 transition-all shadow-sm"
          >
            <span className="text-sm font-medium text-white flex items-center gap-2">
              <Search className="size-4 text-gray-400" />
              {selectedQuestion && availableQuestions.find(q => q.id === selectedQuestion) ? (
                <>[{availableQuestions.find(q => q.id === selectedQuestion)?.id}] {availableQuestions.find(q => q.id === selectedQuestion)?.label?.substring(0, 40)}{(availableQuestions.find(q => q.id === selectedQuestion)?.label?.length || 0) > 40 ? '...' : ''}</>
              ) : (
                'Select Question...'
              )}
            </span>
          </button>
          <QuestionSelectorModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            onSelect={(id) => setSelectedQuestion(typeof id === 'string' ? id : Array.isArray(id) ? id[0] || '' : '')}
            parsedQuestions={availableQuestions}
            multiSelect={false}
            title="Select Question (Rerank)"
            initialSelection={selectedQuestion || undefined}
          />
        </div>

        {selectedQuestion && (
          <>
            <div>
              <label className="block text-white font-semibold text-sm mb-2">
                2. Số lượng Rank (tự động điền):
              </label>
              <input
                type="number"
                value={formData.numRanks}
                onChange={(e) => setFormData({ ...formData, numRanks: e.target.value })}
                placeholder="3"
                required
                min="1"
                className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
              />
            </div>

            <div>
              <label className="block text-white font-semibold text-sm mb-2">
                3. Danh sách nhãn (tự động điền, mỗi nhãn 1 dòng):
              </label>
              <textarea
                value={formData.labels}
                onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
                rows={10}
                placeholder={"Label 1\nLabel 2\nLabel 3"}
                required
                className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg font-mono text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading || !selectedQuestion}
          className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Rerank Syntax'
          )}
        </button>
      </form>
    )
  }

  // Manual mode
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-white font-semibold text-sm mb-2">
          1. Tên biến gốc:
        </label>
        <input
          type="text"
          value={formData.baseVar}
          onChange={(e) => setFormData({ ...formData, baseVar: e.target.value })}
          placeholder="Q17A"
          required
          className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
        />
      </div>

      <div>
        <label className="block text-white font-semibold text-sm mb-2">
          2. Số lượng Rank:
        </label>
        <input
          type="number"
          value={formData.numRanks}
          onChange={(e) => setFormData({ ...formData, numRanks: e.target.value })}
          placeholder="3"
          required
          min="1"
          className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
        />
      </div>

      <div>
        <label className="block text-white font-semibold text-sm mb-2">
          3. Danh sách nhãn (mỗi nhãn 1 dòng):
        </label>
        <textarea
          value={formData.labels}
          onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
          rows={10}
          placeholder={"Label 1\nLabel 2\nLabel 3"}
          required
          className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg font-mono text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
        />
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
          'Generate Rerank Syntax'
        )}
      </button>
    </form>
  )
}
