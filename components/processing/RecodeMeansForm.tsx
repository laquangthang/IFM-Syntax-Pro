'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, ChevronDown } from 'lucide-react'
import { ParsedQuestion } from '@/lib/geminiParser'
import { useSurveyStore } from '@/store/surveyStore'
import { getChildVariables } from '@/lib/processingHelpers'

interface RecodeMeansFormProps {
  mode: 'manual' | 'auto'
  questions?: ParsedQuestion[]
  onSyntaxGenerated: (syntax: string) => void
  onError: (error: string) => void
}

export default function RecodeMeansForm({ mode, questions = [], onSyntaxGenerated, onError }: RecodeMeansFormProps) {
  const { oldVariableMapping } = useSurveyStore()
  const [loading, setLoading] = useState(false)
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
  const [formData, setFormData] = useState({
    ranges: '',
    means: '',
    codes: '',
    variables: '',
  })

  // Auto-populate from selected question
  useEffect(() => {
    if (mode === 'auto' && selectedQuestion) {
      const question = questions.find(q => q.id === selectedQuestion)
      if (question && question.options) {
        // Get variables
        const { varNames } = getChildVariables(question, oldVariableMapping)
        const variablesText = varNames.join('\n')
        
        // Get codes and labels
        const codesList: string[] = []
        const rangesList: string[] = []
        
        question.options.forEach(opt => {
          // Skip _O suffix options
          if (typeof opt.code === 'string' && opt.code.endsWith('_O')) {
            return
          }
          
          codesList.push(String(opt.code))
          // Use label as range (user can edit later)
          rangesList.push(opt.label)
        })
        
        const codesText = codesList.join('\n')
        const rangesText = rangesList.join('\n')
        const meansText = calculateMeans(rangesText)
        
        setFormData({
          ranges: rangesText,
          means: meansText,
          codes: codesText,
          variables: variablesText,
        })
      }
    } else if (mode === 'auto' && !selectedQuestion) {
      // Reset when no question selected
      setFormData({
        ranges: '',
        means: '',
        codes: '',
        variables: '',
      })
    }
  }, [selectedQuestion, mode, questions, oldVariableMapping])

  // Auto-calculate means from ranges
  const calculateMeans = (rangesText: string) => {
    const ranges = rangesText.split('\n').filter(line => line.trim())
    const means = ranges.map(range => {
      const trimmed = range.trim()
      
      // Helper function to extract number from text (handles commas)
      const extractNumber = (text: string): number | null => {
        // Remove all non-digit characters except commas and dots, then parse
        const cleaned = text.replace(/[^\d,.]/g, '').replace(/,/g, '')
        const num = parseFloat(cleaned)
        return isNaN(num) ? null : num
      }
      
      // Pattern 1: "Dưới X" → mean = X/2 (assume range from 0 to X)
      const duoiPattern = /dưới\s+(\d+(?:,\d+)*(?:\.\d+)?)/i
      const duoiMatch = trimmed.match(duoiPattern)
      if (duoiMatch) {
        const num = extractNumber(duoiMatch[1])
        if (num !== null) {
          return (num / 2).toFixed(2)
        }
      }
      
      // Pattern 2: "Từ X – dưới Y" → mean = (X + Y) / 2
      const tuDuoiPattern = /từ\s+(\d+(?:,\d+)*(?:\.\d+)?)\s*[–-]\s*dưới\s+(\d+(?:,\d+)*(?:\.\d+)?)/i
      const tuDuoiMatch = trimmed.match(tuDuoiPattern)
      if (tuDuoiMatch) {
        const num1 = extractNumber(tuDuoiMatch[1])
        const num2 = extractNumber(tuDuoiMatch[2])
        if (num1 !== null && num2 !== null) {
          return ((num1 + num2) / 2).toFixed(2)
        }
      }
      
      // Pattern 3: "Từ X – Y" or "X – Y" → mean = (X + Y) / 2
      const dashPattern = /(?:từ\s+)?(\d+(?:,\d+)*(?:\.\d+)?)\s*[–-]\s*(\d+(?:,\d+)*(?:\.\d+)?)/i
      const dashMatch = trimmed.match(dashPattern)
      if (dashMatch) {
        const num1 = extractNumber(dashMatch[1])
        const num2 = extractNumber(dashMatch[2])
        if (num1 !== null && num2 !== null) {
          return ((num1 + num2) / 2).toFixed(2)
        }
      }
      
      // Pattern 4: "X and above" or "X trở lên" → mean = X * 1.5 (assume range from X to X*2)
      const abovePattern = /(\d+(?:,\d+)*(?:\.\d+)?)\s+(?:and\s+)?above|trở\s+lên/i
      const aboveMatch = trimmed.match(abovePattern)
      if (aboveMatch) {
        const num = extractNumber(aboveMatch[1])
        if (num !== null) {
          return (num * 1.5).toFixed(2)
        }
      }
      
      // Pattern 5: Single number → use that number as mean
      const singleNumberPattern = /^(\d+(?:,\d+)*(?:\.\d+)?)/
      const singleMatch = trimmed.match(singleNumberPattern)
      if (singleMatch) {
        const num = extractNumber(singleMatch[1])
        if (num !== null) {
          return num.toFixed(2)
        }
      }
      
      // Pattern 6: "Khác" or other non-numeric text → return 0 or empty
      if (/khác|other/i.test(trimmed)) {
        return '0'
      }
      
      // Default: try to find any number and use it
      const anyNumberPattern = /(\d+(?:,\d+)*(?:\.\d+)?)/
      const anyMatch = trimmed.match(anyNumberPattern)
      if (anyMatch) {
        const num = extractNumber(anyMatch[1])
        if (num !== null) {
          return num.toFixed(2)
        }
      }
      
      return '0'
    })
    return means.join('\n')
  }

  const handleRangesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const ranges = e.target.value
    setFormData({
      ...formData,
      ranges,
      means: calculateMeans(ranges),
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    onError('')

    try {
      const response = await fetch('/api/processing/recode-means', {
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
              className="w-full px-4 py-3 bg-glass-panel border-2 border-glass-border-light dark:border-glass-border-dark rounded-lg text-left flex items-center justify-between text-white dark:text-black hover:border-primary/50 transition-all shadow-sm"
            >
              <span className="text-sm font-medium text-white dark:text-black">
                {selectedQuestion 
                  ? questions.find(q => q.id === selectedQuestion) 
                    ? `${questions.find(q => q.id === selectedQuestion)?.id} [${questions.find(q => q.id === selectedQuestion)?.type}]`
                    : 'Chọn câu hỏi'
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
                  2. Khoảng giá trị (tự động điền, có thể chỉnh sửa):
                </label>
                <textarea
                  value={formData.ranges}
                  onChange={handleRangesChange}
                  rows={6}
                  placeholder="5,000,001 - 15,000,000 VND&#10;15,000,001 - 25,000,000 VND&#10;25,000,001 and above VND"
                  required
                  className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white dark:text-black">
                  3. Means tự động tính (có thể chỉnh sửa):
                </label>
                <textarea
                  value={formData.means}
                  onChange={(e) => setFormData({ ...formData, means: e.target.value })}
                  rows={6}
                  placeholder="Means sẽ hiển thị ở đây..."
                  required
                  className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-white dark:text-black">
                  4. Codes tương ứng (tự động điền):
                </label>
                <textarea
                  value={formData.codes}
                  onChange={(e) => setFormData({ ...formData, codes: e.target.value })}
                  rows={4}
                  placeholder="1&#10;2&#10;3"
                  required
                  className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white dark:text-black">
                  5. Biến cần recode (tự động điền):
                </label>
                <textarea
                  value={formData.variables}
                  onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                  rows={4}
                  placeholder="Q1&#10;Q2&#10;Q3"
                  required
                  className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
                />
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
            'Generate Recode Means Syntax'
          )}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            1. Khoảng giá trị (mỗi khoảng 1 dòng):
          </label>
          <textarea
            value={formData.ranges}
            onChange={handleRangesChange}
            rows={6}
            placeholder="5,000,001 - 15,000,000 VND&#10;15,000,001 - 25,000,000 VND&#10;25,000,001 and above VND"
            required
              className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            2. Means tự động tính (có thể chỉnh sửa):
          </label>
          <textarea
            value={formData.means}
            onChange={(e) => setFormData({ ...formData, means: e.target.value })}
            rows={6}
            placeholder="Means sẽ hiển thị ở đây..."
            required
              className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            3. Codes tương ứng (mỗi code 1 dòng):
          </label>
          <textarea
            value={formData.codes}
            onChange={(e) => setFormData({ ...formData, codes: e.target.value })}
            rows={4}
            placeholder="1&#10;2&#10;3"
            required
              className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            4. Biến cần recode (mỗi biến 1 dòng):
          </label>
          <textarea
            value={formData.variables}
            onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
            rows={4}
            placeholder="Q1&#10;Q2&#10;Q3"
            required
              className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
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
          'Generate Recode Means Syntax'
        )}
      </button>
    </form>
  )
}
