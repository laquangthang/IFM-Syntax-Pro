import { create } from 'zustand'
import { ParsedQuestion } from '@/lib/geminiParser'
import { questionsToMap, mapToQuestions } from '@/lib/jsonLoader'
import { QCLogicGraph } from '@/lib/qcLogicTypes'
import { convertQuestionsToQCGraph } from '@/lib/qcGraphConverter'

// Old variable mapping: questionId -> array of old variable names (ordered)
export interface OldVariableMapping {
  [questionId: string]: string[]
}

interface SurveyState {
  parsedQuestions: ParsedQuestion[]
  questionsMap: Map<string, ParsedQuestion>
  oldVariableMapping: OldVariableMapping // Mapping of question ID to old variable names
  qcLogicGraph: QCLogicGraph | null // QC Logic Graph generated from questions
  isLoading: boolean
  error: string | null
  currentStep: 'import' | 'mapping' | 'refinery' | 'processing'
  
  // Actions
  setParsedQuestions: (questions: ParsedQuestion[]) => void
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
  reset: () => void
}

const initialState = {
  parsedQuestions: [],
  questionsMap: new Map<string, ParsedQuestion>(),
  oldVariableMapping: {} as OldVariableMapping,
  qcLogicGraph: null as QCLogicGraph | null,
  isLoading: false,
  error: null,
  currentStep: 'import' as const,
}

export const useSurveyStore = create<SurveyState>((set, get) => ({
  ...initialState,
  
  setParsedQuestions: (questions) => {
    const map = questionsToMap(questions)
    set({ parsedQuestions: questions, questionsMap: map })
    
    // Auto-generate QC Logic Graph when questions are set
    if (questions.length > 0) {
      get().generateQCLogicGraph()
    }
  },
  
  setQuestionsMap: (map) => {
    const questions = mapToQuestions(map)
    set({ questionsMap: map, parsedQuestions: questions })
    
    // Regenerate QC Logic Graph when questions are updated
    if (questions.length > 0) {
      get().generateQCLogicGraph()
    }
  },
  
  updateQuestion: (id, updates) => {
    const { questionsMap } = get()
    const question = questionsMap.get(id)
    if (question) {
      const updated = { ...question, ...updates }
      const newMap = new Map(questionsMap)
      newMap.set(id, updated)
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
    set({
      oldVariableMapping: {
        ...oldVariableMapping,
        [questionId]: oldVars,
      }
    })
  },
  
  setQCLogicGraph: (graph) => set({ qcLogicGraph: graph }),
  
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
  reset: () => set(initialState),
}))


