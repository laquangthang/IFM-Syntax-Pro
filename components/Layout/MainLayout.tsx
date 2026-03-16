'use client'

import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import ThemeToggle from '../ThemeToggle'
import { useAutoLoadProject } from '@/lib/hooks/useAutoLoadProject'
import { useAutoSave } from '@/lib/hooks/useAutoSave'
import { useSurveyStore } from '@/store/surveyStore'
import EditQuestionModal from '@/components/questions/EditQuestionModal'

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  // Auto-load current project on mount
  useAutoLoadProject()
  useAutoSave()
  const { questionsMap, editingQuestionId, editingContext, setEditingQuestionId, updateQuestion } = useSurveyStore()
  const questionToEdit = editingQuestionId ? questionsMap.get(editingQuestionId) : null

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark transition-colors duration-300">
      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-background-light dark:bg-background-dark transition-colors duration-300" />
        {/* Gradient Mesh - Orange for dark, subtle for light */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 dark:bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 dark:bg-primary/5 blur-[120px] rounded-full" />
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-50 dark:opacity-20" />
      </div>

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {children}
      </div>

      {/* Global Edit Question Modal (opened from Canvas or Questions tab) */}
      {questionToEdit && (
        <EditQuestionModal
          question={questionToEdit}
          isOpen={!!editingQuestionId}
          editingContext={editingContext}
          onClose={() => setEditingQuestionId(null)}
          onSave={(updatedQuestion) => {
            updateQuestion(updatedQuestion.id, updatedQuestion)
            setEditingQuestionId(null)
          }}
        />
      )}
    </div>
  )
}


