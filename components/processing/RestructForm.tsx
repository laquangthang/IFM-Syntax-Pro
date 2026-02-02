'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, ChevronDown } from 'lucide-react'
import { ParsedQuestion } from '@/lib/geminiParser'
import { useSurveyStore } from '@/store/surveyStore'
import { getGridVariablesForRestruct } from '@/lib/processingHelpers'

interface RestructFormProps {
  mode: 'manual' | 'auto'
  questions?: ParsedQuestion[]
  onSyntaxGenerated: (syntax: string) => void
  onError: (error: string) => void
}

export default function RestructForm({ mode, questions = [], onSyntaxGenerated, onError }: RestructFormProps) {
  const [loading, setLoading] = useState(false)
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const { oldVariableMapping } = useSurveyStore()
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

  // Filter Grid questions
  const availableQuestions = questions.filter(
    q => q.type === 'SA_Grid' || q.type === 'MA_Grid'
  )

  if (mode === 'auto') {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white">
            1. Chọn các câu hỏi Grid (có thể chọn nhiều):
          </label>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full px-4 py-3 bg-glass-panel border-2 border-glass-border-light dark:border-glass-border-dark rounded-lg text-left flex items-center justify-between text-white hover:border-primary/50 transition-all shadow-sm"
            >
              <span className="text-sm font-medium text-white">
                {selectedQuestions.length > 0 
                  ? `Đã chọn ${selectedQuestions.length} câu hỏi` 
                  : 'Chọn câu hỏi Grid'}
              </span>
              <ChevronDown className={`size-5 transition-transform text-white ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {dropdownOpen && (
              <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-72 overflow-y-auto custom-scrollbar">
                {availableQuestions.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500 dark:text-gray-400">
                    Không có câu hỏi Grid nào. Vui lòng import dữ liệu trước.
                  </p>
                ) : (
                  availableQuestions.map((q) => {
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

        {selectedQuestions.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                2. Số lượng Brand:
              </label>
              <input
                type="number"
                value={formData.numBrands}
                onChange={(e) => setFormData({ ...formData, numBrands: e.target.value })}
                placeholder="Tự động điền"
                readOnly
                className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg text-black dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                3. Tên biến INDEX:
              </label>
              <input
                type="text"
                value={formData.indexVarName}
                onChange={(e) => setFormData({ ...formData, indexVarName: e.target.value })}
                placeholder="Tự động điền"
                className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
              />
            </div>
          </div>
        )}

        {selectedQuestions.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2 text-white">
              4. Tên các Brand (mỗi tên 1 dòng):
            </label>
            <textarea
              value={formData.brandNames}
              onChange={(e) => setFormData({ ...formData, brandNames: e.target.value })}
              rows={6}
              placeholder="Tự động điền"
              className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2 text-white">
            5. Biến KEEP (cách nhau bởi dấu phẩy, tùy chọn):
          </label>
          <input
            type="text"
            value={formData.keepVars}
            onChange={(e) => setFormData({ ...formData, keepVars: e.target.value })}
            placeholder="Vrid, Q00"
            className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
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
          <label className="block text-sm font-medium mb-2 text-white">
            1. Danh sách biến (mỗi biến 1 dòng):
          </label>
          <textarea
            value={formData.variables}
            onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
            rows={8}
            placeholder="Q10R1&#10;Q10R2&#10;Q10R3&#10;..."
            required
              className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white">
            2. Số lượng Brand:
          </label>
          <input
            type="number"
            value={formData.numBrands}
            onChange={(e) => setFormData({ ...formData, numBrands: e.target.value })}
            placeholder="16"
            required
            min="1"
            className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg mb-4"
          />
          
          <label className="block text-sm font-medium mb-2 text-white">
            3. Tên các Brand (mỗi tên 1 dòng):
          </label>
          <textarea
            value={formData.brandNames}
            onChange={(e) => setFormData({ ...formData, brandNames: e.target.value })}
            rows={6}
            placeholder="Vietinbank&#10;Military Bank&#10;LPBank&#10;..."
            required
              className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white">
            4. Tên các biến output (mỗi tên 1 dòng):
          </label>
          <textarea
            value={formData.outputVars}
            onChange={(e) => setFormData({ ...formData, outputVars: e.target.value })}
            rows={4}
            placeholder="Q1&#10;Q2&#10;Q3&#10;Q4"
            required
              className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white">
            5. Biến KEEP (cách nhau bởi dấu phẩy):
          </label>
          <input
            type="text"
            value={formData.keepVars}
            onChange={(e) => setFormData({ ...formData, keepVars: e.target.value })}
            placeholder="Total, BN1, BN2"
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
          'Generate Restruct Syntax'
        )}
      </button>
    </form>
  )
}
