'use client'

import { useState, useMemo } from 'react'
import { useSurveyStore } from '@/store/surveyStore'
import MainLayout from '@/components/Layout/MainLayout'
import { getChildVariables } from '@/lib/processingHelpers'
import { Search, BookOpen, FileText } from 'lucide-react'
import { sortQuestionsByIdWithPrefix } from '@/lib/syntaxGenerator'
import { ParsedQuestion } from '@/lib/types'

const metadataCardClass = 'bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-gray-300 dark:border-gray-600 shadow-inner max-h-36 overflow-y-auto custom-scrollbar'

function CodeframeCell({ question }: { question: ParsedQuestion }) {
  const hasOptions = question.options && question.options.length > 0
  const hasRows = question.rows && question.rows.length > 0
  const hasColumns = question.columns && question.columns.length > 0

  if (!hasOptions && !hasRows && !hasColumns) {
    return <span className="text-xs text-muted-foreground italic">—</span>
  }

  const listItemClass = 'flex items-baseline gap-2 text-xs text-gray-700 dark:text-gray-300 space-y-1'
  const codeClass = 'font-mono text-muted-foreground shrink-0'

  return (
    <div className="max-h-48 overflow-y-auto custom-scrollbar">
      {hasOptions && (
        <div className="mb-4">
          <div className={metadataCardClass}>
            <span className="font-semibold text-foreground mb-2 block text-sm">Options:</span>
            <div className="space-y-1">
              {question.options!.map((option, i) => (
                <div key={i} className={listItemClass}>
                  <span className={codeClass}>[{String(option.code)}]</span>
                  <span className="truncate">{option.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {(hasRows || hasColumns) && (
        <div className={`grid gap-4 w-full ${hasRows && hasColumns ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {hasRows && (
            <div className={metadataCardClass}>
              <span className="font-semibold text-gray-900 dark:text-white mb-2 block text-sm">Dòng (Rows):</span>
              <div className="space-y-1">
                {question.rows!.map((row, i) => (
                  <div key={i} className={listItemClass}>
                    <span className={codeClass}>[{String(row.code)}]</span>
                    <span className="truncate text-gray-700 dark:text-gray-300">{row.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {hasColumns && (
            <div className={metadataCardClass}>
              <span className="font-semibold text-gray-900 dark:text-white mb-2 block text-sm">Cột (Columns):</span>
              <div className="space-y-1">
                {question.columns!.map((col, i) => (
                  <div key={i} className={listItemClass}>
                    <span className={codeClass}>[{String(col.code)}]</span>
                    <span className="truncate text-gray-700 dark:text-gray-300">{col.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DataDictionary() {
  const { parsedQuestions, oldVariableMapping } = useSurveyStore()
  const [searchQuery, setSearchQuery] = useState('')

  const questions = useMemo(() => {
    return sortQuestionsByIdWithPrefix(parsedQuestions)
  }, [parsedQuestions])

  const filteredQuestions = useMemo(() => {
    if (!searchQuery.trim()) return questions
    const q = searchQuery.toLowerCase()
    return questions.filter(
      (question) =>
        question.id.toLowerCase().includes(q) ||
        question.label.toLowerCase().includes(q)
    )
  }, [questions, searchQuery])

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto custom-scrollbar h-full p-6 flex flex-col min-h-0">
        <header className="sticky top-0 z-10 bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark pb-4 pt-4 -mx-6 mb-6 px-6 shrink-0">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-foreground" />
                <span className="font-semibold text-foreground">Data Dictionary</span>
                {questions.length > 0 && (
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                    {questions.length} questions
                  </span>
                )}
              </div>
            </div>

            {questions.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by Question ID or Label..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
                />
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 min-h-0">
          {questions.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="size-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto mb-6">
                  <FileText className="size-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  No Questions Loaded
                </h2>
                <p className="text-muted-foreground mb-6">
                  Import an Excel file from Data Import or Questions to build the variable mapping.
                </p>
              </div>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-muted-foreground">
                No questions match your search.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse table-fixed" style={{ minWidth: 900 }}>
                  <colgroup>
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '20%' }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Question ID & Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Question Label
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Old Variables (Raw)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        New Variables (SPSS Output)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                        Codeframe & Values
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuestions.map((question) => {
                      const oldVars = oldVariableMapping[question.id] || []
                      const { varNames } = getChildVariables(question, oldVariableMapping)

                      return (
                        <tr
                          key={question.id}
                          className="border-b border-border-light dark:border-border-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors last:border-b-0"
                        >
                          <td className="px-4 py-3 align-top">
                            <span className="font-mono text-sm font-medium text-foreground">
                              {question.id}
                            </span>
                            <span className="text-muted-foreground text-xs ml-1">
                              ({question.type})
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top overflow-hidden">
                            <span
                              className="text-sm text-foreground line-clamp-3 break-words block min-w-0"
                              title={question.label}
                            >
                              {question.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-wrap gap-1">
                              {oldVars.length > 0 ? (
                                oldVars.map((v, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex px-2 py-0.5 text-xs rounded bg-surface-light dark:bg-surface-dark text-muted-foreground border border-border-light dark:border-border-dark"
                                  >
                                    {v}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  —
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-wrap gap-1">
                              {varNames.length > 0 ? (
                                varNames.map((v, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex px-2 py-0.5 text-xs rounded bg-primary/10 text-primary border border-primary/20"
                                  >
                                    {v}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  —
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <CodeframeCell question={question} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
