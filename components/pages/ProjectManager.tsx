'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useProjectStore, type ProjectExportData } from '@/store/projectStore'
import { useSurveyStore } from '@/store/surveyStore'
import MainLayout from '../Layout/MainLayout'
import ThemeToggle from '../ThemeToggle'
import { 
  FolderPlus, 
  FolderOpen, 
  Trash2, 
  Edit2, 
  Check, 
  X,
  FileText,
  Calendar,
  Save,
  Download,
  Upload,
  AlertTriangle,
  HardDrive,
} from 'lucide-react'

export default function ProjectManager() {
  const router = useRouter()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { 
    projects, 
    currentProjectId, 
    createProject, 
    updateProject, 
    deleteProject, 
    loadProject,
    setCurrentProject,
    getCurrentProject,
    exportProject,
    importProject,
    lastSaveError,
    clearSaveError,
    storageUsageBytes,
    refreshStorageUsage,
  } = useProjectStore()
  
  const { 
    parsedQuestions, 
    oldVariableMapping, 
    qcLogicGraph,
    loadProjectData 
  } = useSurveyStore()

  // Check and fix theme on mount (once)
  useEffect(() => {
    // Check all possible localStorage keys for theme
    const themeKeys = ['theme', 'next-themes']
    let foundLightTheme = false
    
    themeKeys.forEach(key => {
      const value = localStorage.getItem(key)
      if (value && (value.includes('light') || value === 'light')) {
        foundLightTheme = true
        // Clear and set to dark
        try {
          const parsed = JSON.parse(value)
          if (parsed && typeof parsed === 'object') {
            parsed.theme = 'dark'
            localStorage.setItem(key, JSON.stringify(parsed))
          } else {
            localStorage.setItem(key, 'dark')
          }
        } catch {
          localStorage.setItem(key, 'dark')
        }
      }
    })
    
    if (foundLightTheme) {
      setTheme('dark')
    }
  }, []) // Only run once on mount
  
  // Sync HTML class with theme state (only when theme changes)
  useEffect(() => {
    if (!theme) return // Wait for theme to be ready
    
    const html = document.documentElement
    
    // Only update if there's a mismatch
    if (theme === 'dark' && !html.classList.contains('dark')) {
      html.classList.remove('light')
      html.classList.add('dark')
    } else if (theme === 'light' && !html.classList.contains('light')) {
      html.classList.remove('dark')
      html.classList.add('light')
    }
  }, [theme]) // Only run when theme changes
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const importFileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { refreshStorageUsage() }, [projects.length, refreshStorageUsage])

  // Auto-save current data when it changes
  useEffect(() => {
    if (currentProjectId && (parsedQuestions.length > 0 || Object.keys(oldVariableMapping).length > 0)) {
      useProjectStore.getState().saveCurrentProjectData({
        parsedQuestions,
        oldVariableMapping,
        qcLogicGraph,
      })
    }
  }, [parsedQuestions, oldVariableMapping, qcLogicGraph, currentProjectId])

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return
    
    const id = createProject(newProjectName.trim(), newProjectDescription.trim() || undefined)
    
    // Save current data to new project
    if (parsedQuestions.length > 0 || Object.keys(oldVariableMapping).length > 0) {
      useProjectStore.getState().saveCurrentProjectData({
        parsedQuestions,
        oldVariableMapping,
        qcLogicGraph,
      })
    }
    
    setNewProjectName('')
    setNewProjectDescription('')
    setShowNewForm(false)
  }

  const handleLoadProject = (id: string) => {
    const project = loadProject(id)
    if (project) {
      loadProjectData({
        parsedQuestions: project.parsedQuestions,
        oldVariableMapping: project.oldVariableMapping,
        pristineParsedQuestions: project.pristineParsedQuestions,
        pristineOldVariableMapping: project.pristineOldVariableMapping,
        qcLogicGraph: project.qcLogicGraph,
      })
      router.push('/import')
    }
  }

  const handleDeleteProject = (id: string) => {
    deleteProject(id)
    setDeleteConfirmId(null)
    if (currentProjectId === id) {
      setCurrentProject(null)
      loadProjectData({
        parsedQuestions: [],
        oldVariableMapping: {},
        pristineParsedQuestions: [],
        pristineOldVariableMapping: {},
        qcLogicGraph: null,
      })
    }
  }

  const handleStartEdit = (project: { id: string; name: string; description?: string }) => {
    setEditingId(project.id)
    setEditName(project.name)
    setEditDescription(project.description || '')
  }

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      updateProject(editingId, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      })
      setEditingId(null)
      setEditName('')
      setEditDescription('')
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditDescription('')
  }

  const handleExportProject = (id: string) => {
    const data = exportProject(id)
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.project.name?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'project'}_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as ProjectExportData
        if (data?._format !== 'ifm-syntax-pro-project') {
          alert('Invalid project file format.')
          return
        }
        const id = importProject(data)
        if (id) {
          const project = useProjectStore.getState().projects.find(p => p.id === id)
          if (project) {
            loadProjectData({
              parsedQuestions: project.parsedQuestions,
              oldVariableMapping: project.oldVariableMapping,
              pristineParsedQuestions: project.pristineParsedQuestions,
              pristineOldVariableMapping: project.pristineOldVariableMapping,
              qcLogicGraph: project.qcLogicGraph,
            })
          }
        }
      } catch {
        alert('Failed to parse project file.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const storageMB = (storageUsageBytes / 1024 / 1024).toFixed(1)
  const storagePercent = Math.min(100, (storageUsageBytes / (5 * 1024 * 1024)) * 100)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const currentProject = getCurrentProject()

  return (
    <MainLayout>
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Project Manager</h1>
              <p className="text-muted-foreground">
                Quản lý và lưu trữ các dự án survey của bạn
              </p>
            </div>
            <div className="flex items-center gap-4">
              {currentProject && (
                <div className="px-4 py-2 rounded-lg glass-panel border border-glass-border-light dark:border-glass-border-dark">
                  <p className="text-sm text-muted-foreground">Current Project:</p>
                  <p className="text-sm font-medium text-foreground">{currentProject.name}</p>
                </div>
              )}
              <ThemeToggle />
            </div>
          </div>

          {/* Storage usage bar */}
          <div className="mb-4 p-3 rounded-lg glass-panel border border-glass-border-light dark:border-glass-border-dark">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <HardDrive className="size-3" />
                <span>Storage: {storageMB}MB / 5MB</span>
              </div>
              {storagePercent >= 80 && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <AlertTriangle className="size-3" />
                  {storagePercent >= 95 ? 'Almost full!' : 'Getting full'}
                </span>
              )}
            </div>
            <div className="w-full h-1.5 rounded-full bg-background-light dark:bg-background-dark overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${storagePercent >= 95 ? 'bg-red-500' : storagePercent >= 80 ? 'bg-amber-400' : 'bg-primary'}`}
                style={{ width: `${storagePercent}%` }}
              />
            </div>
          </div>

          {/* Save error toast */}
          <AnimatePresence>
            {lastSaveError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{lastSaveError}</span>
                </div>
                <button onClick={clearSaveError} className="p-1 hover:bg-red-500/20 rounded transition-colors">
                  <X className="size-4 text-red-400" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          {!showNewForm && (
            <div className="mb-6 flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowNewForm(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors"
              >
                <FolderPlus className="size-5" />
                New Project
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => importFileRef.current?.click()}
                className="px-4 py-2 bg-background-light dark:bg-background-dark border border-glass-border-light dark:border-glass-border-dark rounded-lg flex items-center gap-2 hover:bg-white/5 transition-colors text-foreground"
              >
                <Upload className="size-5" />
                Import Project
              </motion.button>
              <input
                ref={importFileRef}
                type="file"
                accept=".json"
                onChange={handleImportProject}
                className="hidden"
              />
            </div>
          )}

          {/* New Project Form */}
          <AnimatePresence>
            {showNewForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 rounded-lg glass-panel border border-glass-border-light dark:border-glass-border-dark"
              >
                <h3 className="text-lg font-semibold mb-4 text-foreground">Create New Project</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Project Name *</label>
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => {
                        setNewProjectName(e.target.value)
                      }}
                      placeholder="Enter project name"
                      className="w-full px-3 py-2 rounded-lg bg-background-light dark:bg-background-dark border border-glass-border-light dark:border-glass-border-dark text-gray-900 dark:text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateProject()
                        if (e.key === 'Escape') setShowNewForm(false)
                      }}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">Description</label>
                    <textarea
                      value={newProjectDescription}
                      onChange={(e) => {
                        setNewProjectDescription(e.target.value)
                      }}
                      placeholder="Enter project description (optional)"
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg bg-background-light dark:bg-background-dark border border-glass-border-light dark:border-glass-border-dark text-gray-900 dark:text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateProject}
                      disabled={!newProjectName.trim()}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Check className="size-4" />
                      Create
                    </button>
                    <button
                      onClick={() => {
                        setShowNewForm(false)
                        setNewProjectName('')
                        setNewProjectDescription('')
                      }}
                      className="px-4 py-2 bg-background-light dark:bg-background-dark border border-glass-border-light dark:border-glass-border-dark rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2 text-foreground"
                    >
                      <X className="size-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Projects List */}
          {projects.length === 0 ? (
            <div className="text-center py-16 glass-panel rounded-lg border border-glass-border-light dark:border-glass-border-dark">
              <FolderOpen className="size-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">No projects yet</p>
              <p className="text-sm text-muted-foreground">Create your first project to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                  className={`p-4 rounded-lg glass-panel border transition-all ${
                    currentProjectId === project.id
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-glass-border-light dark:border-glass-border-dark'
                  }`}
                >
                  {editingId === project.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2 py-1 rounded bg-background-light dark:bg-background-dark border border-glass-border-light dark:border-glass-border-dark text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                        style={{ 
                        color: '#ffffff',
                        WebkitTextFillColor: '#ffffff'
                      } as React.CSSProperties}
                        autoFocus
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Description"
                        rows={2}
                        className="w-full px-2 py-1 rounded bg-background-light dark:bg-background-dark border border-glass-border-light dark:border-glass-border-dark text-gray-900 dark:text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="p-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1.5 bg-background-light dark:bg-background-dark border border-glass-border-light dark:border-glass-border-dark rounded hover:bg-white/5 transition-colors"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                            <FileText className="size-4" />
                            {project.name}
                          </h3>
                          {project.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {project.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => handleExportProject(project.id)}
                            className="p-1.5 hover:bg-white/5 rounded transition-colors"
                            title="Export"
                          >
                            <Download className="size-4 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleStartEdit(project)}
                            className="p-1.5 hover:bg-white/5 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="size-4 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(project.id)}
                            className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="size-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="size-3" />
                          <span>Created: {formatDate(project.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Save className="size-3" />
                          <span>Updated: {formatDate(project.updatedAt)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Questions: {project.parsedQuestions.length}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleLoadProject(project.id)}
                          className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm flex items-center justify-center gap-2"
                        >
                          <FolderOpen className="size-4" />
                          {currentProjectId === project.id ? 'Current' : 'Load'}
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Delete Confirmation Modal */}
          <AnimatePresence>
            {deleteConfirmId && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={() => setDeleteConfirmId(null)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="glass-panel rounded-lg p-6 max-w-md w-full border border-glass-border-light dark:border-glass-border-dark"
                >
                  <h3 className="text-lg font-semibold mb-2 text-foreground">Delete Project?</h3>
                  <p className="text-muted-foreground mb-4">
                    Are you sure you want to delete this project? This action cannot be undone.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-4 py-2 bg-background-light dark:bg-background-dark border border-glass-border-light dark:border-glass-border-dark rounded-lg hover:bg-white/5 transition-colors text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteProject(deleteConfirmId)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MainLayout>
  )
}
