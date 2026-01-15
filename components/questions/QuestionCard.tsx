'use client'

import { motion } from 'framer-motion'
import { ParsedQuestion, QuestionOption } from '@/lib/geminiParser'
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
  CheckCircle
} from 'lucide-react'
import { useState } from 'react'
import EditQuestionModal from './EditQuestionModal'

interface QuestionCardProps {
  question: ParsedQuestion
  isExpanded: boolean
  onToggle: () => void
  index: number
  onUpdate?: (updatedQuestion: ParsedQuestion) => void
}

export default function QuestionCard({ question, isExpanded, onToggle, index, onUpdate }: QuestionCardProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editedLabel, setEditedLabel] = useState(question.label)
  const [isMandatory, setIsMandatory] = useState(false) // Placeholder for mandatory field
  
  // Debug log for render (only for MA questions to reduce noise)
  if ((question.type === 'MA' || question.type === 'MA_Grid') && isExpanded) {
    console.log(`🎴 [QuestionCard] Render - ID: ${question.id}, Type: ${question.type}, isExpanded: ${isExpanded}`)
    console.log(`📊 [QuestionCard] Rows:`, question.rows)
    console.log(`📊 [QuestionCard] Columns:`, question.columns)
    console.log(`📊 [QuestionCard] Options:`, question.options)
  }
  
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

  // Calculate AI confidence (placeholder - you can enhance this)
  const aiConfidence = 98 // Placeholder - could be calculated based on parsing quality

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

  // Handle mandatory toggle
  const handleMandatoryToggle = (checked: boolean) => {
    setIsMandatory(checked)
    // You can add this to question logic or a new field if needed
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
    
    const newCode = question.options.length > 0 
      ? (typeof question.options[question.options.length - 1].code === 'number'
          ? question.options[question.options.length - 1].code + 1
          : question.options.length + 1)
      : 1
    
    const newOption: QuestionOption = {
      code: newCode,
      label: '',
      codeType: 'Normal'
    }
    
    onUpdate({ ...question, options: [...question.options, newOption] })
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      SA: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      MA: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      SA_Grid: 'bg-green-500/10 text-green-400 border-green-500/30',
      MA_Grid: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
      Rank_Fixed: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
      Rank_Upto: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      OE: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
      Numeric: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    }
    return colors[type] || 'bg-gray-500/10 text-gray-400 border-gray-500/30'
  }

  const getTypeIcon = (type: string) => {
    if (type.includes('Grid')) return Grid
    if (type.includes('Rank')) return List
    if (type === 'OE' || type === 'Numeric') return Code
    return List
  }

  const TypeIcon = getTypeIcon(question.type)

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
            console.log(`🖱️ [QuestionCard] ⚡ CLICK DETECTED on collapsed header - ID: ${question.id}, Type: ${question.type}`)
            console.log('📍 [QuestionCard] Event target:', e.target)
            console.log('📍 [QuestionCard] Current target:', e.currentTarget)
            console.log('📍 [QuestionCard] Event type:', e.type)
            console.log('📍 [QuestionCard] Event bubbles:', e.bubbles)
            e.preventDefault()
            e.stopPropagation()
            console.log(`✅ [QuestionCard] Calling onToggle for: ${question.id}`)
            try {
              onToggle()
              console.log(`✅✅ [QuestionCard] onToggle called successfully for: ${question.id}`)
            } catch (error) {
              console.error(`❌ [QuestionCard] Error calling onToggle:`, error)
            }
          }}
          onMouseDown={(e) => {
            console.log(`🖱️ [QuestionCard] MouseDown on collapsed header - ID: ${question.id}`)
          }}
          onMouseUp={(e) => {
            console.log(`🖱️ [QuestionCard] MouseUp on collapsed header - ID: ${question.id}`)
          }}
          className="relative z-20 p-5 cursor-pointer hover:bg-surface-border/30 transition-colors"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              console.log(`⌨️ [QuestionCard] Keyboard event - ID: ${question.id}, Key: ${e.key}`)
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
                <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">
                  {getQuestionTypeLabel(question.type)} • {question.options?.length || 0} Options
                </p>
              </div>
            </div>
            <ChevronDown className="w-5 h-5 text-gray-400 dark:text-gray-400" />
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
                console.log(`🖱️ [QuestionCard] Click detected on collapse button - ID: ${question.id}`)
                e.preventDefault()
                e.stopPropagation()
                console.log(`✅ [QuestionCard] Calling onToggle to collapse: ${question.id}`)
                onToggle()
              }}
              className="p-2 hover:bg-surface-border rounded-lg text-gray-400 dark:text-gray-400 hover:text-white transition"
              aria-label="Collapse question"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          </div>

          {/* Question Label - Editable */}
          <div className="mb-6">
            <label className="block text-xs text-gray-400 dark:text-gray-400 font-medium mb-1 uppercase tracking-wider">
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
                  className="flex-1 bg-transparent border-b border-surface-border focus:border-primary px-0 py-1 text-lg font-semibold text-white focus:outline-none transition-colors"
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
              <label className="block text-xs text-gray-400 dark:text-gray-400 font-medium mb-1.5">
                Question Type
              </label>
              <div className="relative">
                <select
                  value={question.type}
                  onChange={(e) => handleTypeChange(e.target.value as ParsedQuestion['type'])}
                  className="block w-full pl-3 pr-10 py-2 text-sm bg-[#131118] border border-surface-border text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
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
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 dark:text-gray-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 dark:text-gray-400 font-medium mb-1.5">
                Logic Settings
              </label>
              <div className="flex items-center gap-2 h-[38px]">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMandatory}
                    onChange={(e) => handleMandatoryToggle(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="relative w-9 h-5 bg-surface-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  <span className="ms-2 text-sm font-medium text-gray-300">Mandatory</span>
                </label>
              </div>
            </div>
          </div>

          {/* Matrix Table for MA questions with rows and columns */}
          {((question.type === 'MA' || question.type === 'MA_Grid') && question.rows && question.rows.length > 0 && question.columns && question.columns.length > 0) ? (
            <div className="rounded-lg border border-surface-border overflow-hidden bg-[#131118] mb-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  {/* Table Header */}
                  <thead>
                    <tr className="bg-[#252030] border-b border-surface-border">
                      <th className="px-3 py-2 text-left text-xs font-mono text-gray-400 dark:text-gray-400 border-r border-surface-border">
                        <div className="flex flex-col">
                          <span>CODE</span>
                          <span className="text-[10px] opacity-70">VN</span>
                        </div>
                      </th>
                      {question.columns.map((column, colIdx) => (
                        <th key={colIdx} className="px-3 py-2 text-center text-xs font-mono text-gray-400 dark:text-gray-400 border-r border-surface-border last:border-r-0">
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
                        <td className="px-3 py-2 border-r border-surface-border">
                          <div className="flex flex-col">
                            <span className="text-primary font-bold font-mono text-sm">{row.code}</span>
                            <span className="text-xs text-white mt-0.5">{row.label}</span>
                          </div>
                        </td>
                        {question.columns.map((column, colIdx) => (
                          <td
                            key={colIdx}
                            className="px-3 py-2 text-center border-r border-surface-border last:border-r-0"
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
              <div className="px-3 py-2 bg-[#252030]/50 border-t border-surface-border text-xs text-gray-400 dark:text-gray-400">
                <span>Matrix: {question.rows.length} rows × {question.columns.length} columns = {question.rows.length * question.columns.length} variables</span>
              </div>
            </div>
          ) : question.options && question.options.length > 0 ? (
            <div className="rounded-lg border border-surface-border overflow-hidden bg-[#131118] mb-4">
              {/* Table Header */}
              <div className="grid grid-cols-[60px_1fr_120px] gap-0 bg-[#252030] border-b border-surface-border px-3 py-2">
                <span className="text-xs font-mono text-gray-400 dark:text-gray-400">CODE</span>
                <span className="text-xs font-mono text-gray-400 dark:text-gray-400">OPTION LABEL</span>
                <span className="text-xs font-mono text-gray-400 dark:text-gray-400 text-right pr-2">EXCLUSIVE / TRAP / TERMINATE</span>
              </div>
              
              {/* Table Rows */}
              {question.options.map((option, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-[60px_1fr_160px] gap-0 border-b border-surface-border/50 items-center px-3 py-1.5 group hover:bg-surface-border/30 transition-colors ${
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
                          : 'text-surface-border hover:text-gray-400 dark:hover:text-gray-400'
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
                          : 'text-surface-border hover:text-gray-400 dark:hover:text-gray-400'
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
                          : 'text-surface-border hover:text-gray-400 dark:hover:text-gray-400'
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
            <div className="p-6 text-center text-gray-400 dark:text-gray-400 text-sm mb-4">
              <div className="mb-2">No matrix structure detected (missing rows or columns)</div>
              {question.rows && question.rows.length > 0 && (
                <div className="text-xs opacity-70">Rows: {question.rows.length} found</div>
              )}
              {question.columns && question.columns.length > 0 && (
                <div className="text-xs opacity-70">Columns: {question.columns.length} found</div>
              )}
              {(!question.rows || question.rows.length === 0) && (!question.columns || question.columns.length === 0) && (
                <div className="text-xs opacity-70 mt-2">This MA question needs rows and columns to display as a matrix</div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-gray-400 dark:text-gray-400 text-sm mb-4">
              No options available for this question type
            </div>
          )}

          {/* Add Option Button */}
          {question.options && (
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

          {/* Footer with AI Confidence and Link Logic */}
          <div className="px-5 py-3 bg-[#131118]/50 border-t border-surface-border rounded-b-xl flex justify-between items-center relative z-10">
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-400">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>AI Confidence: {aiConfidence}%</span>
            </div>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Link2 className="w-4 h-4" />
              Link Logic
            </button>
          </div>
        </div>
      )}


      {/* Edit Modal */}
      {onUpdate && (
        <EditQuestionModal
          question={question}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={(updatedQuestion) => {
            onUpdate(updatedQuestion)
            setIsEditModalOpen(false)
          }}
        />
      )}
    </motion.div>
  )
}

