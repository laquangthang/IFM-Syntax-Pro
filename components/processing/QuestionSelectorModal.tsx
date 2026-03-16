'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { ParsedQuestion } from '@/lib/types'

interface QuestionSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (questionId: string | string[]) => void
  parsedQuestions: ParsedQuestion[]
  multiSelect: boolean
  title?: string
  initialSelection?: string | string[]
}

export default function QuestionSelectorModal({
  isOpen,
  onClose,
  onSelect,
  parsedQuestions,
  multiSelect,
  title = 'Select Question',
  initialSelection,
}: QuestionSelectorModalProps) {
  const [search, setSearch] = useState('')
  const [pendingSelection, setPendingSelection] = useState<string | string[]>(
    () => {
      if (initialSelection !== undefined) {
        return initialSelection
      }
      return multiSelect ? [] : ''
    }
  )

  // Sync pending selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setPendingSelection(
        initialSelection !== undefined
          ? initialSelection
          : multiSelect
            ? []
            : ''
      )
    }
  }, [isOpen, initialSelection, multiSelect])

  const filteredQuestions = useMemo(() => {
    if (!search.trim()) return parsedQuestions
    const q = search.toLowerCase().trim()
    return parsedQuestions.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q)
    )
  }, [parsedQuestions, search])

  const handleRowClick = (questionId: string) => {
    if (multiSelect) {
      const current = Array.isArray(pendingSelection) ? pendingSelection : []
      const next = current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId]
      setPendingSelection(next)
    } else {
      setPendingSelection(questionId)
    }
  }

  const handleConfirm = () => {
    onSelect(pendingSelection)
    setSearch('')
    setPendingSelection(multiSelect ? [] : '')
    onClose()
  }

  const handleCancel = () => {
    setSearch('')
    setPendingSelection(multiSelect ? [] : '')
    onClose()
  }

  const isSelected = (id: string) => {
    if (multiSelect && Array.isArray(pendingSelection)) {
      return pendingSelection.includes(id)
    }
    return pendingSelection === id
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleCancel}
        aria-hidden="true"
      />
      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            type="button"
            onClick={handleCancel}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Search bar - sticky */}
        <div className="sticky top-0 z-10 px-4 py-3 bg-gray-900 border-b border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by Variable (ID) or Label..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
            />
          </div>
        </div>

        {/* Body - scrollable table */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
          {filteredQuestions.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              {parsedQuestions.length === 0
                ? 'No questions available. Please import data first.'
                : 'No questions match your search.'}
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-800 border-b border-gray-700">
                <tr>
                  {multiSelect && (
                    <th className="w-12 px-4 py-3 text-left">
                      <span className="sr-only">Select</span>
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Variable (ID)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Label
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredQuestions.map((q) => {
                  const selected = isSelected(q.id)
                  return (
                    <tr
                      key={q.id}
                      onClick={() => handleRowClick(q.id)}
                      className={`border-b border-gray-800 cursor-pointer transition-colors ${
                        selected
                          ? 'bg-primary/20 hover:bg-primary/25'
                          : 'hover:bg-gray-800/80'
                      }`}
                    >
                      {multiSelect && (
                        <td className="w-12 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => handleRowClick(q.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-2 border-gray-500 checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary/50"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span
                          className={`font-mono text-sm font-medium ${
                            selected ? 'text-primary' : 'text-white'
                          }`}
                        >
                          {q.id}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded">
                          {q.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-300 line-clamp-2">
                          {q.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-700 bg-gray-900/95">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={
              multiSelect
                ? !Array.isArray(pendingSelection) || pendingSelection.length === 0
                : !pendingSelection
            }
            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  )
}
