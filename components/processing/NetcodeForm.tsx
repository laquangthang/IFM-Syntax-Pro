'use client'

import { useState, useEffect } from 'react'
import { Loader2, Search } from 'lucide-react'
import { ParsedQuestion } from '@/lib/types'
import QuestionSelectorModal from './QuestionSelectorModal'

interface NetcodeFormProps {
  mode: 'manual' | 'auto'
  questions?: ParsedQuestion[]
  setGlobalSyntax: (syntax: string) => void
  onError: (error: string) => void
}

export default function NetcodeForm({ mode, questions = [], setGlobalSyntax, onError }: NetcodeFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    questionName: '',
    codes: '',
    labels: '',
  })

  const [selectedQuestion, setSelectedQuestion] = useState<string>('')
  const [modalOpen, setModalOpen] = useState(false)

  // Auto-populate from selected question
  useEffect(() => {
    if (mode === 'auto' && selectedQuestion) {
      const question = questions.find(q => q.id === selectedQuestion)
      if (question && question.options) {
        const codes = question.options.map(opt => String(opt.code)).join('\n')
        const labels = question.options.map(opt => opt.label).join('\n')
        setFormData({
          questionName: question.id,
          codes,
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
      const response = await fetch('/api/processing/netcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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

  // Filter questions that have options (MA, SA questions)
  const availableQuestions = questions.filter(q => 
    q.options && q.options.length > 0 && (q.type === 'MA' || q.type === 'SA')
  )

  if (mode === 'auto') {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-white font-semibold text-sm mb-2">
            1. Chọn câu hỏi:
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
            title="Select Question (NET Code - MA/SA)"
            initialSelection={selectedQuestion || undefined}
          />
        </div>

        {selectedQuestion && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-semibold text-sm mb-2">
                  2. Danh sách Code (tự động điền):
                </label>
                <textarea
                  value={formData.codes}
                  onChange={(e) => setFormData({ ...formData, codes: e.target.value })}
                  rows={10}
                  placeholder={"30\n1\n2\n3"}
                  required
                  className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg font-mono text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
                />
              </div>
              <div>
                <label className="block text-white font-semibold text-sm mb-2">
                  3. Danh sách Nhãn (tự động điền, thêm [NET] cho codes cần net):
                </label>
                <textarea
                  value={formData.labels}
                  onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
                  rows={10}
                  placeholder={"Product & Solutions Quality [NET]\nThis company's paint has excellent color retention"}
                  required
                  className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg font-mono text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
                />
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                  💡 Thêm [NET] vào cuối label để đánh dấu NET code
                </p>
              </div>
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
            'Generate NET Code Syntax'
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
          1. Tên câu hỏi (VD: Q11):
        </label>
        <input
          type="text"
          value={formData.questionName}
          onChange={(e) => setFormData({ ...formData, questionName: e.target.value })}
          placeholder="Q11"
          required
          className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-white font-semibold text-sm mb-2">
            2. Danh sách Code (mỗi code 1 dòng):
          </label>
          <textarea
            value={formData.codes}
            onChange={(e) => setFormData({ ...formData, codes: e.target.value })}
            rows={10}
            placeholder={"30\n1\n2\n3\n..."}
            required
            className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg font-mono text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
          />
        </div>
        <div>
          <label className="block text-white font-semibold text-sm mb-2">
            3. Danh sách Nhãn (mỗi nhãn 1 dòng, thêm [NET] cho codes cần net):
          </label>
          <textarea
            value={formData.labels}
            onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
            rows={10}
            placeholder={"Product & Solutions Quality [NET]\nThis company's paint has excellent color retention"}
            required
            className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg font-mono text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
          />
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
            💡 Thêm [NET] vào cuối label để đánh dấu NET code
          </p>
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
          'Generate NET Code Syntax'
        )}
      </button>
    </form>
  )
}
