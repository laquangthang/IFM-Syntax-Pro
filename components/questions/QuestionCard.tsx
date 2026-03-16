'use client'

import { motion } from 'framer-motion'
import { ParsedQuestion, QuestionOption } from '@/lib/types'
import { useSurveyStore } from '@/store/surveyStore'
import { getOtherOutputVariableNames } from '@/lib/utils/mrHelpers'
import { 
  ChevronDown, 
  ChevronUp,
  Hash,
  Type,
  FileText,
  List,
  Grid,
  Code,
  Zap,
  AlertCircle,
  CheckCircle2,
  Edit,
  Plus,
  Link2,
} from 'lucide-react'
import { useState, forwardRef } from 'react'

// Component for displaying SA_Grid rows with expandable options
function SAGridRowsDisplay({ 
  question, 
  onUpdate
}: {
  question: ParsedQuestion
  onUpdate?: (updatedQuestion: ParsedQuestion) => void
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  
  const toggleRow = (rowIndex: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(rowIndex)) {
      newExpanded.delete(rowIndex)
    } else {
      newExpanded.add(rowIndex)
    }
    setExpandedRows(newExpanded)
  }
  
  const getRowOptions = (rowIndex: string | number): QuestionOption[] => {
    if (!question.rowOptionsMap) return []
    const indexStr = String(rowIndex)
    return question.rowOptionsMap[indexStr] || []
  }
  
  const updateRowOptions = (rowIndex: string | number, updatedOptions: QuestionOption[]) => {
    if (!onUpdate) return
    const indexStr = String(rowIndex)
    const newRowOptionsMap = { ...question.rowOptionsMap }
    newRowOptionsMap[indexStr] = updatedOptions
    onUpdate({ ...question, rowOptionsMap: newRowOptionsMap })
  }
  
  return (
    <div className="space-y-2 mb-4">
      <div className="rounded-lg border border-border-light dark:border-border-dark overflow-hidden bg-surface-light dark:bg-surface-dark">
        <div className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark px-3 py-2">
          <span className="text-xs font-mono text-muted-foreground">SUB-QUESTIONS (Click to view codes)</span>
        </div>
        {question.rows && question.rows.map((row, idx) => {
          const rowIndex = String(row.code)
          const isExpanded = expandedRows.has(rowIndex)
          const rowOptions = getRowOptions(row.code)
          
          return (
            <div key={idx} className="border-b border-border-light dark:border-border-dark last:border-b-0">
              {/* Row Header - Clickable */}
              <div
                onClick={() => toggleRow(rowIndex)}
                className="grid grid-cols-[40px_60px_1fr] gap-0 items-center px-3 py-2 group hover:bg-surface-light dark:hover:bg-surface-dark transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-center">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <span className="text-primary font-bold font-mono text-sm">{row.code}</span>
                <input
                  type="text"
                  value={row.label}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    if (!onUpdate) return
                    const updatedRows = [...question.rows!]
                    updatedRows[idx] = {
                      ...updatedRows[idx],
                      label: e.target.value
                    }
                    onUpdate({ ...question, rows: updatedRows })
                  }}
                  className="w-full bg-transparent text-sm text-white border-none focus:ring-0 p-0"
                />
                {rowOptions.length > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({rowOptions.length} codes)
                  </span>
                )}
              </div>
              
              {/* Expanded Options for this Row */}
              {isExpanded && rowOptions.length > 0 && (
                <div className="bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark">
                  {/* Table Header */}
                  <div className="grid grid-cols-[60px_1fr] gap-0 bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark px-3 py-2">
                    <span className="text-xs font-mono text-muted-foreground">CODE</span>
                    <span className="text-xs font-mono text-muted-foreground">LABEL</span>
                  </div>
                  
                  {/* Table Rows */}
                  {rowOptions.map((option, optIdx) => (
                    <div
                      key={optIdx}
                      className="grid grid-cols-[60px_1fr] gap-0 border-b border-border-light dark:border-border-dark items-center px-3 py-1.5 hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
                    >
                      <input
                        type="text"
                        value={option.code}
                        onChange={(e) => {
                          const updatedOptions = [...rowOptions]
                          updatedOptions[optIdx] = {
                            ...updatedOptions[optIdx],
                            code: isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)
                          }
                          updateRowOptions(row.code, updatedOptions)
                        }}
                        className="w-10 bg-transparent text-center font-mono text-sm text-primary font-bold border-none focus:ring-0 p-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <input
                        type="text"
                        value={option.label}
                        onChange={(e) => {
                          const updatedOptions = [...rowOptions]
                          updatedOptions[optIdx] = {
                            ...updatedOptions[optIdx],
                            label: e.target.value
                          }
                          updateRowOptions(row.code, updatedOptions)
                        }}
                        className="w-full bg-transparent text-sm text-white border-none focus:ring-0 p-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ))}
                </div>
              )}
              {isExpanded && rowOptions.length === 0 && (
                <div className="bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark px-3 py-2 text-xs text-muted-foreground">
                  No codes found for this sub-question
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface QuestionCardProps {
  question: ParsedQuestion
  isExpanded: boolean
  onToggle: () => void
  index: number
  onUpdate?: (updatedQuestion: ParsedQuestion) => void
}

const QuestionCard = forwardRef<HTMLDivElement, QuestionCardProps>(
  function QuestionCard({ question, isExpanded, onToggle, index, onUpdate }, ref) {
  const { parsedQuestions, setEditingQuestionId } = useSurveyStore()
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editedLabel, setEditedLabel] = useState(question.label)
  
  
  // Sync columns from piping source for display
  const displayColumns = (() => {
    if (question.logic?.piping_source && (question.type === 'MA_Grid' || question.type === 'SA_Grid')) {
      const sourceQuestion = parsedQuestions.find((q: ParsedQuestion) => q.id === question.logic?.piping_source)
      if (sourceQuestion) {
        const isSourceGrid = sourceQuestion.type === 'MA_Grid' || sourceQuestion.type === 'SA_Grid'
        if (isSourceGrid && sourceQuestion.rows && sourceQuestion.rows.length > 0) {
          // Use rows from source Grid question as columns
          return sourceQuestion.rows
        }
      }
    }
    // Return original columns if no piping or piping source not found
    return question.columns
  })()
  
  
  // Get human-readable question type labels
  const getQuestionTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      SA: 'Single Answer (SA)',
      MA: 'Multiple Answer (MA)',
      SA_Grid: 'Grid / Matrix (SA)',
      MA_Grid: 'Grid / Matrix (MA)',
      Rank_Fixed: 'Ranking (Fixed)',
      Rank_Upto: 'Ranking (Up to)',
      OE: 'Open Ended',
      OE_Grid: 'Open Ended Grid',
      Numeric: 'Numeric',
    }
    return labels[type] || type
  }

  // Handle label update
  const handleLabelUpdate = () => {
    if (onUpdate && editedLabel !== question.label) {
      onUpdate({ ...question, label: editedLabel })
    }
    setIsEditingLabel(false)
  }

  // Handle question type change
  const handleTypeChange = (newType: ParsedQuestion['type']) => {
    if (onUpdate) {
      onUpdate({ ...question, type: newType })
    }
  }

  // Handle exclusive/trap toggle for option
  const handleExclusiveToggle = (optionIndex: number, isExclusive: boolean) => {
    if (!onUpdate || !question.options) return
    
    const updatedOptions = [...question.options]
    updatedOptions[optionIndex] = {
      ...updatedOptions[optionIndex],
      codeType: isExclusive ? 'Exclusive' : 'Normal'
    }
    
    onUpdate({ ...question, options: updatedOptions })
  }
  
  // Handle trap toggle separately (for direct trap toggle)
  const handleTrapToggle = (optionIndex: number, isTrap: boolean) => {
    if (!onUpdate || !question.options) return
    
    const updatedOptions = [...question.options]
    updatedOptions[optionIndex] = {
      ...updatedOptions[optionIndex],
      codeType: isTrap ? 'Trap' : 'Normal'
    }
    
    onUpdate({ ...question, options: updatedOptions })
  }

  // Handle terminate toggle
  const handleTerminateToggle = (optionIndex: number, isTerminate: boolean) => {
    if (!onUpdate || !question.options) return
    
    const updatedOptions = [...question.options]
    updatedOptions[optionIndex] = {
      ...updatedOptions[optionIndex],
      codeType: isTerminate ? 'Terminate' : 'Normal'
    }
    
    onUpdate({ ...question, options: updatedOptions })
  }

  // Add new option
  const handleAddOption = () => {
    if (!onUpdate || !question.options) return
    
    const last = question.options.length > 0 ? question.options[question.options.length - 1] : undefined
    const newCode: number =
      last && typeof last.code === 'number'
        ? last.code + 1
        : question.options.length + 1
    
    const newOption: QuestionOption = {
      code: newCode,
      label: '',
      codeType: 'Normal'
    }
    
    onUpdate({ ...question, options: [...question.options, newOption] })
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      SA: 'bg-primary/10 text-primary border-primary/30',
      MA: 'bg-primary/10 text-primary border-primary/30',
      SA_Grid: 'bg-primary/10 text-primary border-primary/30',
      MA_Grid: 'bg-primary/10 text-primary border-primary/30',
      Rank_Fixed: 'bg-primary/10 text-primary border-primary/30',
      Rank_Upto: 'bg-primary/10 text-primary border-primary/30',
      OE: 'bg-primary/10 text-primary border-primary/30',
      Numeric: 'bg-primary/10 text-primary border-primary/30',
    }
    return colors[type] || 'bg-surface-light dark:bg-surface-dark text-muted-foreground border-border-light dark:border-border-dark'
  }

  const getTypeIcon = (type: string) => {
    if (type.includes('Grid')) return Grid
    if (type.includes('Rank')) return List
    if (type === 'OE' || type === 'Numeric') return Code
    return List
  }

  const TypeIcon = getTypeIcon(question.type)

  const getLogicBadges = () => {
    const logic = question.logic
    const badges: Array<{ key: string; label: string; className: string }> = []

    const askIf = (logic?.ask_if_condition || '').trim()
    const terminateIf = (logic?.terminate_if || '').trim()

    if (logic?.type && logic.type !== 'Normal') {
      badges.push({
        key: 'type',
        label: `Type: ${logic.type}`,
        className: 'bg-primary/10 text-primary border-primary/30',
      })
    }

    // Piping can be "set" via either logic.type === 'Piping' or piping_source present
    if (logic?.type === 'Piping' || logic?.piping_source) {
      badges.push({
        key: 'piping',
        label: logic?.piping_source ? `Piping: ${logic.piping_source}` : 'Piping',
        className: 'bg-primary/10 text-primary border-primary/30',
      })
    }

    if (askIf.length > 0) {
      // Try to show source in short form if available
      const src = askIf.match(/\b(Q\d+(?:\.\d+)?[A-Z]?)\b/i)?.[1]
      badges.push({
        key: 'ask_if',
        label: src ? `Ask If: ${src.toUpperCase()}` : 'Ask If',
        className: 'bg-primary/10 text-primary border-primary/30',
      })
    }

    if (terminateIf.length > 0) {
      badges.push({
        key: 'terminate',
        label: 'Terminate If',
        className: 'bg-red-500/10 text-red-500 border-red-500/30',
      })
    }

    // Option-level logic badges (Exclusive/Trap/Terminate/Other) - also count on rows/columns if present
    // Use displayColumns for synced columns from piping source
    const allOptions: QuestionOption[] = [
      ...(question.options || []),
      ...(question.rows || []),
      ...(displayColumns || []),
    ]

    const counts = allOptions.reduce(
      (acc, opt) => {
        const t = opt.codeType || 'Normal'
        if (t === 'Exclusive') acc.exclusive++
        else if (t === 'Trap') acc.trap++
        else if (t === 'Terminate') acc.terminateOpt++
        else if (t === 'Other') acc.other++
        return acc
      },
      { exclusive: 0, trap: 0, terminateOpt: 0, other: 0 }
    )

    if (counts.exclusive > 0) {
      badges.push({
        key: 'exclusive_opt',
        label: `Exclusive: ${counts.exclusive}`,
        className: 'bg-primary/10 text-primary border-primary/30',
      })
    }
    if (counts.trap > 0) {
      badges.push({
        key: 'trap_opt',
        label: `Trap: ${counts.trap}`,
        className: 'bg-red-500/10 text-red-300 border-red-500/30',
      })
    }
    if (counts.terminateOpt > 0) {
      badges.push({
        key: 'terminate_opt',
        label: `Terminate Opt: ${counts.terminateOpt}`,
        className: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      })
    }
    if (counts.other > 0) {
      const otherOutputNames = getOtherOutputVariableNames(question)
      const suffixText = otherOutputNames.length > 0
        ? ` (${otherOutputNames.join(', ')})`
        : ''
      badges.push({
        key: 'other_opt',
        label: `Other: ${counts.other}${suffixText}`,
        className: 'bg-primary/10 text-primary border-primary/30',
      })
    }

    return badges
  }

  const logicBadges = getLogicBadges()

  // Format logic for display
  const formatLogic = () => {
    if (!question.logic) return null
    
    const parts: string[] = []
    if (question.logic.type && question.logic.type !== 'Normal') {
      parts.push(`Type: ${question.logic.type}`)
    }
    if (question.logic.piping_source) {
      parts.push(`Piping: ${question.logic.piping_source}`)
    }
    if (question.logic.ask_if_condition) {
      parts.push('Ask If')
    }
    if (question.logic.terminate_if) {
      parts.push(`Terminate: ${question.logic.terminate_if}`)
    }
    
    return parts.length > 0 ? parts.join(' | ') : null
  }

  const logicText = formatLogic()

  // Get options/rows/columns for table
  const getTableData = () => {
    if (question.options && question.options.length > 0) {
      return question.options.map(opt => ({
        code: opt.code ?? '-',
        label: opt.label ?? '',
        logicOption: opt.codeType && opt.codeType !== 'Normal' ? opt.codeType : '-'
      }))
    }
    
    // For Grid questions, show rows first
    if (question.rows && question.rows.length > 0) {
      return question.rows.map(row => ({
        code: row.code ?? '-',
        label: row.label ?? '',
        logicOption: row.codeType && row.codeType !== 'Normal' ? row.codeType : '-'
      }))
    }
    
    if (question.columns && question.columns.length > 0) {
      return question.columns.map(col => ({
        code: col.code ?? '-',
        label: col.label ?? '',
        logicOption: col.codeType && col.codeType !== 'Normal' ? col.codeType : '-'
      }))
    }
    
    return []
  }

  const tableData = getTableData()

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.05 }}
      className={`relative z-10 bg-surface-dark rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.3)] border-l-4 ${
        isExpanded ? 'border-primary' : 'border-surface-border'
      } ring-1 ring-surface-border/50 group`}
      style={{ pointerEvents: 'auto' }}
    >
      {/* Collapsed Header */}
      {!isExpanded && (
        <div 
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            try {
              onToggle()
            } catch (error) {
              console.error(`[QuestionCard] Error calling onToggle:`, error)
            }
          }}
          className="relative z-20 p-5 cursor-pointer hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggle()
            }
          }}
          style={{ pointerEvents: 'auto', userSelect: 'none' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 text-primary rounded-lg flex items-center justify-center font-bold text-sm border border-primary/30">
                {question.id}
              </div>
              <div>
                <h3 className="text-white font-semibold">{question.label}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {getQuestionTypeLabel(question.type)} • {question.options?.length || 0} Options
                </p>
              </div>
            </div>
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-5">
          {/* Question ID and Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="w-12 h-12 bg-primary/20 text-primary rounded-lg flex items-center justify-center font-bold text-base border border-primary/30">
              {question.id}
            </div>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggle()
              }}
              className="p-2 hover:bg-surface-light dark:hover:bg-surface-dark rounded-lg text-muted-foreground hover:text-foreground transition"
              aria-label="Collapse question"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          </div>

          {/* Question Label - Editable */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Question Label
            </label>
            {isEditingLabel ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedLabel}
                  onChange={(e) => setEditedLabel(e.target.value)}
                  onBlur={handleLabelUpdate}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLabelUpdate()
                    if (e.key === 'Escape') {
                      setEditedLabel(question.label)
                      setIsEditingLabel(false)
                    }
                  }}
                  className="flex-1 bg-transparent border-b border-border-light dark:border-border-dark focus:border-primary px-0 py-1 text-lg font-semibold text-foreground focus:outline-none transition-colors"
                  autoFocus
                />
              </div>
            ) : (
              <div
                onClick={() => setIsEditingLabel(true)}
                className="w-full bg-transparent border-b border-surface-border hover:border-primary px-0 py-1 text-lg font-semibold text-white cursor-text transition-colors"
              >
                {question.label}
              </div>
            )}
          </div>

          {/* Question Type and Logic Settings */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Question Type
              </label>
              <div className="relative">
                <select
                  value={question.type}
                  onChange={(e) => handleTypeChange(e.target.value as ParsedQuestion['type'])}
                  className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors appearance-none cursor-pointer"
                >
                  <option value="SA">Single Answer (SA)</option>
                  <option value="MA">Multiple Answer (MA)</option>
                  <option value="SA_Grid">Grid / Matrix (SA)</option>
                  <option value="MA_Grid">Grid / Matrix (MA)</option>
                  <option value="Rank_Fixed">Ranking (Fixed)</option>
                  <option value="Rank_Upto">Ranking (Up to)</option>
                  <option value="OE">Open Ended</option>
                  <option value="OE_Grid">Open Ended Grid</option>
                  <option value="Numeric">Numeric</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Logic Settings
              </label>
              <div className="flex flex-wrap items-center gap-2 min-h-[38px]">
                {logicBadges.length > 0 ? (
                  logicBadges.map((b) => (
                    <span
                      key={b.key}
                      className={`inline-flex items-center px-2 py-1 rounded border text-xs font-medium ${b.className}`}
                      title={b.label}
                    >
                      {b.label}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">None</span>
                )}
              </div>
            </div>
          </div>

          {/* Matrix Table for MA_Grid questions with rows and columns */}
          {(question.type === 'MA_Grid' && question.rows && question.rows.length > 0 && displayColumns && displayColumns.length > 0) ? (
            <div className="rounded-lg border border-primary/20 overflow-hidden bg-surface-light dark:bg-surface-dark mb-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  {/* Table Header */}
                  <thead>
                    <tr className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                      <th className="px-3 py-2 text-left text-xs font-mono text-muted-foreground border-r border-border-light dark:border-border-dark">
                        <div className="flex flex-col">
                          <span>CODE</span>
                          <span className="text-[10px] opacity-70">VN</span>
                        </div>
                      </th>
                      {displayColumns.map((column, colIdx) => (
                        <th key={colIdx} className="px-3 py-2 text-center text-xs font-mono text-muted-foreground border-r border-border-light dark:border-border-dark last:border-r-0">
                          <div className="flex flex-col items-center">
                            <span className="text-primary font-bold">{column.code}</span>
                            <span className="text-[10px] opacity-70 mt-1">{column.label}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {/* Table Body */}
                  <tbody>
                    {question.rows.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        className="border-b border-surface-border/50 hover:bg-surface-border/30 transition-colors"
                      >
                        <td className="px-3 py-2 border-r border-border-light dark:border-border-dark">
                          <div className="flex flex-col">
                            <span className="text-primary font-bold font-mono text-sm">{row.code}</span>
                            <span className="text-xs text-white mt-0.5">{row.label}</span>
                          </div>
                        </td>
                        {displayColumns.map((column, colIdx) => (
                          <td
                            key={colIdx}
                            className="px-3 py-2 text-center border-r border-border-light dark:border-border-dark last:border-r-0"
                          >
                            <div className="flex items-center justify-center">
                              <span className="text-primary font-bold font-mono text-sm">
                                {column.code}
                              </span>
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Matrix Info */}
              <div className="px-3 py-2 bg-background-light dark:bg-background-dark border-t border-border-light dark:border-border-dark text-xs text-muted-foreground">
                <span>Matrix: {question.rows.length} rows × {displayColumns.length} columns = {question.rows.length * displayColumns.length} variables</span>
              </div>
            </div>
          ) : question.type === 'SA_Grid' && question.rows && question.rows.length > 0 ? (
            // SA_Grid: Display rows (sub-questions), each row can expand to show its own options
            <SAGridRowsDisplay
              question={question}
              onUpdate={onUpdate}
            />
          ) : question.options && question.options.length > 0 ? (
            <div className="rounded-lg border border-primary/20 overflow-hidden bg-surface-light dark:bg-surface-dark mb-4">
              {/* Table Header */}
              <div className="grid grid-cols-[60px_1fr_120px] gap-0 bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark px-3 py-2">
                <span className="text-xs font-mono text-muted-foreground">CODE</span>
                <span className="text-xs font-mono text-muted-foreground">OPTION LABEL</span>
                <span className="text-xs font-mono text-muted-foreground text-right pr-2">EXCLUSIVE / TRAP / TERMINATE</span>
              </div>
              
              {/* Table Rows */}
              {question.options.map((option, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-[60px_1fr_160px] gap-0 border-b border-border-light dark:border-border-dark items-center px-3 py-1.5 group hover:bg-surface-light dark:hover:bg-surface-dark transition-colors ${
                    option.codeType === 'Exclusive' ? 'bg-primary/5' 
                      : option.codeType === 'Trap' ? 'bg-red-500/10' 
                      : option.codeType === 'Terminate' ? 'bg-amber-500/10' 
                      : ''
                  }`}
                >
                  <input
                    type="text"
                    value={option.code}
                    onChange={(e) => {
                      if (!onUpdate) return
                      const updatedOptions = [...question.options!]
                      updatedOptions[idx] = {
                        ...updatedOptions[idx],
                        code: isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)
                      }
                      onUpdate({ ...question, options: updatedOptions })
                    }}
                    className="w-10 bg-transparent text-center font-mono text-sm text-primary font-bold border-none focus:ring-0 p-0"
                  />
                  <input
                    type="text"
                    value={option.label}
                    onChange={(e) => {
                      if (!onUpdate) return
                      const updatedOptions = [...question.options!]
                      updatedOptions[idx] = {
                        ...updatedOptions[idx],
                        label: e.target.value
                      }
                      onUpdate({ ...question, options: updatedOptions })
                    }}
                    className="w-full bg-transparent text-sm text-white border-none focus:ring-0 p-0"
                  />
                  <div className="flex justify-end pr-2 gap-1">
                    {/* Exclusive Toggle */}
                    <button
                      onClick={() => {
                        if (option.codeType === 'Trap' || option.codeType === 'Terminate') {
                          // If Trap or Terminate, turn off first then switch to Exclusive
                          if (option.codeType === 'Trap') handleTrapToggle(idx, false)
                          if (option.codeType === 'Terminate') handleTerminateToggle(idx, false)
                          handleExclusiveToggle(idx, true)
                        } else {
                          handleExclusiveToggle(idx, option.codeType !== 'Exclusive')
                        }
                      }}
                      className={`transition ${
                        option.codeType === 'Exclusive'
                          ? 'text-primary hover:text-primary/80'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title={option.codeType === 'Exclusive' ? 'Exclusive Option Active' : 'Toggle Exclusive'}
                    >
                      {option.codeType === 'Exclusive' ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17 7H7c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 8H7V9h10v6zm-5-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17 7H7c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 8H7V9h10v6z"/>
                        </svg>
                      )}
                    </button>
                    {/* Trap Toggle */}
                    <button
                      onClick={() => {
                        if (option.codeType === 'Exclusive' || option.codeType === 'Terminate') {
                          // If Exclusive or Terminate, turn off first then switch to Trap
                          if (option.codeType === 'Exclusive') handleExclusiveToggle(idx, false)
                          if (option.codeType === 'Terminate') handleTerminateToggle(idx, false)
                          handleTrapToggle(idx, true)
                        } else {
                          handleTrapToggle(idx, option.codeType !== 'Trap')
                        }
                      }}
                      className={`transition ${
                        option.codeType === 'Trap'
                          ? 'text-red-500 hover:text-red-400'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title={option.codeType === 'Trap' ? 'Trap Option Active' : 'Toggle Trap'}
                    >
                      {option.codeType === 'Trap' ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </button>
                    {/* Terminate Toggle */}
                    <button
                      onClick={() => {
                        if (option.codeType === 'Exclusive' || option.codeType === 'Trap') {
                          // If Exclusive or Trap, turn off first then switch to Terminate
                          if (option.codeType === 'Exclusive') handleExclusiveToggle(idx, false)
                          if (option.codeType === 'Trap') handleTrapToggle(idx, false)
                          handleTerminateToggle(idx, true)
                        } else {
                          handleTerminateToggle(idx, option.codeType !== 'Terminate')
                        }
                      }}
                      className={`transition ${
                        option.codeType === 'Terminate'
                          ? 'text-amber-500 hover:text-amber-400'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title={option.codeType === 'Terminate' ? 'Terminate Option Active' : 'Toggle Terminate'}
                    >
                      {option.codeType === 'Terminate' ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (question.type === 'MA' || question.type === 'MA_Grid') ? (
            <div className="p-6 text-center text-muted-foreground text-sm mb-4">
              <div className="mb-2">No matrix structure detected (missing rows or columns)</div>
              {question.rows && question.rows.length > 0 && (
                <div className="text-xs opacity-70">Rows: {question.rows.length} found</div>
              )}
              {displayColumns && displayColumns.length > 0 && (
                <div className="text-xs opacity-70">Columns: {displayColumns.length} found</div>
              )}
              {(!question.rows || question.rows.length === 0) && (!displayColumns || displayColumns.length === 0) && (
                <div className="text-xs opacity-70 mt-2">This MA question needs rows and columns to display as a matrix</div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground text-sm mb-4">
              No options available for this question type
            </div>
          )}

          {/* Add Option Button */}
          {question.options && question.type !== 'SA_Grid' && (
            <div className="mt-2 flex justify-start mb-6">
              <button
                onClick={handleAddOption}
                className="flex items-center gap-1 text-xs text-primary font-bold hover:text-white transition px-2 py-1 rounded hover:bg-primary/20"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </button>
            </div>
          )}

          {/* Footer with Logic Summary and Link Logic */}
          <div className="px-5 py-3 bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark rounded-b-xl flex justify-between items-center relative z-10">
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="w-4 h-4 text-primary shrink-0" />
              <div className="flex flex-wrap items-center gap-2">
                {logicBadges.length > 0 ? (
                  logicBadges.map((b) => (
                    <span
                      key={`footer_${b.key}`}
                      className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium ${b.className}`}
                      title={b.label}
                    >
                      {b.label}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No logic set</span>
                )}
              </div>
            </div>
            <button
              onClick={() => setEditingQuestionId(question.id)}
              className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Link2 className="w-4 h-4" />
              Link Logic
            </button>
          </div>
        </div>
      )}


      {/* Edit Modal is global (MainLayout) - opened via setEditingQuestionId(question.id) */}
    </motion.div>
  )
})

export default QuestionCard

