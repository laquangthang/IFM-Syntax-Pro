import { create } from 'zustand'
import { ParsedQuestion } from '@/lib/geminiParser'
import { questionsToMap, mapToQuestions } from '@/lib/jsonLoader'
import { QCLogicGraph } from '@/lib/qcLogicTypes'
import { convertQuestionsToQCGraph } from '@/lib/qcGraphConverter'
import { useProjectStore } from './projectStore'

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
    qcLogicGraph: QCLogicGraph | null
  }) => void
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
    
    // Auto-save to current project
    const { qcLogicGraph, oldVariableMapping } = get()
    useProjectStore.getState().saveCurrentProjectData({
      parsedQuestions: questions,
      oldVariableMapping,
      qcLogicGraph,
    })
  },
  
  appendParsedQuestions: (newQuestions) => {
    const { parsedQuestions, questionsMap } = get()
    
    // Avoid duplicates by checking question IDs
    const existingIds = new Set(parsedQuestions.map(q => q.id))
    const uniqueNewQuestions = newQuestions.filter(q => !existingIds.has(q.id))
    
    if (uniqueNewQuestions.length === 0) {
      console.log('   ℹ️  No new questions to append (all duplicates)')
      return
    }
    
    // Merge questions
    const mergedQuestions = [...parsedQuestions, ...uniqueNewQuestions]
    
    // Sort by question ID
    mergedQuestions.sort((a, b) => {
      const aNum = parseInt(a.id.replace(/\D/g, '')) || 0
      const bNum = parseInt(b.id.replace(/\D/g, '')) || 0
      if (aNum !== bNum) return aNum - bNum
      return a.id.localeCompare(b.id)
    })
    
    const map = questionsToMap(mergedQuestions)
    set({ parsedQuestions: mergedQuestions, questionsMap: map })
    
    // Regenerate QC Logic Graph with all questions
    if (mergedQuestions.length > 0) {
      get().generateQCLogicGraph()
    }
    
    // Auto-save to current project
    const { qcLogicGraph, oldVariableMapping } = get()
    useProjectStore.getState().saveCurrentProjectData({
      parsedQuestions: mergedQuestions,
      oldVariableMapping,
      qcLogicGraph,
    })
    
    console.log(`   ✅ Appended ${uniqueNewQuestions.length} new questions (${newQuestions.length - uniqueNewQuestions.length} duplicates skipped)`)
    console.log(`   📊 Total questions: ${mergedQuestions.length}`)
  },
  
  setQuestionsMap: (map) => {
    const questions = mapToQuestions(map)
    set({ questionsMap: map, parsedQuestions: questions })
    
    // Regenerate QC Logic Graph when questions are updated
    if (questions.length > 0) {
      get().generateQCLogicGraph()
    }
    
    // Auto-save to current project
    const { qcLogicGraph, oldVariableMapping } = get()
    useProjectStore.getState().saveCurrentProjectData({
      parsedQuestions: questions,
      oldVariableMapping,
      qcLogicGraph,
    })
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
  
  setOldVariableMapping: (mapping) => {
    set({ oldVariableMapping: mapping })
    // Auto-save to current project
    const { parsedQuestions, qcLogicGraph } = get()
    useProjectStore.getState().saveCurrentProjectData({
      parsedQuestions,
      oldVariableMapping: mapping,
      qcLogicGraph,
    })
  },
  
  setQuestionOldVariables: (questionId, oldVars) => {
    const { oldVariableMapping } = get()
    const newMapping = {
      ...oldVariableMapping,
      [questionId]: oldVars,
    }
    set({ oldVariableMapping: newMapping })
    
    // Auto-save to current project
    const { parsedQuestions, qcLogicGraph } = get()
    useProjectStore.getState().saveCurrentProjectData({
      parsedQuestions,
      oldVariableMapping: newMapping,
      qcLogicGraph,
    })
  },
  
  setQCLogicGraph: (graph) => {
    set({ qcLogicGraph: graph })
    // Auto-save to current project
    const { parsedQuestions, oldVariableMapping } = get()
    useProjectStore.getState().saveCurrentProjectData({
      parsedQuestions,
      oldVariableMapping,
      qcLogicGraph: graph,
    })
  },
  
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
    qcLogicGraph: QCLogicGraph | null
  }) => {
    const map = questionsToMap(data.parsedQuestions)
    set({
      parsedQuestions: data.parsedQuestions,
      questionsMap: map,
      oldVariableMapping: data.oldVariableMapping,
      qcLogicGraph: data.qcLogicGraph,
    })
  },
  
  reset: () => set(initialState),
}))


