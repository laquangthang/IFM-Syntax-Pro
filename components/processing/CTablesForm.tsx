'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, ChevronDown } from 'lucide-react'
import { ParsedQuestion } from '@/lib/geminiParser'
import { useSurveyStore } from '@/store/surveyStore'
import { getChildVariables } from '@/lib/processingHelpers'

interface CTablesFormProps {
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

export default function CTablesForm({ mode, questions = [], onSyntaxGenerated, onError }: CTablesFormProps) {
  const { oldVariableMapping } = useSurveyStore()
  const [step, setStep] = useState<1 | 2>(1)
  const [allVars, setAllVars] = useState('')
  const [byVars, setByVars] = useState('')
  const [columnVars, setColumnVars] = useState<string[]>([])
  const [selectedFormulas, setSelectedFormulas] = useState<Record<number, string[]>>({})
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

  // Auto-populate from selected questions
  useEffect(() => {
    if (mode === 'auto' && selectedQuestions.length > 0) {
      const selected = questions.filter(q => selectedQuestions.includes(q.id))
      const allVarNames: string[] = []
      
      selected.forEach(q => {
        const { varNames } = getChildVariables(q, oldVariableMapping)
        allVarNames.push(...varNames)
      })
      
      setAllVars(allVarNames.join('\n'))
    } else if (mode === 'auto' && selectedQuestions.length === 0) {
      setAllVars('')
    }
  }, [selectedQuestions, mode, questions, oldVariableMapping])

  const handleStep1 = () => {
    const allVarsList = allVars.trim().split('\n').filter(v => v.trim() !== '')
    const byVarsList = byVars.trim().split('\n').filter(v => v.trim() !== '')
    
    if (allVarsList.length === 0) {
      onError('Vui lòng nhập ít nhất một biến vào ô "TẤT CẢ các biến"')
      return
    }

    const byVarsSet = new Set(byVarsList)
    const columnVarsList = allVarsList.filter(v => !byVarsSet.has(v))
    setColumnVars(columnVarsList)
    setStep(2)
  }

  const handleGenerate = () => {
    if (columnVars.length === 0) {
      onError('Vui lòng hoàn thành bước 1 trước')
      return
    }

    const allFormulaLines: string[] = []
    columnVars.forEach((variable, index) => {
      const formulas = selectedFormulas[index] || []
      formulas.forEach(formula => {
        allFormulaLines.push(variable + formula)
      })
    })

    if (allFormulaLines.length === 0) {
      onError('Vui lòng chọn ít nhất một công thức')
      return
    }

    let processedFormulaLines = ''
    if (allFormulaLines.length > 0) {
      const firstLine = allFormulaLines[0]
      const otherLines = allFormulaLines.slice(1).map(line => `+${line}`)
      processedFormulaLines = [firstLine, ...otherLines].join('\n')
    }

    const byVarsList = byVars.trim().split('\n').filter(v => v.trim() !== '')
    let byLine = ''
    if (byVarsList.length > 0) {
      byLine = `BY (${byVarsList.join(' + ')}) [c]`
    }

    const slabLine = '/slab pos=row'
    
    let catLine1 = ''
    if (byVarsList.length > 0) {
      catLine1 = `/cat var=${byVarsList.join(' ')} order=a key=value empty=include`
    }

    const allVarsList = allVars.trim().split('\n').filter(v => v.trim() !== '')
    const catLine2 = `/cat var=\n${allVarsList.join('\n')}\norder=a key=value empty=include total=yes position=before.`

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

  const toggleFormula = (varIndex: number, formulaValue: string) => {
    const current = selectedFormulas[varIndex] || []
    if (current.includes(formulaValue)) {
      setSelectedFormulas({
        ...selectedFormulas,
        [varIndex]: current.filter(f => f !== formulaValue)
      })
    } else {
      setSelectedFormulas({
        ...selectedFormulas,
        [varIndex]: [...current, formulaValue]
      })
    }
  }

  if (mode === 'auto') {
    return (
      <div className="space-y-4">
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

        {step === 1 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-white dark:text-black">
                  2. TẤT CẢ các biến (tự động điền):
                </label>
                <textarea
                  value={allVars}
                  onChange={(e) => setAllVars(e.target.value)}
                  rows={8}
                  placeholder="Gender&#10;Age_Group&#10;Q1_Brand_Awareness&#10;Q2_Brand_Usage"
                  className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white dark:text-black">
                  3. Nhập các biến cho dòng BY (lấy từ danh sách bên trái):
                </label>
                <textarea
                  value={byVars}
                  onChange={(e) => setByVars(e.target.value)}
                  rows={8}
                  placeholder="Gender&#10;Age_Group"
                  className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
                />
              </div>
            </div>
            <button
              onClick={handleStep1}
              disabled={!allVars.trim()}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Tạo lựa chọn công thức
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-4">
              {columnVars.map((variable, index) => (
                <div key={index} className="p-4 bg-glass-panel rounded-lg border border-glass-border-light dark:border-glass-border-dark">
                  <h3 className="text-sm font-semibold mb-3 text-white dark:text-black">Công thức cho biến cột: "{variable}"</h3>
                  <div className="space-y-2">
                    {formulas.map((formula) => (
                      <label key={formula.value} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={(selectedFormulas[index] || []).includes(formula.value)}
                          onChange={() => toggleFormula(index, formula.value)}
                          className="rounded"
                        />
                        <span className="text-sm text-white dark:text-black">{formula.text}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 px-4 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg hover:bg-white/5 transition-all text-white dark:text-black"
              >
                Quay lại
              </button>
              <button
                onClick={handleGenerate}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
              >
                Tạo cú pháp cuối cùng
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {step === 1 && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-white dark:text-black">
                1. Nhập TẤT CẢ các biến (mỗi biến 1 dòng):
              </label>
              <textarea
                value={allVars}
                onChange={(e) => setAllVars(e.target.value)}
                rows={8}
                placeholder="Gender&#10;Age_Group&#10;Q1_Brand_Awareness&#10;Q2_Brand_Usage"
                className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-white dark:text-black">
                2. Nhập các biến cho dòng BY (lấy từ danh sách bên trái):
              </label>
              <textarea
                value={byVars}
                onChange={(e) => setByVars(e.target.value)}
                rows={8}
                placeholder="Gender&#10;Age_Group"
                className="w-full px-3 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg font-mono text-sm text-black dark:text-white"
              />
            </div>
          </div>
          <button
            onClick={handleStep1}
            className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
          >
            Tạo lựa chọn công thức
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <div className="space-y-4">
            {columnVars.map((variable, index) => (
              <div key={index} className="p-4 bg-glass-panel rounded-lg border border-glass-border-light dark:border-glass-border-dark">
                <h3 className="text-sm font-semibold mb-3 text-white dark:text-black">Công thức cho biến cột: "{variable}"</h3>
                <div className="space-y-2">
                  {formulas.map((formula) => (
                    <label key={formula.value} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={(selectedFormulas[index] || []).includes(formula.value)}
                        onChange={() => toggleFormula(index, formula.value)}
                        className="rounded"
                      />
                      <span className="text-sm text-white dark:text-black">{formula.text}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="flex-1 px-4 py-2 bg-glass-panel border border-glass-border-light dark:border-glass-border-dark rounded-lg hover:bg-white/5 transition-all"
            >
              Quay lại
            </button>
            <button
              onClick={handleGenerate}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              Tạo cú pháp cuối cùng
            </button>
          </div>
        </>
      )}
    </div>
  )
}
