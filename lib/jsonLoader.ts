import { ParsedQuestion } from './geminiParser'

export interface SurveyJSON {
  questions: ParsedQuestion[]
}

/**
 * Load JSON file from user's file system
 */
export async function loadJSONFromFile(file: File): Promise<SurveyJSON> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const json = JSON.parse(text) as SurveyJSON
        
        // Validate structure
        if (!json.questions || !Array.isArray(json.questions)) {
          throw new Error('Invalid JSON structure: missing "questions" array')
        }
        
        resolve(json)
      } catch (error) {
        reject(new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsText(file)
  })
}

/**
 * Convert questions array to Map for efficient lookup
 * Preserves original order by maintaining insertion order in Map
 */
export function questionsToMap(questions: ParsedQuestion[]): Map<string, ParsedQuestion> {
  const map = new Map<string, ParsedQuestion>()
  questions.forEach((q) => {
    map.set(q.id, q)
  })
  return map
}

/**
 * Convert Map back to array
 * Preserves original order from JSON file (Map maintains insertion order)
 */
export function mapToQuestions(map: Map<string, ParsedQuestion>): ParsedQuestion[] {
  // Map maintains insertion order, so we can just convert directly
  // This preserves the original order from the JSON file
  return Array.from(map.values())
}

