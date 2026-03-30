import { ParsedQuestion, OldVariableMapping } from '@/lib/types'

const escRe = (s: string) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function replaceCodeInCondition(
  condition: string,
  questionId: string,
  oldCode: string | number,
  newCode: string | number
): string {
  const qId = escRe(questionId)
  const old = escRe(String(oldCode))
  const nw = String(newCode)
  return condition
    .replace(new RegExp(`(${qId}R)${old}\\b`, 'g'), `$1${nw}`)
    .replace(new RegExp(`(${qId}_)${old}\\b`, 'g'), `$1${nw}`)
    .replace(new RegExp(`(${qId}\\s*=\\s*)${old}\\b`, 'g'), `$1${nw}`)
}

/**
 * After user changes an option/row code, propagate the rename into all logic references
 * across ALL questions (ask_if_condition, piping_excluded_codes).
 * Returns a new array (immutable).
 */
export function cascadeCodeRename(
  questions: ParsedQuestion[],
  targetQuestionId: string,
  oldCode: string | number,
  newCode: string | number
): ParsedQuestion[] {
  if (String(oldCode) === String(newCode)) return questions

  return questions.map(q => {
    let changed = false
    const logic = { ...q.logic }

    if (logic.ask_if_condition) {
      const updated = replaceCodeInCondition(logic.ask_if_condition, targetQuestionId, oldCode, newCode)
      if (updated !== logic.ask_if_condition) {
        logic.ask_if_condition = updated
        changed = true
      }
    }

    if (
      logic.piping_excluded_codes?.length &&
      logic.piping_source === targetQuestionId
    ) {
      const updated = logic.piping_excluded_codes.map(c =>
        String(c) === String(oldCode) ? newCode : c
      )
      if (updated.some((c, i) => c !== logic.piping_excluded_codes![i])) {
        logic.piping_excluded_codes = updated
        changed = true
      }
    }

    return changed ? { ...q, logic } : q
  })
}

/**
 * Replace all occurrences of oldQId in a condition string with newQId.
 * Handles patterns: H27R5, H27_5, H27 = 5, standalone H27.
 */
function replaceQuestionIdInCondition(condition: string, oldQId: string, newQId: string): string {
  const escaped = escRe(oldQId)
  // Replace oldQId wherever it appears as a word-boundary token
  return condition.replace(new RegExp(`\\b${escaped}\\b`, 'g'), newQId)
}

/**
 * After user renames a question ID (e.g. H27 → H10000), propagate into all
 * other questions' logic references: piping_source, ask_if_condition, terminate_if.
 * Also migrates oldVariableMapping key.
 * Returns { questions, oldVariableMapping } — immutable.
 */
export function cascadeQuestionIdRename(
  questions: ParsedQuestion[],
  oldId: string,
  newId: string,
  oldVariableMapping: OldVariableMapping
): { questions: ParsedQuestion[]; oldVariableMapping: OldVariableMapping } {
  if (oldId === newId) return { questions, oldVariableMapping }

  const updatedQuestions = questions.map(q => {
    let changed = false
    const logic = { ...q.logic }

    if (logic.ask_if_condition) {
      const updated = replaceQuestionIdInCondition(logic.ask_if_condition, oldId, newId)
      if (updated !== logic.ask_if_condition) {
        logic.ask_if_condition = updated
        changed = true
      }
    }

    if (logic.terminate_if) {
      const updated = replaceQuestionIdInCondition(logic.terminate_if, oldId, newId)
      if (updated !== logic.terminate_if) {
        logic.terminate_if = updated
        changed = true
      }
    }

    if (logic.piping_source === oldId) {
      logic.piping_source = newId
      changed = true
    }

    return changed ? { ...q, logic } : q
  })

  // Migrate oldVariableMapping: oldId → newId
  const newMapping = { ...oldVariableMapping }
  if (newMapping[oldId]) {
    newMapping[newId] = newMapping[oldId]
    delete newMapping[oldId]
  }

  return { questions: updatedQuestions, oldVariableMapping: newMapping }
}
