'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, ChevronDown } from 'lucide-react'
import { ParsedQuestion } from '@/lib/geminiParser'

interface NetcodeFormProps {
  mode: 'manual' | 'auto'
  questions?: ParsedQuestion[]
  onSyntaxGenerated: (syntax: string) => void
  onError: (error: string) => void
}

export default function NetcodeForm({ mode, questions = [], onSyntaxGenerated, onError }: NetcodeFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    questionName: '',
    codes: '',
    labels: '',
  })

  const [selectedQuestion, setSelectedQuestion] = useState<string>('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

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

  // Filter questions that have options (MA, SA questions)
  const availableQuestions = questions.filter(q => 
    q.options && q.options.length > 0 && (q.type === 'MA' || q.type === 'SA')
  )

  if (mode === 'auto') {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            1. Chọn câu hỏi:
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
                    Không có câu hỏi MA/SA nào. Vui lòng import dữ liệu trước.
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

        {selectedQuestion && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-white dark:text-black">
                  2. Danh sách Code (tự động điền):
                </label>
                <textarea
                  value={formData.codes}
                  onChange={(e) => setFormData({ ...formData, codes: e.target.value })}
                  rows={10}
                  placeholder="30&#10;1&#10;2&#10;..."
                  required
                  className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg font-mono text-sm text-black dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white dark:text-black">
                  3. Danh sách Nhãn (tự động điền, thêm [NET] cho codes cần net):
                </label>
                <textarea
                  value={formData.labels}
                  onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
                  rows={10}
                  placeholder="Product & Solutions Quality [NET]&#10;This company's paint has excellent color retention..."
                  required
                  className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg font-mono text-sm text-black dark:text-white"
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
        <label className="block text-sm font-medium mb-2">
          1. Tên câu hỏi (VD: Q11):
        </label>
        <input
          type="text"
          value={formData.questionName}
          onChange={(e) => setFormData({ ...formData, questionName: e.target.value })}
          placeholder="Q11"
          required
            className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            2. Danh sách Code (mỗi code 1 dòng):
          </label>
          <textarea
            value={formData.codes}
            onChange={(e) => setFormData({ ...formData, codes: e.target.value })}
            rows={10}
            placeholder="30&#10;1&#10;2&#10;3&#10;..."
            required
            className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            3. Danh sách Nhãn (mỗi nhãn 1 dòng, thêm [NET] cho codes cần net):
          </label>
          <textarea
            value={formData.labels}
            onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
            rows={10}
            placeholder="Product & Solutions Quality [NET]&#10;This company's paint has excellent color retention..."
            required
            className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg font-mono text-sm"
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
