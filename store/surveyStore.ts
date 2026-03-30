import { create } from 'zustand'
import { ParsedQuestion, OldVariableMapping, QuestionOption } from '@/lib/types'

export type { OldVariableMapping }
import { questionsToMap, mapToQuestions } from '@/lib/jsonLoader'
import { QCLogicGraph } from '@/lib/qcLogicTypes'
import { convertQuestionsToQCGraph } from '@/lib/qcGraphConverter'
import { cascadeCodeRename } from '@/lib/utils/cascadeCodeRename'

/** Detect code renames between old and new option/row arrays (same index = same logical item). */
function detectCodeRenames(
  oldItems: QuestionOption[] | undefined,
  newItems: QuestionOption[] | undefined
): Array<{ oldCode: string | number; newCode: string | number }> {
  if (!oldItems || !newItems) return []
  const renames: Array<{ oldCode: string | number; newCode: string | number }> = []
  const len = Math.min(oldItems.length, newItems.length)
  for (let i = 0; i < len; i++) {
    if (String(oldItems[i].code) !== String(newItems[i].code)) {
      renames.push({ oldCode: oldItems[i].code, newCode: newItems[i].code })
    }
  }
  return renames
}

/**
 * Rebuild terminate_if from Trap/Terminate options - no recursive merge.
 * Ensures output is exactly IF (H3AR12 = 12 OR H3AR13 = 13).
 */
function autoConvertTerminateOptions(questions: ParsedQuestion[]): ParsedQuestion[] {
  return questions.map(question => {
    const opts = (question.options || []).filter(o => o.codeType === 'Trap' || o.codeType === 'Terminate')
    const rows = (question.rows || []).filter(r => r.codeType === 'Trap' || r.codeType === 'Terminate')
    const arr = question.type === 'MA_Grid' || question.type === 'SA_Grid' || question.type === 'OE_Grid' ? rows : opts

    if (arr.length === 0) return question

    const isMA = question.type === 'MA' || question.type === 'MA_Grid'
    const conds = arr.map(opt => isMA ? `${question.id}R${opt.code} = ${opt.code}` : `${question.id} = ${opt.code}`)
    const terminate_if = `IF (${conds.join(' OR ')})`

    return {
      ...question,
      logic: { ...question.logic, terminate_if },
    }
  })
}

interface SurveyState {
  parsedQuestions: ParsedQuestion[]
  questionsMap: Map<string, ParsedQuestion>
  oldVariableMapping: OldVariableMapping // Mapping of question ID to old variable names
  /** Pristine data from Excel import - used by Clean Label generator only. Never mutated by Piping/Canvas. */
  pristineParsedQuestions: ParsedQuestion[]
  pristineOldVariableMapping: OldVariableMapping
  qcLogicGraph: QCLogicGraph | null // QC Logic Graph generated from questions
  editingQuestionId: string | null // Global: which question is being edited (for Edit modal from Canvas or Tab)
  editingContext: 'default' | 'terminate' | 'trap' // Context when opened from Terminate/Trap node
  isLoading: boolean
  error: string | null
  currentStep: 'import' | 'mapping' | 'refinery' | 'processing'
  
  // Actions
  setEditingQuestionId: (id: string | null, context?: 'default' | 'terminate' | 'trap') => void
  setParsedQuestions: (questions: ParsedQuestion[]) => void
  setPristineData: (questions: ParsedQuestion[], oldVariableMapping?: OldVariableMapping) => void
  appendParsedQuestions: (questions: ParsedQuestion[]) => void // Append questions (for chunked parsing)
  setQuestionsMap: (map: Map<string, ParsedQuestion>) => void
  updateQuestion: (id: string, question: Partial<ParsedQuestion>) => void
  deleteQuestion: (id: string) => void
  setOldVariableMapping: (mapping: OldVariableMapping) => void
  setQuestionOldVariables: (questionId: string, oldVars: string[]) => void
  setQCLogicGraph: (graph: QCLogicGraph | null) => void
  generateQCLogicGraph: () => void // Auto-generate graph from parsed questions
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setCurrentStep: (step: SurveyState['currentStep']) => void
  loadProjectData: (data: {
    parsedQuestions: ParsedQuestion[]
    oldVariableMapping: OldVariableMapping
    pristineParsedQuestions?: ParsedQuestion[]
    pristineOldVariableMapping?: OldVariableMapping
    qcLogicGraph: QCLogicGraph | null
  }) => void
  reset: () => void
}

const initialState = {
  parsedQuestions: [],
  questionsMap: new Map<string, ParsedQuestion>(),
  oldVariableMapping: {} as OldVariableMapping,
  pristineParsedQuestions: [] as ParsedQuestion[],
  pristineOldVariableMapping: {} as OldVariableMapping,
  qcLogicGraph: null as QCLogicGraph | null,
  editingQuestionId: null as string | null,
  editingContext: 'default' as const,
  isLoading: false,
  error: null,
  currentStep: 'import' as const,
}

export const useSurveyStore = create<SurveyState>((set, get) => ({
  ...initialState,
  
  setParsedQuestions: (questions) => {
    const processedQuestions = autoConvertTerminateOptions(questions)
    const map = questionsToMap(processedQuestions)
    set({ parsedQuestions: processedQuestions, questionsMap: map })
    // QC graph is computed lazily when user navigates to /qc-logic (QCLogicNebula)
  },

  /** Set pristine data from Excel import. Clean Label generator uses this - never mutated by Piping/Canvas. */
  setPristineData: (questions, oldVariableMapping) => {
    const processed = autoConvertTerminateOptions(questions)
    set({ pristineParsedQuestions: processed, pristineOldVariableMapping: oldVariableMapping || {} })
  },
  
  appendParsedQuestions: (newQuestions) => {
    const { parsedQuestions, questionsMap } = get()
    
    // Avoid duplicates by checking question IDs
    const existingIds = new Set(parsedQuestions.map(q => q.id))
    const uniqueNewQuestions = newQuestions.filter(q => !existingIds.has(q.id))
    
    if (uniqueNewQuestions.length === 0) {
      return
    }
    
    // Auto-convert terminate options to terminate_if for new questions
    const processedNewQuestions = autoConvertTerminateOptions(uniqueNewQuestions)
    
    // Merge questions
    const mergedQuestions = [...parsedQuestions, ...processedNewQuestions]
    
    // Sort by question ID
    mergedQuestions.sort((a, b) => {
      const aNum = parseInt(a.id.replace(/\D/g, '')) || 0
      const bNum = parseInt(b.id.replace(/\D/g, '')) || 0
      if (aNum !== bNum) return aNum - bNum
      return a.id.localeCompare(b.id)
    })
    
    const map = questionsToMap(mergedQuestions)
    set({ parsedQuestions: mergedQuestions, questionsMap: map })
  },
  
  setQuestionsMap: (map) => {
    const questions = mapToQuestions(map)
    set({ questionsMap: map, parsedQuestions: questions })
  },
  
  updateQuestion: (id, updates) => {
    const { questionsMap } = get()
    const question = questionsMap.get(id)
    if (!question) return

    const updated = { ...question, ...updates }
    const newMap = new Map(questionsMap)
    newMap.set(id, updated)

    // Detect option/row code renames and cascade into other questions' logic
    const renames = [
      ...detectCodeRenames(question.options, updated.options),
      ...detectCodeRenames(question.rows, updated.rows),
      ...detectCodeRenames(question.columns, updated.columns),
    ]
    if (renames.length > 0) {
      let allQuestions = mapToQuestions(newMap)
      for (const { oldCode, newCode } of renames) {
        allQuestions = cascadeCodeRename(allQuestions, id, oldCode, newCode)
      }
      const cascadedMap = questionsToMap(allQuestions)
      set({ parsedQuestions: allQuestions, questionsMap: cascadedMap, qcLogicGraph: null })
    } else {
      get().setQuestionsMap(newMap)
    }
  },
  
  deleteQuestion: (id) => {
    const { questionsMap, oldVariableMapping } = get()
    const newMap = new Map(questionsMap)
    newMap.delete(id)
    get().setQuestionsMap(newMap)
    
    // Also remove old variable mapping for deleted question
    const newMapping = { ...oldVariableMapping }
    delete newMapping[id]
    set({ oldVariableMapping: newMapping })
  },
  
  setOldVariableMapping: (mapping) => set({ oldVariableMapping: mapping }),
  
  setQuestionOldVariables: (questionId, oldVars) => {
    const { oldVariableMapping } = get()
    set({ oldVariableMapping: { ...oldVariableMapping, [questionId]: oldVars } })
  },
  
  setQCLogicGraph: (graph) => set({ qcLogicGraph: graph }),
  
  setEditingQuestionId: (id, context = 'default') => set({ editingQuestionId: id, editingContext: id ? context : 'default' }),
  
  generateQCLogicGraph: () => {
    const { parsedQuestions } = get()
    if (parsedQuestions.length === 0) {
      set({ qcLogicGraph: null })
      return
    }
    
    try {
      const graph = convertQuestionsToQCGraph(parsedQuestions)
      set({ qcLogicGraph: graph })
    } catch (error) {
      console.error('Error generating QC Logic Graph:', error)
      set({ qcLogicGraph: null })
    }
  },
  
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setCurrentStep: (step) => set({ currentStep: step }),
  
  // Load project data into survey store
  loadProjectData: (data: {
    parsedQuestions: ParsedQuestion[]
    oldVariableMapping: OldVariableMapping
    pristineParsedQuestions?: ParsedQuestion[]
    pristineOldVariableMapping?: OldVariableMapping
    qcLogicGraph: QCLogicGraph | null
  }) => {
    const map = questionsToMap(data.parsedQuestions)
    set({
      parsedQuestions: data.parsedQuestions,
      questionsMap: map,
      oldVariableMapping: data.oldVariableMapping,
      pristineParsedQuestions: data.pristineParsedQuestions ?? [],
      pristineOldVariableMapping: data.pristineOldVariableMapping ?? {},
      qcLogicGraph: data.qcLogicGraph,
    })
  },
  
  reset: () => set(initialState),
}))


