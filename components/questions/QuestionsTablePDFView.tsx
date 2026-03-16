'use client'

import { ParsedQuestion } from '@/lib/types'
import { FileText } from 'lucide-react'

/**
 * Helper to get synced columns from piping source for grid questions
 */
function getSyncedColumns(
  question: ParsedQuestion,
  questionsMap: Map<string, ParsedQuestion>
): ParsedQuestion['columns'] {
  if (question.logic?.piping_source && (question.type === 'MA_Grid' || question.type === 'SA_Grid')) {
    const sourceQuestion = questionsMap.get(question.logic.piping_source)
    if (sourceQuestion) {
      const isSourceGrid = sourceQuestion.type === 'MA_Grid' || sourceQuestion.type === 'SA_Grid'
      if (isSourceGrid && sourceQuestion.rows && sourceQuestion.rows.length > 0) {
        return [...sourceQuestion.rows]
      }
    }
  }
  return question.columns
}

interface QuestionsTablePDFViewProps {
  questions: ParsedQuestion[]
  questionsMap: Map<string, ParsedQuestion>
  pdfZoom: number
  selectedQuestionId: string | null
  expandedQuestions: Set<string>
  onSelectQuestion: (id: string) => void
  onToggleExpand: (id: string) => void
}

export default function QuestionsTablePDFView({
  questions,
  questionsMap,
  pdfZoom,
  selectedQuestionId,
  expandedQuestions,
  onSelectQuestion,
  onToggleExpand,
}: QuestionsTablePDFViewProps) {
  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No questions loaded. Please import questions first.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="w-full h-full overflow-auto bg-surface-light dark:bg-surface-dark"
      style={{ transform: `scale(${pdfZoom / 100})`, transformOrigin: 'top left' }}
    >
      <div className="p-8">
        <div className="text-center border-b border-border-light dark:border-border-dark pb-4 mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">RESEARCH STUDY</h1>
          <p className="text-sm text-muted-foreground">CONFIDENTIAL</p>
        </div>

        <div className="space-y-8">
          {questions.map((question) => {
            const isSelected = selectedQuestionId === question.id
            const displayColumns = getSyncedColumns(question, questionsMap)
            const isMatrixMA =
              (question.type === 'MA' || question.type === 'MA_Grid') &&
              question.rows &&
              question.rows.length > 0 &&
              displayColumns &&
              displayColumns.length > 0

            const tableRows: Array<{ code: string | number; label: string; logic: string }> = []
            if (!isMatrixMA) {
              if (question.options && question.options.length > 0) {
                question.options.forEach((opt) => {
                  let logicText = 'Normal'
                  if (opt.codeType === 'Exclusive') logicText = 'Exclusive'
                  else if (opt.codeType === 'Trap') logicText = 'Trap'
                  else if (opt.codeType === 'Other') logicText = 'Other'
                  else if (opt.codeType === 'Terminate') logicText = 'Terminate'
                  tableRows.push({ code: opt.code, label: opt.label, logic: logicText })
                })
              }
              if (question.rows && question.rows.length > 0 && !question.columns) {
                question.rows.forEach((row) => {
                  tableRows.push({
                    code: row.code,
                    label: row.label,
                    logic: (row.codeType as string) || 'Normal',
                  })
                })
              }
              if (question.columns && question.columns.length > 0 && !question.rows) {
                question.columns.forEach((col) => {
                  tableRows.push({
                    code: col.code,
                    label: col.label,
                    logic: (col.codeType as string) || 'Normal',
                  })
                })
              }
            }

            const handleClick = () => {
              onSelectQuestion(question.id)
              if (!expandedQuestions.has(question.id)) onToggleExpand(question.id)
            }

            if (!isMatrixMA && tableRows.length === 0) {
              return (
                <div
                  key={question.id}
                  className={`p-6 rounded-lg border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-lg'
                      : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:border-primary/30'
                  }`}
                  onClick={handleClick}
                >
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {question.id}. {question.label}
                  </h3>
                  {question.instruction && (
                    <p className="text-sm text-muted-foreground italic mb-3">{question.instruction}</p>
                  )}
                  <p className="text-sm text-muted-foreground">No options available for this question type</p>
                </div>
              )
            }

            return (
              <div
                key={question.id}
                className={`transition-all ${isSelected ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-background-dark' : ''}`}
              >
                <div
                  className={`p-4 rounded-t-lg border-2 border-b-0 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-surface-light dark:hover:bg-surface-dark'
                  }`}
                  onClick={handleClick}
                >
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {question.id}. {question.label}
                  </h3>
                  {question.instruction && (
                    <p className="text-sm text-muted-foreground italic">{question.instruction}</p>
                  )}
                  {question.logic && question.logic.type !== 'Normal' && (
                    <p className="text-xs text-primary mt-2 font-mono">Logic: {question.logic.type}</p>
                  )}
                </div>

                {isMatrixMA ? (
                  <div className="overflow-x-auto border-2 border-t-0 rounded-b-lg border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                          <th className="border-b border-border-light dark:border-border-dark px-4 py-3 text-left font-semibold text-foreground">
                            <div className="flex flex-col">
                              <span>CODE</span>
                              <span className="text-xs font-normal opacity-70">VN</span>
                            </div>
                          </th>
                          {displayColumns.map((col, colIdx) => (
                            <th
                              key={colIdx}
                              className="border-b border-border-light dark:border-border-dark px-4 py-3 text-center font-semibold text-foreground"
                            >
                              <div className="flex flex-col items-center">
                                <span className="font-bold font-mono">{col.code}</span>
                                <span className="text-xs font-normal opacity-70 mt-1">{col.label}</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(question.rows || []).map((row, rowIdx) => (
                          <tr
                            key={rowIdx}
                            className={`border-b border-border-light dark:border-border-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors ${
                              isSelected ? 'bg-primary/5 dark:bg-primary/10' : ''
                            }`}
                            onClick={handleClick}
                          >
                            <td className="border border-border-light dark:border-border-dark px-4 py-2">
                              <div className="flex flex-col">
                                <span className="font-bold font-mono text-sm text-foreground">
                                  {row.code}
                                </span>
                                <span className="text-xs text-muted-foreground mt-0.5">{row.label}</span>
                              </div>
                            </td>
                            {(displayColumns || []).map((col, colIdx) => (
                              <td
                                key={colIdx}
                                className="border border-border-light dark:border-border-dark px-4 py-2 text-center"
                              >
                                <span className="font-bold font-mono text-sm text-foreground">
                                  {col.code}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-4 py-2 bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark text-xs text-muted-foreground">
                      Matrix: {(question.rows || []).length} rows × {displayColumns.length} columns ={' '}
                      {(question.rows || []).length * displayColumns.length} variables
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto border-2 border-t-0 rounded-b-lg border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                          <th className="border-b border-border-light dark:border-border-dark px-4 py-3 text-left font-semibold text-foreground w-32">
                            Code
                          </th>
                          <th className="border-b border-border-light dark:border-border-dark px-4 py-3 text-left font-semibold text-foreground">
                            Label
                          </th>
                          <th className="border-b border-border-light dark:border-border-dark px-4 py-3 text-left font-semibold text-foreground w-32">
                            Logic
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row, index) => (
                          <tr
                            key={`${question.id}-${row.code}-${index}`}
                            className={`cursor-pointer transition-colors hover:bg-surface-light dark:hover:bg-surface-dark ${
                              isSelected ? 'bg-primary/5 dark:bg-primary/10' : ''
                            }`}
                            onClick={handleClick}
                          >
                            <td className="border border-border-light dark:border-border-dark px-4 py-2 font-mono text-sm text-foreground">
                              {row.code}
                            </td>
                            <td className="border border-border-light dark:border-border-dark px-4 py-2 text-foreground">
                              {row.label}
                            </td>
                            <td className="border border-border-light dark:border-border-dark px-4 py-2 text-sm">
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  row.logic === 'Exclusive'
                                    ? 'bg-primary/10 text-primary'
                                    : row.logic === 'Trap'
                                    ? 'bg-red-500/10 text-red-500'
                                    : row.logic === 'Terminate'
                                    ? 'bg-amber-500/10 text-amber-500'
                                    : row.logic === 'Other'
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-surface-light dark:bg-surface-dark text-muted-foreground'
                                }`}
                              >
                                {row.logic}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
