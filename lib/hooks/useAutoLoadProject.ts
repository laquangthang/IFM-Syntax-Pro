'use client'

import { useEffect } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { useSurveyStore } from '@/store/surveyStore'

/**
 * Hook to automatically load current project data when app starts
 */
export function useAutoLoadProject() {
  const { currentProjectId, getCurrentProject } = useProjectStore()
  const { loadProjectData } = useSurveyStore()

  useEffect(() => {
    if (currentProjectId) {
      const project = getCurrentProject()
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
  }, [currentProjectId, getCurrentProject, loadProjectData])
}
