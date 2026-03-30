import { ParsedQuestion } from '@/lib/types'

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
