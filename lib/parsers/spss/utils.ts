/**
 * Utility functions for SPSS Excel parsing
 */

export function splitByColonSegments(text: string): string[] {
  const positions: number[] = []
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') depth--
    else if (depth === 0 && text[i] === ':' && i + 1 < text.length && !/\s/.test(text[i + 1])) {
      positions.push(i)
    }
  }
  const segments: string[] = []
  if (positions.length === 0) return [text.trim()]
  segments.push(text.substring(0, positions[0]).trim())
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i] + 1
    const end = i + 1 < positions.length ? positions[i + 1] : text.length
    let segment = text.substring(start, end).trim()
    if (i === positions.length - 1) {
      const spaceIndex = segment.indexOf(' ')
      if (spaceIndex > 0) segment = segment.substring(0, spaceIndex)
    }
    segments.push(segment)
  }
  return segments
}

export function extractLastNumber(text: string): string | null {
  const match = text.trim().match(/\/(\d+)$/)
  return match ? match[1] : null
}

export function removeTrailingNumberGroup(text: string): string {
  return text.replace(/\/\d+$/, '')
}

export function parseVariableName(varName: string): {
  varId: string
  optionId?: string
  isOther?: boolean
  loopId?: string
  loopType?: 'PN' | 'QN'
} {
  const match = varName.match(/^(var\d+)(O\d+)?(Othr)?((PN|QN)([\d_]+))?$/i)
  if (!match) return { varId: varName }
  return {
    varId: match[1],
    optionId: match[2] || undefined,
    isOther: !!match[3],
    loopId: match[6] || undefined,
    loopType: (match[5] as 'PN' | 'QN') || undefined,
  }
}

/** Text companion suffixes: Othr, _OTHER, _TEXT, _O */
const TEXT_COMPANION_SUFFIX = /(?:Othr|_OTHER|_TEXT|_O)$/i

/** Check if variable name is a text companion (open-ended pair of a categorical) */
export function isTextCompanion(varName: string): boolean {
  return TEXT_COMPANION_SUFFIX.test(varName)
}

/**
 * Strip text companion suffix to get base categorical variable name.
 * STRICT: When knownVariables is provided, only return the EXACT stripped prefix if it exists.
 * For var666O1958Othr, returns var666O1958 ONLY if var666O1958 is in knownVariables.
 * Do NOT fall back to shorter prefixes (var666O, var666) - that causes wrong attachment to Option 1.
 * When knownVariables is omitted: returns simple suffix-stripped result (backward compatible).
 */
export function getBaseVarFromTextCompanion(
  varName: string,
  knownVariables?: Set<string> | string[]
): string | null {
  if (!isTextCompanion(varName)) return null
  const stripped = varName.replace(TEXT_COMPANION_SUFFIX, '')
  const isEmpty = !knownVariables || (Array.isArray(knownVariables) ? knownVariables.length === 0 : knownVariables.size === 0)
  if (isEmpty) return stripped

  const knownSet = knownVariables instanceof Set ? knownVariables : new Set(knownVariables)
  // STRICT: Only exact match. No fallback to shorter prefixes.
  return knownSet.has(stripped) ? stripped : null
}

/**
 * SA-only: When exact match fails, try prefix match for SA base (var\d+).
 * For var304O1112Othr, if var304O1112 not in knownVarSet, check if stripped starts with var304 (SA base).
 * Returns the longest matching var\d+ from knownVarSet that stripped starts with.
 */
export function getSABaseVarFromTextCompanion(
  varName: string,
  knownVariables: Set<string> | string[]
): string | null {
  if (!isTextCompanion(varName)) return null
  const stripped = varName.replace(TEXT_COMPANION_SUFFIX, '')
  const knownSet = knownVariables instanceof Set ? knownVariables : new Set(knownVariables)
  let best: string | null = null
  for (const v of knownSet) {
    if (/^var\d+$/.test(v) && stripped.startsWith(v) && (!best || v.length > (best?.length ?? 0))) {
      best = v
    }
  }
  return best
}

export function classifyVariable(varName: string, label: string): 'SA' | 'MA' | 'Grid' | 'Loop' | 'Rank' | 'Sum' | 'Unknown' {
  const upperLabel = label.toUpperCase()
  if (upperLabel.includes('[RANK]')) return 'Rank'
  if (upperLabel.includes('[SUM]')) return 'Sum'
  if (/var\d+O\d+(?:Othr)?(?:PN|QN)\d+/i.test(varName)) return 'Loop'
  if (/var\d+(?:PN|QN)\d+/i.test(varName)) return 'Loop'
  if (/var\d+O\d+/i.test(varName)) return 'MA'
  if (/var\d+$/i.test(varName)) return 'SA'
  return 'Unknown'
}

export function compareQuestionIds(a: string, b: string): number {
  const parseQId = (id: string) => {
    const match = id.match(/^([A-Za-z]+)(\d+)(?:_(\d+[a-z]?))?(?:_(\d+[a-z]?))?/i)
    if (!match) return { prefix: id, num: 0, sub1: '', sub2: '' }
    return {
      prefix: match[1].toUpperCase(),
      num: parseInt(match[2]) || 0,
      sub1: match[3] || '',
      sub2: match[4] || '',
    }
  }
  const aParts = parseQId(a)
  const bParts = parseQId(b)
  if (aParts.prefix !== bParts.prefix) return aParts.prefix.localeCompare(bParts.prefix)
  if (aParts.num !== bParts.num) return aParts.num - bParts.num
  if (aParts.sub1 || bParts.sub1) {
    if (!aParts.sub1) return -1
    if (!bParts.sub1) return 1
    const aSub1Num = parseInt(aParts.sub1) || 0
    const bSub1Num = parseInt(bParts.sub1) || 0
    if (aSub1Num !== bSub1Num) return aSub1Num - bSub1Num
    if (aParts.sub1 !== bParts.sub1) return aParts.sub1.localeCompare(bParts.sub1)
  }
  if (aParts.sub2 || bParts.sub2) {
    if (!aParts.sub2) return -1
    if (!bParts.sub2) return 1
    const aSub2Num = parseInt(aParts.sub2) || 0
    const bSub2Num = parseInt(bParts.sub2) || 0
    if (aSub2Num !== bSub2Num) return aSub2Num - bSub2Num
    return aParts.sub2.localeCompare(bParts.sub2)
  }
  return 0
}
