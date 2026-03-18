'use client'

import { useEffect } from 'react'
import { useSurveyStore } from '@/store/surveyStore'
import { useProjectStore } from '@/store/projectStore'

/**
 * Syncs survey store (in-memory session) to project store (localStorage) when survey data changes.
 * Decouples surveyStore from projectStore - no circular dependency.
 * Call once at app root (e.g. MainLayout).
 */
export function useAutoSave() {
  const saveCurrentProjectData = useProjectStore((s) => s.saveCurrentProjectData)
  const currentProjectId = useProjectStore((s) => s.currentProjectId)
  const parsedQuestions = useSurveyStore((s) => s.parsedQuestions)
  const oldVariableMapping = useSurveyStore((s) => s.oldVariableMapping)
  const pristineParsedQuestions = useSurveyStore((s) => s.pristineParsedQuestions)
  const pristineOldVariableMapping = useSurveyStore((s) => s.pristineOldVariableMapping)
  const qcLogicGraph = useSurveyStore((s) => s.qcLogicGraph)

  useEffect(() => {
    if (!currentProjectId) return
    saveCurrentProjectData({
      parsedQuestions,
      oldVariableMapping,
      pristineParsedQuestions,
      pristineOldVariableMapping,
      qcLogicGraph,
    })
  }, [currentProjectId, parsedQuestions, oldVariableMapping, pristineParsedQuestions, pristineOldVariableMapping, qcLogicGraph, saveCurrentProjectData])
}
