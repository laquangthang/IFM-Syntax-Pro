import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { ParsedQuestion } from '@/lib/geminiParser'
import { OldVariableMapping } from './surveyStore'
import { QCLogicGraph } from '@/lib/qcLogicTypes'

export interface ProjectData {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  parsedQuestions: ParsedQuestion[]
  oldVariableMapping: OldVariableMapping
  qcLogicGraph: QCLogicGraph | null
}

interface ProjectState {
  projects: ProjectData[]
  currentProjectId: string | null
  
  // Actions
  createProject: (name: string, description?: string) => string
  updateProject: (id: string, updates: Partial<Omit<ProjectData, 'id' | 'createdAt'>>) => void
  deleteProject: (id: string) => void
  loadProject: (id: string) => ProjectData | null
  setCurrentProject: (id: string | null) => void
  saveCurrentProjectData: (data: {
    parsedQuestions: ParsedQuestion[]
    oldVariableMapping: OldVariableMapping
    qcLogicGraph: QCLogicGraph | null
  }) => void
  getCurrentProject: () => ProjectData | null
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,
      
      createProject: (name, description) => {
        const id = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const now = new Date().toISOString()
        const newProject: ProjectData = {
          id,
          name,
          description,
          createdAt: now,
          updatedAt: now,
          parsedQuestions: [],
          oldVariableMapping: {},
          qcLogicGraph: null,
        }
        
        set((state) => ({
          projects: [...state.projects, newProject],
          currentProjectId: id,
        }))
        
        return id
      },
      
      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? { ...project, ...updates, updatedAt: new Date().toISOString() }
              : project
          ),
        }))
      },
      
      deleteProject: (id) => {
        set((state) => {
          const newProjects = state.projects.filter((p) => p.id !== id)
          const newCurrentId = state.currentProjectId === id ? null : state.currentProjectId
          return {
            projects: newProjects,
            currentProjectId: newCurrentId,
          }
        })
      },
      
      loadProject: (id) => {
        const project = get().projects.find((p) => p.id === id)
        if (project) {
          set({ currentProjectId: id })
        }
        return project || null
      },
      
      setCurrentProject: (id) => {
        set({ currentProjectId: id })
      },
      
      saveCurrentProjectData: (data) => {
        const { currentProjectId } = get()
        if (!currentProjectId) return
        
        get().updateProject(currentProjectId, {
          parsedQuestions: data.parsedQuestions,
          oldVariableMapping: data.oldVariableMapping,
          qcLogicGraph: data.qcLogicGraph,
        })
      },
      
      getCurrentProject: () => {
        const { currentProjectId, projects } = get()
        if (!currentProjectId) return null
        return projects.find((p) => p.id === currentProjectId) || null
      },
    }),
    {
      name: 'ifm-projects-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projects: state.projects,
        currentProjectId: state.currentProjectId,
      }),
    }
  )
)
