'use client'

import { useState, useEffect } from 'react'
import { Loader2, Search } from 'lucide-react'
import { ParsedQuestion } from '@/lib/types'
import QuestionSelectorModal from './QuestionSelectorModal'

interface ReloopFormProps {
  mode: 'manual' | 'auto'
  questions?: ParsedQuestion[]
  setGlobalSyntax: (syntax: string) => void
  onError: (error: string) => void
}

export default function ReloopForm({ mode, questions = [], setGlobalSyntax, onError }: ReloopFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    questionName: '',
    numAttributes: '',
    numBrands: '',
    rebaseQuestion: '',
    brandNames: '',
    attributeTexts: '',
  })

  const [selectedQuestion, setSelectedQuestion] = useState<string>('')
  const [selectedRebaseQuestion, setSelectedRebaseQuestion] = useState<string>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [rebaseModalOpen, setRebaseModalOpen] = useState(false)

  // Auto-populate from selected question
  useEffect(() => {
    if (mode === 'auto' && selectedQuestion) {
      const question = questions.find(q => q.id === selectedQuestion)
      if (question) {
        // For MA_Grid or SA_Grid
        const numAttributes = question.rows?.length || 0
        const numBrands = question.columns?.length || 0
        const attributeTexts = question.rows?.map(r => r.label).join('\n') || ''
        const brandNames = question.columns?.map(c => c.label).join('\n') || ''
        
        setFormData(prev => ({
          ...prev,
          questionName: question.id,
          numAttributes: String(numAttributes),
          numBrands: String(numBrands),
          attributeTexts,
          brandNames,
        }))
      }
    }
  }, [selectedQuestion, mode, questions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    onError('')

    try {
      const response = await fetch('/api/processing/reloop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionName: formData.questionName,
          numAttributes: parseInt(formData.numAttributes),
          numBrands: parseInt(formData.numBrands),
          rebaseQuestion: formData.rebaseQuestion || selectedRebaseQuestion,
          brandNames: formData.brandNames,
          attributeTexts: formData.attributeTexts,
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

  // Filter questions that are Grid type
  const availableQuestions = questions.filter(q => 
    q.type === 'MA_Grid' || q.type === 'SA_Grid'
  )

  if (mode === 'auto') {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-white font-semibold text-sm mb-2">
              1. Chọn câu hỏi Grid:
            </label>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="w-full px-4 py-3 bg-surface-light dark:bg-surface-dark border-2 border-border-light dark:border-border-dark rounded-lg text-left flex items-center justify-between text-white hover:border-primary/50 transition-all shadow-sm"
            >
              <span className="text-sm font-medium text-white flex items-center gap-2">
                <Search className="size-4 text-gray-400" />
                {selectedQuestion && availableQuestions.find(q => q.id === selectedQuestion) ? (
                  <>[{availableQuestions.find(q => q.id === selectedQuestion)?.id}] {availableQuestions.find(q => q.id === selectedQuestion)?.label?.substring(0, 35)}{(availableQuestions.find(q => q.id === selectedQuestion)?.label?.length || 0) > 35 ? '...' : ''}</>
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
              title="Select Grid Question (Reloop)"
              initialSelection={selectedQuestion || undefined}
            />
          </div>
          <div>
            <label className="block text-white font-semibold text-sm mb-2">
              2. Tên câu hỏi Rebase:
            </label>
            <button
              type="button"
              onClick={() => setRebaseModalOpen(true)}
              className="w-full px-4 py-3 bg-surface-light dark:bg-surface-dark border-2 border-border-light dark:border-border-dark rounded-lg text-left flex items-center justify-between text-white hover:border-primary/50 transition-all shadow-sm"
            >
              <span className="text-sm font-medium text-white flex items-center gap-2">
                <Search className="size-4 text-gray-400" />
                {selectedRebaseQuestion && questions.find(q => q.id === selectedRebaseQuestion) ? (
                  <>[{questions.find(q => q.id === selectedRebaseQuestion)?.id}] {questions.find(q => q.id === selectedRebaseQuestion)?.label?.substring(0, 35)}{(questions.find(q => q.id === selectedRebaseQuestion)?.label?.length || 0) > 35 ? '...' : ''}</>
                ) : (
                  'Select Question...'
                )}
              </span>
            </button>
            <QuestionSelectorModal
              isOpen={rebaseModalOpen}
              onClose={() => setRebaseModalOpen(false)}
              onSelect={(id) => {
                const qId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] || '' : ''
                setSelectedRebaseQuestion(qId)
                setFormData(prev => ({ ...prev, rebaseQuestion: qId }))
              }}
              parsedQuestions={questions}
              multiSelect={false}
              title="Select Rebase Question (Reloop)"
              initialSelection={selectedRebaseQuestion || undefined}
            />
            <input
              type="text"
              value={formData.rebaseQuestion || selectedRebaseQuestion}
              onChange={(e) => {
                setSelectedRebaseQuestion(e.target.value)
                setFormData({ ...formData, rebaseQuestion: e.target.value })
              }}
              placeholder="Hoặc nhập tên câu hỏi"
              className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light mt-2"
            />
          </div>
        </div>

        {selectedQuestion && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-semibold text-sm mb-2">
                  3. Số lượng thuộc tính (Attributes) - Tự động điền:
                </label>
                <input
                  type="number"
                  value={formData.numAttributes}
                  onChange={(e) => setFormData({ ...formData, numAttributes: e.target.value })}
                  placeholder="15"
                  required
                  min="1"
                  className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
                />
              </div>
              <div>
                <label className="block text-white font-semibold text-sm mb-2">
                  4. Số lượng thương hiệu (Brands) - Tự động điền:
                </label>
                <input
                  type="number"
                  value={formData.numBrands}
                  onChange={(e) => setFormData({ ...formData, numBrands: e.target.value })}
                  placeholder="10"
                  required
                  min="1"
                  className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-semibold text-sm mb-2">
                  5. Danh sách tên thương hiệu (tự động điền, mỗi tên 1 dòng):
                </label>
                <textarea
                  value={formData.brandNames}
                  onChange={(e) => setFormData({ ...formData, brandNames: e.target.value })}
                  rows={5}
                  placeholder={"Brand A\nBrand B\nBrand C"}
                  required
                  className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg font-mono text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
                />
              </div>
              <div>
                <label className="block text-white font-semibold text-sm mb-2">
                  6. Danh sách tên thuộc tính (tự động điền, mỗi tên 1 dòng):
                </label>
                <textarea
                  value={formData.attributeTexts}
                  onChange={(e) => setFormData({ ...formData, attributeTexts: e.target.value })}
                  rows={5}
                  placeholder={"Attribute 1\nAttribute 2\nAttribute 3"}
                  required
                  className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg font-mono text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
                />
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading || !selectedQuestion || !selectedRebaseQuestion}
          className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Reloop Syntax'
          )}
        </button>
      </form>
    )
  }

  // Manual mode
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-white font-semibold text-sm mb-2">
            1. Tên câu hỏi:
          </label>
          <input
            type="text"
            value={formData.questionName}
            onChange={(e) => setFormData({ ...formData, questionName: e.target.value })}
            placeholder="Q20"
            required
            className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
          />
        </div>
        <div>
          <label className="block text-white font-semibold text-sm mb-2">
            2. Tên câu hỏi Rebase:
          </label>
          <input
            type="text"
            value={formData.rebaseQuestion}
            onChange={(e) => setFormData({ ...formData, rebaseQuestion: e.target.value })}
            placeholder="Q19"
            required
            className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-white font-semibold text-sm mb-2">
            3. Số lượng thuộc tính (Attributes):
          </label>
          <input
            type="number"
            value={formData.numAttributes}
            onChange={(e) => setFormData({ ...formData, numAttributes: e.target.value })}
            placeholder="15"
            required
            min="1"
            className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
          />
        </div>
        <div>
          <label className="block text-white font-semibold text-sm mb-2">
            4. Số lượng thương hiệu (Brands):
          </label>
          <input
            type="number"
            value={formData.numBrands}
            onChange={(e) => setFormData({ ...formData, numBrands: e.target.value })}
            placeholder="10"
            required
            min="1"
            className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-white font-semibold text-sm mb-2">
            5. Danh sách tên thương hiệu (mỗi tên 1 dòng):
          </label>
          <textarea
            value={formData.brandNames}
            onChange={(e) => setFormData({ ...formData, brandNames: e.target.value })}
            rows={5}
            placeholder={"Brand A\nBrand B\nBrand C"}
            required
            className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg font-mono text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
          />
        </div>
        <div>
          <label className="block text-white font-semibold text-sm mb-2">
            6. Danh sách tên thuộc tính (mỗi tên 1 dòng):
          </label>
          <textarea
            value={formData.attributeTexts}
            onChange={(e) => setFormData({ ...formData, attributeTexts: e.target.value })}
            rows={5}
            placeholder={"Attribute 1\nAttribute 2\nAttribute 3"}
            required
            className="w-full px-3 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg font-mono text-sm text-gray-200 placeholder:text-gray-500 placeholder:text-xs placeholder:font-light"
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
          'Generate Reloop Syntax'
        )}
      </button>
    </form>
  )
}
