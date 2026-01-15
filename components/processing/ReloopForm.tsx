'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, ChevronDown } from 'lucide-react'
import { ParsedQuestion } from '@/lib/geminiParser'

interface ReloopFormProps {
  mode: 'manual' | 'auto'
  questions?: ParsedQuestion[]
  onSyntaxGenerated: (syntax: string) => void
  onError: (error: string) => void
}

export default function ReloopForm({ mode, questions = [], onSyntaxGenerated, onError }: ReloopFormProps) {
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
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [rebaseDropdownOpen, setRebaseDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const rebaseDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
      if (rebaseDropdownRef.current && !rebaseDropdownRef.current.contains(event.target as Node)) {
        setRebaseDropdownOpen(false)
      }
    }

    if (dropdownOpen || rebaseDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen, rebaseDropdownOpen])

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

  // Filter questions that are Grid type
  const availableQuestions = questions.filter(q => 
    q.type === 'MA_Grid' || q.type === 'SA_Grid'
  )

  if (mode === 'auto') {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white dark:text-black">
              1. Chọn câu hỏi Grid:
            </label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full px-4 py-3 bg-glass-panel border-2 border-glass-border-dark dark:border-glass-border-light rounded-lg text-left flex items-center justify-between text-white dark:text-black hover:border-primary/50 transition-all shadow-sm"
              >
                <span className="text-sm font-medium text-white dark:text-black">
                  {selectedQuestion 
                    ? availableQuestions.find(q => q.id === selectedQuestion) 
                      ? `${availableQuestions.find(q => q.id === selectedQuestion)?.id} [${availableQuestions.find(q => q.id === selectedQuestion)?.type}]`
                      : 'Chọn câu hỏi'
                    : 'Chọn câu hỏi'}
                </span>
                <ChevronDown className={`size-5 transition-transform text-white dark:text-black ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {dropdownOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-72 overflow-y-auto custom-scrollbar">
                  {availableQuestions.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500 dark:text-gray-400">
                      Không có câu hỏi Grid nào. Vui lòng import dữ liệu trước.
                    </p>
                  ) : (
                    availableQuestions.map((q) => {
                      const isSelected = selectedQuestion === q.id
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            setSelectedQuestion(q.id)
                            setDropdownOpen(false)
                          }}
                          className={`w-full text-left p-4 cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-primary/20 border-l-4 border-primary' 
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700 border-l-4 border-transparent'
                          } border-b border-gray-200 dark:border-gray-700 last:border-b-0`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-medium ${
                              isSelected ? 'text-primary' : 'text-black dark:text-white'
                            }`}>
                              {q.id}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
                              {q.type}
                            </span>
                          </div>
                          <span className="text-xs text-gray-600 dark:text-gray-300 block truncate">
                            {q.label.substring(0, 60)}{q.label.length > 60 ? '...' : ''}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-white dark:text-black">
              2. Tên câu hỏi Rebase:
            </label>
            <div className="relative" ref={rebaseDropdownRef}>
              <button
                type="button"
                onClick={() => setRebaseDropdownOpen(!rebaseDropdownOpen)}
                className="w-full px-4 py-3 bg-glass-panel border-2 border-glass-border-dark dark:border-glass-border-light rounded-lg text-left flex items-center justify-between text-white dark:text-black hover:border-primary/50 transition-all shadow-sm"
              >
                <span className="text-sm font-medium text-white dark:text-black">
                  {selectedRebaseQuestion 
                    ? questions.find(q => q.id === selectedRebaseQuestion) 
                      ? questions.find(q => q.id === selectedRebaseQuestion)?.id
                      : 'Chọn câu hỏi'
                    : 'Chọn câu hỏi'}
                </span>
                <ChevronDown className={`size-5 transition-transform text-white dark:text-black ${rebaseDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {rebaseDropdownOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-72 overflow-y-auto custom-scrollbar">
                  {questions.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500 dark:text-gray-400">
                      Không có câu hỏi nào. Vui lòng import dữ liệu trước.
                    </p>
                  ) : (
                    questions.map((q) => {
                      const isSelected = selectedRebaseQuestion === q.id
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            setSelectedRebaseQuestion(q.id)
                            setRebaseDropdownOpen(false)
                          }}
                          className={`w-full text-left p-4 cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-primary/20 border-l-4 border-primary' 
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700 border-l-4 border-transparent'
                          } border-b border-gray-200 dark:border-gray-700 last:border-b-0`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-medium ${
                              isSelected ? 'text-primary' : 'text-black dark:text-white'
                            }`}>
                              {q.id}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
                              {q.type}
                            </span>
                          </div>
                          <span className="text-xs text-gray-600 dark:text-gray-300 block truncate">
                            {q.label.substring(0, 60)}{q.label.length > 60 ? '...' : ''}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
            <input
              type="text"
              value={formData.rebaseQuestion || selectedRebaseQuestion}
              onChange={(e) => {
                setSelectedRebaseQuestion(e.target.value)
                setFormData({ ...formData, rebaseQuestion: e.target.value })
              }}
              placeholder="Hoặc nhập tên câu hỏi"
              className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 mt-2"
            />
          </div>
        </div>

        {selectedQuestion && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-white dark:text-black">
                  3. Số lượng thuộc tính (Attributes) - Tự động điền:
                </label>
                <input
                  type="number"
                  value={formData.numAttributes}
                  onChange={(e) => setFormData({ ...formData, numAttributes: e.target.value })}
                  placeholder="15"
                  required
                  min="1"
                  className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white dark:text-black">
                  4. Số lượng thương hiệu (Brands) - Tự động điền:
                </label>
                <input
                  type="number"
                  value={formData.numBrands}
                  onChange={(e) => setFormData({ ...formData, numBrands: e.target.value })}
                  placeholder="10"
                  required
                  min="1"
                  className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-white dark:text-black">
                  5. Danh sách tên thương hiệu (tự động điền, mỗi tên 1 dòng):
                </label>
                <textarea
                  value={formData.brandNames}
                  onChange={(e) => setFormData({ ...formData, brandNames: e.target.value })}
                  rows={5}
                  required
                  className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg font-mono text-sm text-black dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white dark:text-black">
                  6. Danh sách tên thuộc tính (tự động điền, mỗi tên 1 dòng):
                </label>
                <textarea
                  value={formData.attributeTexts}
                  onChange={(e) => setFormData({ ...formData, attributeTexts: e.target.value })}
                  rows={5}
                  required
                  className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg font-mono text-sm text-black dark:text-white"
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
          <label className="block text-sm font-medium mb-2">
            1. Tên câu hỏi:
          </label>
          <input
            type="text"
            value={formData.questionName}
            onChange={(e) => setFormData({ ...formData, questionName: e.target.value })}
            placeholder="Q20"
            required
            className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            2. Tên câu hỏi Rebase:
          </label>
          <input
            type="text"
            value={formData.rebaseQuestion}
            onChange={(e) => setFormData({ ...formData, rebaseQuestion: e.target.value })}
            placeholder="Q19"
            required
            className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            3. Số lượng thuộc tính (Attributes):
          </label>
          <input
            type="number"
            value={formData.numAttributes}
            onChange={(e) => setFormData({ ...formData, numAttributes: e.target.value })}
            placeholder="15"
            required
            min="1"
            className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            4. Số lượng thương hiệu (Brands):
          </label>
          <input
            type="number"
            value={formData.numBrands}
            onChange={(e) => setFormData({ ...formData, numBrands: e.target.value })}
            placeholder="10"
            required
            min="1"
            className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            5. Danh sách tên thương hiệu (mỗi tên 1 dòng):
          </label>
          <textarea
            value={formData.brandNames}
            onChange={(e) => setFormData({ ...formData, brandNames: e.target.value })}
            rows={5}
            required
            className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            6. Danh sách tên thuộc tính (mỗi tên 1 dòng):
          </label>
          <textarea
            value={formData.attributeTexts}
            onChange={(e) => setFormData({ ...formData, attributeTexts: e.target.value })}
            rows={5}
            required
            className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg font-mono text-sm"
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
