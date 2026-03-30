import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { ParsedQuestion, OldVariableMapping } from '@/lib/types'
import { QCLogicGraph } from '@/lib/qcLogicTypes'

const STORAGE_KEY = 'ifm-projects-storage'
const QUOTA_WARNING_BYTES = 4 * 1024 * 1024 // 4MB — warn before hitting ~5MB limit

/** Project data - JSON-serializable only. No ArrayBuffers, Base64, or binary data. */
export interface ProjectData {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  parsedQuestions: ParsedQuestion[]
  oldVariableMapping: OldVariableMapping
  /** Pristine data from Excel - for Clean Label only. Optional for backward compat. */
  pristineParsedQuestions?: ParsedQuestion[]
  pristineOldVariableMapping?: OldVariableMapping
  qcLogicGraph: QCLogicGraph | null
}

/** Portable format for JSON export/import */
export interface ProjectExportData {
  _format: 'ifm-syntax-pro-project'
  _version: 1
  project: Omit<ProjectData, 'id'> & { id?: string }
}

function getStorageUsageBytes(): number {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? new Blob([data]).size : 0
  } catch { return 0 }
}

interface ProjectState {
  projects: ProjectData[]
  currentProjectId: string | null
  lastSaveError: string | null
  storageUsageBytes: number
  
  createProject: (name: string, description?: string) => string
  updateProject: (id: string, updates: Partial<Omit<ProjectData, 'id' | 'createdAt'>>) => void
  deleteProject: (id: string) => void
  loadProject: (id: string) => ProjectData | null
  setCurrentProject: (id: string | null) => void
  saveCurrentProjectData: (data: {
    parsedQuestions: ParsedQuestion[]
    oldVariableMapping: OldVariableMapping
    pristineParsedQuestions?: ParsedQuestion[]
    pristineOldVariableMapping?: OldVariableMapping
    qcLogicGraph: QCLogicGraph | null
  }) => void
  getCurrentProject: () => ProjectData | null
  refreshStorageUsage: () => void
  exportProject: (id: string) => ProjectExportData | null
  importProject: (data: ProjectExportData) => string | null
  clearSaveError: () => void
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,
      lastSaveError: null,
      storageUsageBytes: 0,
      
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
          lastSaveError: null,
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
        get().refreshStorageUsage()
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
        
        try {
          get().updateProject(currentProjectId, {
            parsedQuestions: data.parsedQuestions,
            oldVariableMapping: data.oldVariableMapping,
            pristineParsedQuestions: data.pristineParsedQuestions,
            pristineOldVariableMapping: data.pristineOldVariableMapping,
            qcLogicGraph: data.qcLogicGraph,
          })
          const usage = getStorageUsageBytes()
          set({ storageUsageBytes: usage, lastSaveError: usage >= QUOTA_WARNING_BYTES ? `Storage usage high: ${(usage / 1024 / 1024).toFixed(1)}MB / 5MB` : null })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown save error'
          set({ lastSaveError: `Save failed: ${msg}. Try exporting and deleting old projects.` })
        }
      },
      
      getCurrentProject: () => {
        const { currentProjectId, projects } = get()
        if (!currentProjectId) return null
        return projects.find((p) => p.id === currentProjectId) || null
      },

      refreshStorageUsage: () => {
        set({ storageUsageBytes: getStorageUsageBytes() })
      },

      exportProject: (id) => {
        const project = get().projects.find((p) => p.id === id)
        if (!project) return null
        const { id: _id, ...rest } = project
        return { _format: 'ifm-syntax-pro-project', _version: 1, project: rest }
      },

      importProject: (data) => {
        if (data?._format !== 'ifm-syntax-pro-project' || !data?.project) return null
        const id = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const now = new Date().toISOString()
        const imported: ProjectData = {
          id,
          name: data.project.name || 'Imported Project',
          description: data.project.description,
          createdAt: data.project.createdAt || now,
          updatedAt: now,
          parsedQuestions: data.project.parsedQuestions || [],
          oldVariableMapping: data.project.oldVariableMapping || {},
          pristineParsedQuestions: data.project.pristineParsedQuestions,
          pristineOldVariableMapping: data.project.pristineOldVariableMapping,
          qcLogicGraph: data.project.qcLogicGraph ?? null,
        }
        set((state) => ({
          projects: [...state.projects, imported],
          currentProjectId: id,
        }))
        get().refreshStorageUsage()
        return id
      },

      clearSaveError: () => set({ lastSaveError: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projects: state.projects,
        currentProjectId: state.currentProjectId,
      }),
    }
  )
)
