'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Loader2, ChevronDown } from 'lucide-react'
import { ParsedQuestion } from '@/lib/geminiParser'
import { useSurveyStore } from '@/store/surveyStore'
import { getChildVariables } from '@/lib/processingHelpers'

interface TopboxFormProps {
  mode: 'manual' | 'auto'
  questions?: ParsedQuestion[]
  onSyntaxGenerated: (syntax: string) => void
  onError: (error: string) => void
}

export default function TopboxForm({ mode, questions = [], onSyntaxGenerated, onError }: TopboxFormProps) {
  const { oldVariableMapping } = useSurveyStore()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    varNames: '',
    varLabels: '',
    t2b: '',
    nonT2b: '',
    b2b: '',
    nonB2b: '',
  })

  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
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
  const [selectedCodes, setSelectedCodes] = useState<{
    t2b: string[]
    nonT2b: string[]
    b2b: string[]
    nonB2b: string[]
  }>({
    t2b: [],
    nonT2b: [],
    b2b: [],
    nonB2b: [],
  })

  // Get all unique codes from selected questions
  const availableCodes = useMemo(() => {
    if (mode !== 'auto' || selectedQuestions.length === 0) return []
    
    const codes = new Set<string>()
    const selected = questions.filter(q => selectedQuestions.includes(q.id))
    
    selected.forEach(q => {
      if (q.options) {
        q.options.forEach(opt => {
          // Skip _O suffix options (they are duplicates)
          if (typeof opt.code === 'string' && opt.code.endsWith('_O')) {
            return
          }
          codes.add(String(opt.code))
        })
      }
    })
    
    return Array.from(codes).sort((a, b) => {
      const numA = parseInt(a, 10)
      const numB = parseInt(b, 10)
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB
      }
      return a.localeCompare(b)
    })
  }, [selectedQuestions, questions, mode])

  // Reset selected codes when questions change
  useEffect(() => {
    if (mode === 'auto') {
      // Filter out codes that are no longer available
      setSelectedCodes(prev => ({
        t2b: prev.t2b.filter(c => availableCodes.includes(c)),
        nonT2b: prev.nonT2b.filter(c => availableCodes.includes(c)),
        b2b: prev.b2b.filter(c => availableCodes.includes(c)),
        nonB2b: prev.nonB2b.filter(c => availableCodes.includes(c)),
      }))
    }
  }, [availableCodes, mode])

  // Auto-update form data when codes are selected
  useEffect(() => {
    if (mode === 'auto') {
      setFormData(prev => ({
        ...prev,
        t2b: selectedCodes.t2b.join(','),
        nonT2b: selectedCodes.nonT2b.join(','),
        b2b: selectedCodes.b2b.join(','),
        nonB2b: selectedCodes.nonB2b.join(','),
      }))
    }
  }, [selectedCodes, mode])

  const toggleCode = (code: string, category: 't2b' | 'nonT2b' | 'b2b' | 'nonB2b') => {
    setSelectedCodes(prev => {
      const current = prev[category]
      const newCodes = current.includes(code)
        ? current.filter(c => c !== code)
        : [...current, code]
      
      return {
        ...prev,
        [category]: newCodes,
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    onError('')

    try {
      let finalVarNames = formData.varNames
      let finalVarLabels = formData.varLabels

      // Auto mode: extract from selected questions
      if (mode === 'auto' && selectedQuestions.length > 0) {
        const selected = questions.filter(q => selectedQuestions.includes(q.id))
        const allVarNames: string[] = []
        const allVarLabels: string[] = []
        
        selected.forEach(q => {
          const { varNames, varLabels } = getChildVariables(q, oldVariableMapping)
          allVarNames.push(...varNames)
          allVarLabels.push(...varLabels)
        })
        
        finalVarNames = allVarNames.join('\n')
        finalVarLabels = allVarLabels.join('\n')
      }
      
      // Convert newline-separated varNames to comma-separated for API
      const varNamesForAPI = finalVarNames.split('\n').map(v => v.trim()).filter(v => v).join(',')

      const response = await fetch('/api/processing/topbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          varNames: varNamesForAPI,
          varLabels: finalVarLabels,
          t2b: formData.t2b,
          nonT2b: formData.nonT2b,
          b2b: formData.b2b,
          nonB2b: formData.nonB2b,
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

  if (mode === 'auto') {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            1. Chọn câu hỏi (có thể chọn nhiều):
          </label>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full px-4 py-3 bg-glass-panel border-2 border-glass-border-light dark:border-glass-border-dark rounded-lg text-left flex items-center justify-between text-white dark:text-black hover:border-primary/50 transition-all shadow-sm"
            >
              <span className="text-sm font-medium text-white dark:text-black">
                {selectedQuestions.length > 0 
                  ? `Đã chọn ${selectedQuestions.length} câu hỏi` 
                  : 'Chọn câu hỏi'}
              </span>
              <ChevronDown className={`size-5 transition-transform text-white dark:text-black ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {dropdownOpen && (
              <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-72 overflow-y-auto custom-scrollbar">
                {questions.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500 dark:text-gray-400">
                    Không có câu hỏi nào. Vui lòng import dữ liệu trước.
                  </p>
                ) : (
                  questions.map((q) => {
                    const isSelected = selectedQuestions.includes(q.id)
                    return (
                      <label
                        key={q.id}
                        className={`flex items-center gap-3 p-4 cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-primary/20 border-l-4 border-primary' 
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 border-l-4 border-transparent'
                        } border-b border-gray-200 dark:border-gray-700 last:border-b-0`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedQuestions([...selectedQuestions, q.id])
                            } else {
                              setSelectedQuestions(selectedQuestions.filter(id => id !== q.id))
                            }
                          }}
                          className="w-4 h-4 rounded border-2 border-gray-400 dark:border-gray-500 checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary/50"
                        />
                        <div className="flex-1 min-w-0">
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
                        </div>
                      </label>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {selectedQuestions.length > 0 && availableCodes.length > 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-3 text-white dark:text-black">
                2. Chọn codes cho Top-Box và Bottom-Box:
              </label>
              <div className="grid grid-cols-2 gap-4">
                {/* Top-Box */}
                <div className="p-4 bg-glass-panel rounded-lg border border-glass-border-light dark:border-glass-border-dark">
                  <h4 className="text-sm font-semibold mb-2 text-white dark:text-black">Top-Box (T2B)</h4>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {availableCodes.map(code => (
                      <label key={`t2b-${code}`} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedCodes.t2b.includes(code)}
                          onChange={() => toggleCode(code, 't2b')}
                          className="rounded"
                        />
                        <span className="text-sm text-white dark:text-black">{code}</span>
                      </label>
                    ))}
                  </div>
                  {selectedCodes.t2b.length > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
                      Đã chọn: {selectedCodes.t2b.join(', ')}
                    </p>
                  )}
                </div>

                {/* Non Top-Box */}
                <div className="p-4 bg-glass-panel rounded-lg border border-glass-border-light dark:border-glass-border-dark">
                  <h4 className="text-sm font-semibold mb-2 text-white dark:text-black">Non Top-Box (Non T2B)</h4>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {availableCodes.map(code => (
                      <label key={`nonT2b-${code}`} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedCodes.nonT2b.includes(code)}
                          onChange={() => toggleCode(code, 'nonT2b')}
                          className="rounded"
                        />
                        <span className="text-sm text-white dark:text-black">{code}</span>
                      </label>
                    ))}
                  </div>
                  {selectedCodes.nonT2b.length > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
                      Đã chọn: {selectedCodes.nonT2b.join(', ')}
                    </p>
                  )}
                </div>

                {/* Bottom-Box */}
                <div className="p-4 bg-glass-panel rounded-lg border border-glass-border-light dark:border-glass-border-dark">
                  <h4 className="text-sm font-semibold mb-2 text-white dark:text-black">Bottom-Box (B2B)</h4>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {availableCodes.map(code => (
                      <label key={`b2b-${code}`} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedCodes.b2b.includes(code)}
                          onChange={() => toggleCode(code, 'b2b')}
                          className="rounded"
                        />
                        <span className="text-sm text-white dark:text-black">{code}</span>
                      </label>
                    ))}
                  </div>
                  {selectedCodes.b2b.length > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
                      Đã chọn: {selectedCodes.b2b.join(', ')}
                    </p>
                  )}
                </div>

                {/* Non Bottom-Box */}
                <div className="p-4 bg-glass-panel rounded-lg border border-glass-border-light dark:border-glass-border-dark">
                  <h4 className="text-sm font-semibold mb-2 text-white dark:text-black">Non Bottom-Box (Non B2B)</h4>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {availableCodes.map(code => (
                      <label key={`nonB2b-${code}`} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedCodes.nonB2b.includes(code)}
                          onChange={() => toggleCode(code, 'nonB2b')}
                          className="rounded"
                        />
                        <span className="text-sm text-white dark:text-black">{code}</span>
                      </label>
                    ))}
                  </div>
                  {selectedCodes.nonB2b.length > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
                      Đã chọn: {selectedCodes.nonB2b.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Display current values (read-only) */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-400 dark:text-gray-600">
                  Top-Box (tự động điền):
                </label>
                <div className="px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg text-white dark:text-black">
                  {formData.t2b || '(chưa chọn)'}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-400 dark:text-gray-600">
                  Non Top-Box (tự động điền):
                </label>
                <div className="px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg text-white dark:text-black">
                  {formData.nonT2b || '(chưa chọn)'}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-400 dark:text-gray-600">
                  Bottom-Box (tự động điền):
                </label>
                <div className="px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg text-white dark:text-black">
                  {formData.b2b || '(chưa chọn)'}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-400 dark:text-gray-600">
                  Non Bottom-Box (tự động điền):
                </label>
                <div className="px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg text-white dark:text-black">
                  {formData.nonB2b || '(chưa chọn)'}
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedQuestions.length > 0 && availableCodes.length === 0 && (
          <div className="p-4 bg-glass-panel rounded-lg border border-glass-border-light dark:border-glass-border-dark">
            <p className="text-sm text-gray-400 dark:text-gray-600">
              Câu hỏi đã chọn không có codes. Vui lòng chọn câu hỏi có options.
            </p>
          </div>
        )}

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
            'Generate Topbox Syntax'
          )}
        </button>
      </form>
    )
  }

  // Manual mode
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-white dark:text-black">
          1. Tên biến (mỗi biến 1 dòng):
        </label>
        <textarea
          value={formData.varNames}
          onChange={(e) => setFormData({ ...formData, varNames: e.target.value })}
          rows={3}
          placeholder="Q1_1&#10;Q1_2&#10;Q1_3"
          required
          className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-white dark:text-black">
          2. Nhãn biến (mỗi nhãn 1 dòng, theo thứ tự):
        </label>
        <textarea
          value={formData.varLabels}
          onChange={(e) => setFormData({ ...formData, varLabels: e.target.value })}
          rows={3}
          placeholder="Label for Q1_1&#10;Label for Q1_2&#10;Label for Q1_3"
          required
          className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            3. Giá trị Top-Box (vd: 4,5):
          </label>
            <input
              type="text"
              value={formData.t2b}
              onChange={(e) => setFormData({ ...formData, t2b: e.target.value })}
              placeholder="4,5"
              className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
            />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            4. Giá trị còn lại cho Top-Box (vd: 1,2,3):
          </label>
          <input
            type="text"
            value={formData.nonT2b}
            onChange={(e) => setFormData({ ...formData, nonT2b: e.target.value })}
            placeholder="1,2,3"
            className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            5. Giá trị Bottom-Box (vd: 1,2):
          </label>
          <input
            type="text"
            value={formData.b2b}
            onChange={(e) => setFormData({ ...formData, b2b: e.target.value })}
            placeholder="1,2"
            className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            6. Giá trị còn lại cho Bottom-Box (vd: 3,4,5):
          </label>
          <input
            type="text"
            value={formData.nonB2b}
            onChange={(e) => setFormData({ ...formData, nonB2b: e.target.value })}
            placeholder="3,4,5"
            className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
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
          'Generate Topbox Syntax'
        )}
      </button>
    </form>
  )
}
