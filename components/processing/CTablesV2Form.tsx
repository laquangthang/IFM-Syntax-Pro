'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { ParsedQuestion } from '@/lib/geminiParser'
import { useSurveyStore } from '@/store/surveyStore'
import { getChildVariables } from '@/lib/processingHelpers'

interface CTablesV2FormProps {
  mode: 'manual' | 'auto'
  questions?: ParsedQuestion[]
  onSyntaxGenerated: (syntax: string) => void
  onError: (error: string) => void
}

const formulas = [
  { value: '[c][count f40.0, totals[count f40.0]]', text: 'count, totals' },
  { value: '[c][colpct.count f40.0, totals[count f40.0]]', text: 'colpct.count, totals' },
  { value: '[s][validn f40.0, mean f40.2]', text: 'validn, mean' },
  { value: '[s][validn f40.0, stddev f40.2]', text: 'validn stddev' },
  { value: '[c][colpct pct40.0, totals[count f40.0]]', text: 'colpct, totals' },
  { value: '[c][layercolpct.totaln pct40.1, totals[count f40.0]]', text: 'layercolpct.totaln, totals' },
  { value: '[s][validn f40.0, maximum, minimum, median]', text: 'validn maximum, minimum, median' },
  { value: '[count f40.0, colpct.count pct40.1]', text: 'count, colpct.count' },
]

export default function CTablesV2Form({ mode, questions = [], onSyntaxGenerated, onError }: CTablesV2FormProps) {
  const { oldVariableMapping } = useSurveyStore()
  const [byVars, setByVars] = useState('')
  const [selectedFormulas, setSelectedFormulas] = useState<string[]>([])
  const [formulaVars, setFormulaVars] = useState<Record<string, string>>({})
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [formulaQuestions, setFormulaQuestions] = useState<Record<string, string[]>>({})
  const [openQuestionDropdowns, setOpenQuestionDropdowns] = useState<Record<string, boolean>>({})

  // Auto-populate variables when questions are selected for a formula
  useEffect(() => {
    if (mode === 'auto') {
      Object.keys(formulaQuestions).forEach(formulaValue => {
        const questionIds = formulaQuestions[formulaValue] || []
        if (questionIds.length > 0) {
          const selected = questions.filter(q => questionIds.includes(q.id))
          const allVarNames: string[] = []
          
          selected.forEach(q => {
            const { varNames } = getChildVariables(q, oldVariableMapping)
            allVarNames.push(...varNames)
          })
          
          // Auto-populate variables for this formula
          setFormulaVars(prev => ({
            ...prev,
            [formulaValue]: allVarNames.join('\n')
          }))
        }
      })
    }
  }, [formulaQuestions, mode, questions, oldVariableMapping])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
      
      // Close question dropdowns when clicking outside
      const target = event.target as HTMLElement
      if (!target.closest('[data-question-dropdown]')) {
        setOpenQuestionDropdowns({})
      }
    }

    if (dropdownOpen || Object.values(openQuestionDropdowns).some(v => v)) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen, openQuestionDropdowns])

  const handleFormulaToggle = (formulaValue: string) => {
    if (selectedFormulas.includes(formulaValue)) {
      setSelectedFormulas(selectedFormulas.filter(f => f !== formulaValue))
      const newFormulaVars = { ...formulaVars }
      delete newFormulaVars[formulaValue]
      setFormulaVars(newFormulaVars)
      const newFormulaQuestions = { ...formulaQuestions }
      delete newFormulaQuestions[formulaValue]
      setFormulaQuestions(newFormulaQuestions)
    } else {
      setSelectedFormulas([...selectedFormulas, formulaValue])
      setFormulaVars({ ...formulaVars, [formulaValue]: '' })
      setFormulaQuestions({ ...formulaQuestions, [formulaValue]: [] })
    }
  }

  const handleQuestionToggle = (formulaValue: string, questionId: string, checked: boolean) => {
    const currentQuestions = formulaQuestions[formulaValue] || []
    const newQuestions = checked
      ? [...currentQuestions, questionId]
      : currentQuestions.filter(id => id !== questionId)
    
    setFormulaQuestions({
      ...formulaQuestions,
      [formulaValue]: newQuestions
    })
  }

  const handleGenerate = () => {
    if (selectedFormulas.length === 0) {
      onError('Vui lòng chọn ít nhất một công thức')
      return
    }

    const byVarsList = byVars.trim().split('\n').map(s => s.trim()).filter(Boolean)
    
    // Build formula lines
    const formulaToVars = new Map<string, string[]>()
    selectedFormulas.forEach(formula => {
      const vars = (formulaVars[formula] || '').split('\n').map(s => s.trim()).filter(Boolean)
      formulaToVars.set(formula, vars)
    })

    // Get all variables in order (from first formula)
    const orderedVars: string[] = []
    const seen = new Set<string>()
    
    if (selectedFormulas.length > 0) {
      const primaryVars = formulaToVars.get(selectedFormulas[0]) || []
      primaryVars.forEach(v => {
        if (!seen.has(v)) {
          seen.add(v)
          orderedVars.push(v)
        }
      })
    }

    // Append remaining from other formulas
    selectedFormulas.slice(1).forEach(formula => {
      const vars = formulaToVars.get(formula) || []
      vars.forEach(v => {
        if (!seen.has(v)) {
          seen.add(v)
          orderedVars.push(v)
        }
      })
    })

    // Build lines by variable-major order
    const allFormulaLines: string[] = []
    orderedVars.forEach(v => {
      selectedFormulas.forEach(f => {
        const list = formulaToVars.get(f) || []
        if (list.includes(v)) {
          allFormulaLines.push(v + f)
        }
      })
    })

    let processedFormulaLines = ''
    if (allFormulaLines.length > 0) {
      const firstLine = allFormulaLines[0]
      const otherLines = allFormulaLines.slice(1).map(line => `+${line}`)
      processedFormulaLines = [firstLine, ...otherLines].join('\n')
    }

    let byLine = ''
    if (byVarsList.length > 0) {
      byLine = `BY (${byVarsList.join(' + ')}) [c]`
    }

    const slabLine = '/slab pos=row'
    
    let catLine1 = ''
    if (byVarsList.length > 0) {
      catLine1 = `/cat var=${byVarsList.join(' ')} order=a key=value empty=include`
    }

    // Build /cat var using the same variable order (orderedVars) plus BY vars
    const allVarsForCat = [...orderedVars, ...byVarsList.filter(v => !orderedVars.includes(v))]
    const catLine2 = `/cat var=\n${allVarsForCat.join('\n')}\norder=a key=value empty=include total=yes position=before.`

    const finalString = [
      'CTABLES /tab',
      processedFormulaLines,
      byLine,
      slabLine,
      catLine1,
      catLine2
    ].filter(line => line.trim() !== '').join('\n')

    onSyntaxGenerated(finalString)
  }

  if (mode === 'auto') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            1. Chọn công thức:
          </label>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full px-4 py-3 bg-glass-panel border-2 border-glass-border-dark dark:border-glass-border-light rounded-lg text-left flex items-center justify-between text-white dark:text-black hover:border-primary/50 transition-all shadow-sm"
            >
              <span className="text-sm font-medium text-white dark:text-black">
                {selectedFormulas.length > 0 
                  ? `Đã chọn ${selectedFormulas.length} công thức` 
                  : 'Chọn công thức'}
              </span>
              <ChevronDown className={`size-5 transition-transform text-white dark:text-black ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {dropdownOpen && (
              <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-72 overflow-y-auto custom-scrollbar">
                {formulas.map((formula) => {
                  const isSelected = selectedFormulas.includes(formula.value)
                  return (
                    <label
                      key={formula.value}
                      className={`flex items-center gap-3 p-4 cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-primary/20 border-l-4 border-primary' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 border-l-4 border-transparent'
                      } border-b border-gray-200 dark:border-gray-700 last:border-b-0`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleFormulaToggle(formula.value)}
                        className="w-4 h-4 rounded border-2 border-gray-400 dark:border-gray-500 checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary/50"
                      />
                      <span className={`text-sm font-medium flex-1 ${
                        isSelected 
                          ? 'text-primary' 
                          : 'text-black dark:text-white'
                      }`}>
                        {formula.text}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {selectedFormulas.length > 0 && (
          <div className="space-y-4">
            {selectedFormulas.map((formulaValue) => {
              const formula = formulas.find(f => f.value === formulaValue)
              const selectedQs = formulaQuestions[formulaValue] || []
              const vars = (formulaVars[formulaValue] || '').split('\n').filter(v => v.trim())
              
              return (
                <div key={formulaValue} className="p-4 bg-glass-panel rounded-lg border border-glass-border-dark dark:border-glass-border-light">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-white dark:text-black mb-1">
                      Công thức: {formula?.text}
                    </h3>
                    {vars.length > 0 && (
                      <div className="mt-2 p-2 bg-background-dark dark:bg-background-light rounded border border-glass-border-dark dark:border-glass-border-light">
                        <p className="text-xs text-gray-400 dark:text-gray-600 mb-1">
                          Các biến đã chọn ({vars.length} biến):
                        </p>
                        <p className="text-xs font-mono text-white dark:text-black break-all">
                          {vars.join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-3">
                    <label className="block text-xs font-medium mb-2 text-white dark:text-black">
                      Chọn câu hỏi cho công thức này:
                    </label>
                    <div className="relative" data-question-dropdown>
                      <button
                        type="button"
                        onClick={() => setOpenQuestionDropdowns({
                          ...openQuestionDropdowns,
                          [formulaValue]: !openQuestionDropdowns[formulaValue]
                        })}
                        className="w-full px-3 py-2 bg-glass-panel border-2 border-glass-border-dark dark:border-glass-border-light rounded-lg text-left flex items-center justify-between text-white dark:text-black hover:border-primary/50 transition-all shadow-sm"
                      >
                        <span className="text-sm font-medium text-white dark:text-black">
                          {selectedQs.length > 0 
                            ? `Đã chọn ${selectedQs.length} câu hỏi` 
                            : 'Chọn câu hỏi'}
                        </span>
                        <ChevronDown className={`size-4 transition-transform text-white dark:text-black ${openQuestionDropdowns[formulaValue] ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {openQuestionDropdowns[formulaValue] && (
                        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                          {questions.length === 0 ? (
                            <p className="p-3 text-sm text-gray-500 dark:text-gray-400">
                              Không có câu hỏi nào. Vui lòng import dữ liệu trước.
                            </p>
                          ) : (
                            questions.map((q) => {
                              const isSelected = selectedQs.includes(q.id)
                              return (
                                <label
                                  key={q.id}
                                  className={`flex items-center gap-3 p-3 cursor-pointer transition-all ${
                                    isSelected 
                                      ? 'bg-primary/20 border-l-4 border-primary' 
                                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 border-l-4 border-transparent'
                                  } border-b border-gray-200 dark:border-gray-700 last:border-b-0`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => handleQuestionToggle(formulaValue, q.id, e.target.checked)}
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
                  
                  <div>
                    <label className="block text-xs font-medium mb-2 text-white dark:text-black">
                      Biến cho công thức này (tự động điền, có thể chỉnh sửa):
                    </label>
                    <textarea
                      value={formulaVars[formulaValue] || ''}
                      onChange={(e) => setFormulaVars({ ...formulaVars, [formulaValue]: e.target.value })}
                      rows={4}
                      placeholder="Var1&#10;Var2&#10;..."
                      className="w-full px-3 py-2 bg-background-dark dark:bg-background-light border border-glass-border-dark dark:border-glass-border-light rounded-lg font-mono text-sm text-black dark:text-white"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            {selectedFormulas.length > 0 ? '2. Nhập các biến cho dòng BY (mỗi biến 1 dòng):' : '2. Nhập các biến cho dòng BY (mỗi biến 1 dòng):'}
          </label>
          <textarea
            value={byVars}
            onChange={(e) => setByVars(e.target.value)}
            rows={6}
            placeholder="Gender&#10;Age_Group"
            className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg font-mono text-sm text-black dark:text-white"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={selectedFormulas.length === 0}
          className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Tạo cú pháp V2
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-white dark:text-black">
          1. Chọn công thức:
        </label>
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full px-4 py-3 bg-glass-panel border-2 border-glass-border-dark dark:border-glass-border-light rounded-lg text-left flex items-center justify-between text-white dark:text-black hover:border-primary/50 transition-all shadow-sm"
          >
            <span className="text-sm font-medium text-white dark:text-black">
              {selectedFormulas.length > 0 
                ? `Đã chọn ${selectedFormulas.length} công thức` 
                : 'Chọn công thức'}
            </span>
            <ChevronDown className={`size-5 transition-transform text-white dark:text-black ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {dropdownOpen && (
            <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-72 overflow-y-auto custom-scrollbar">
              {formulas.map((formula) => {
                const isSelected = selectedFormulas.includes(formula.value)
                return (
                  <label
                    key={formula.value}
                    className={`flex items-center gap-3 p-4 cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-primary/20 border-l-4 border-primary' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 border-l-4 border-transparent'
                    } border-b border-gray-200 dark:border-gray-700 last:border-b-0`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleFormulaToggle(formula.value)}
                      className="w-4 h-4 rounded border-2 border-gray-400 dark:border-gray-500 checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary/50"
                    />
                    <span className={`text-sm font-medium flex-1 ${
                      isSelected 
                        ? 'text-primary' 
                        : 'text-black dark:text-white'
                    }`}>
                      {formula.text}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            2. Nhập các biến cho dòng BY (mỗi biến 1 dòng):
          </label>
          <textarea
            value={byVars}
            onChange={(e) => setByVars(e.target.value)}
            rows={6}
            placeholder="Gender&#10;Age_Group"
            className="w-full px-3 py-2 bg-glass-panel border border-glass-border-dark dark:border-glass-border-light rounded-lg font-mono text-sm text-black dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white dark:text-black">
            3. Biến cho từng công thức (mỗi biến 1 dòng):
          </label>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {selectedFormulas.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-600 p-2">
                Hãy chọn ít nhất một công thức. Mỗi công thức sẽ có một ô để nhập biến.
              </p>
            ) : (
              selectedFormulas.map((formulaValue) => {
                const formula = formulas.find(f => f.value === formulaValue)
                return (
                  <div key={formulaValue} className="p-3 bg-glass-panel rounded-lg border border-glass-border-dark dark:border-glass-border-light">
                    <label className="block text-xs font-medium mb-2 text-white dark:text-black">
                      Biến áp dụng cho công thức: {formula?.text}
                    </label>
                    <textarea
                      value={formulaVars[formulaValue] || ''}
                      onChange={(e) => setFormulaVars({ ...formulaVars, [formulaValue]: e.target.value })}
                      rows={4}
                      placeholder="Var1&#10;Var2&#10;..."
                      className="w-full px-3 py-2 bg-background-dark dark:bg-background-light border border-glass-border-dark dark:border-glass-border-light rounded-lg font-mono text-sm text-black dark:text-white"
                    />
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={selectedFormulas.length === 0}
        className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        Tạo cú pháp V2
      </button>
    </div>
  )
}
