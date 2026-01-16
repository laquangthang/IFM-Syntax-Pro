import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ParsedQuestion } from '@/lib/geminiParser'

// Initialize Gemini Client
const API_KEY = process.env.GEMINI_API_KEY || ''
if (!API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY environment variable is not set')
}
const genAI = new GoogleGenerativeAI(API_KEY)
const MODEL_NAME = 'gemini-2.5-flash'

/**
 * Chunked Parsing Prompt - Parse only a specific range of questions
 */
function createChunkedPrompt(
  chunkIndex: number,
  totalChunks: number,
  questionsPerChunk: number,
  previousQuestions?: ParsedQuestion[]
): string {
  const startQuestion = chunkIndex * questionsPerChunk + 1
  const endQuestion = Math.min((chunkIndex + 1) * questionsPerChunk, 999) // Max reasonable number
  
  let prompt = `Bạn là chuyên gia phân tích Bảng câu hỏi (BCH) Market Research.
Nhiệm vụ: Đọc PDF và trả về MỘT MẢNG JSON hợp lệ CHỈ chứa các câu hỏi từ Q${startQuestion} đến Q${endQuestion} (ước tính).

QUAN TRỌNG - PHẢI TUÂN THỦ:
- Chỉ trả về JSON array, bắt đầu bằng [ và kết thúc bằng ]
- KHÔNG có text giải thích trước hoặc sau JSON
- KHÔNG có markdown code blocks (\`\`\`json)
- Tất cả strings phải được đóng dấu ngoặc kép đúng cách
- Escape các ký tự đặc biệt trong strings: \\", \\n, \\\\
- Đảm bảo JSON HOÀN CHỈNH - không được cắt cụt ở giữa
- Mỗi object phải có đầy đủ các trường và đóng ngoặc đúng cách
- CHỈ parse các câu hỏi trong khoảng Q${startQuestion}-Q${endQuestion}, bỏ qua các câu hỏi khác

`

  // Add context from previous chunks if available
  if (previousQuestions && previousQuestions.length > 0) {
    prompt += `CONTEXT TỪ CÁC PHẦN TRƯỚC (để tham khảo logic dependencies):
`
    // Include last 5 questions for context (for piping, ask_if references)
    const contextQuestions = previousQuestions.slice(-5)
    prompt += `Các câu hỏi đã parse trước đó (chỉ để tham khảo, KHÔNG parse lại):\n`
    contextQuestions.forEach((q, idx) => {
      prompt += `- ${q.id}: ${q.type} - "${q.label.substring(0, 50)}${q.label.length > 50 ? '...' : ''}"\n`
      if (q.options && q.options.length > 0) {
        prompt += `  Options: ${q.options.map(o => `${o.code}`).join(', ')}\n`
      }
    })
    prompt += `\n`
  }

  prompt += `PHÂN LOẠI TYPE:
- "Note: SA" hoặc "SCRIPT: HỎI TẤT CẢ" → type:"SA"
- "Note: MA" → type:"MA"
- "Note: SA/MA per attribute" → type:"SA_Grid" hoặc "MA_Grid"
- "Ranking = 5" → type:"Rank_Fixed", limit:5
- "Ranking upto 5" → type:"Rank_Upto", limit:5
- "OE/OA" hoặc nhãn có "(ghi rõ)" → type:"OE"
- "OE/OA per attribute" hoặc "OE Grid" → type:"OE_Grid" (chỉ có rows, KHÔNG có columns)

LOGIC:
- "SCRIPT: HỎI TẤT CẢ" → logic.type:"Ask All"
- "Piping code in QX" hoặc "Show codes in QX" hoặc "Piping code from QX" → logic.piping_source:"QX"
  * Với Grid questions (SA_Grid, MA_Grid): columns = lấy options từ QX
  * Với MA questions: options = COPY TẤT CẢ options từ QX (tìm trong context questions ở trên hoặc trong các phần đã parse)
- "ASK FOR RESPONDENTS CHOSE CODE 6-10 IN Q5" → logic.piping_source:"Q5" VÀ logic.ask_if_condition:"IF (Q5R6 = 6 OR Q5R7 = 7 OR Q5R8 = 8 OR Q5R9 = 9 OR Q5R10 = 10)"
- "ASK IF RESPONDENTS CHOSE CODE 1 IN Q3" → logic.piping_source:"Q3" VÀ logic.ask_if_condition:"IF (Q3R1 = 1)"
- Format ask_if_condition: Với MA questions, format là QXRX = X (ví dụ: Q5R6 = 6). Với SA questions, format là QX = X (ví dụ: Q3 = 1)
- TERMINATE: Khi có "TERMINATE" → codeType:"Terminate" VÀ logic.terminate_if theo format đúng

GRID QUESTIONS (SA_Grid, MA_Grid):
- Nếu có "Piping code in QX" → columns = lấy code và label từ câu QX (tìm trong context)
- rows = các attributes như đang làm

MA QUESTIONS VỚI PIPING CODE:
- Nếu có "Piping code from QX" → logic.piping_source:"QX", logic.type:"Piping"
- options = COPY TẤT CẢ options từ QX (tìm trong context questions)

OPTIONS VỚI "(GHI RÕ)":
- Nếu option có code X với label có "(ghi rõ)":
  → Giữ nguyên option code X
  → Thêm option với code X_O với label giống hệt

OPTIONS VỚI CODE TYPE:
- Mặc định: codeType:"Normal"
- "None = SA Exclusive" → codeType:"Exclusive"
- "(ghi rõ)" → codeType:"Other"
- "TERMINATE" → codeType:"Terminate"

LÀM SẠCH:
- Nối các dòng text bị xuống dòng sai thành 1 chuỗi
- Xóa "TERMINATE", "Note:", "SCRIPT:" khỏi label, đưa vào instruction
- Label: chỉ Tiếng Việt, bỏ Tiếng Anh

ĐỊNH DẠNG JSON CHÍNH XÁC:
[
  {
    "id": "Q${startQuestion}",
    "type": "SA",
    "instruction": "Lời dẫn gốc",
    "label": "Nội dung câu hỏi sạch (chỉ Tiếng Việt)",
    "options": [
      {"code": 1, "label": "Đáp án 1", "codeType": "Normal"}
    ],
    "rows": [],
    "columns": [],
    "logic": {
      "type": "Normal",
      "piping_source": null,
      "terminate_if": null,
      "ask_if_condition": null
    }
  }
]

YÊU CẦU CUỐI: Trả về ĐÚNG ĐỊNH DẠNG JSON array CHỈ chứa các câu hỏi Q${startQuestion}-Q${endQuestion}, KHÔNG có text nào khác.`

  return prompt
}

/**
 * Convert file to base64
 */
async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return buffer.toString('base64')
}

/**
 * Clean and fix JSON syntax errors
 */
function fixJSONSyntax(jsonText: string): string {
  let fixed = jsonText.trim()
  
  // Remove comments
  fixed = fixed.replace(/\/\/.*$/gm, '')
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '')
  
  // Fix control characters
  let result = ''
  let inString = false
  let escapeNext = false
  
  for (let i = 0; i < fixed.length; i++) {
    const char = fixed[i]
    const charCode = char.charCodeAt(0)
    
    if (escapeNext) {
      result += char
      escapeNext = false
      continue
    }
    
    if (char === '\\') {
      result += char
      escapeNext = true
      continue
    }
    
    if (char === '"') {
      inString = !inString
      result += char
      continue
    }
    
    if (inString) {
      if (charCode === 0x0A) {
        result += '\\n'
      } else if (charCode === 0x0D) {
        result += '\\r'
      } else if (charCode === 0x09) {
        result += '\\t'
      } else if (charCode >= 0x00 && charCode <= 0x1F) {
        continue // Remove other control chars
      } else {
        result += char
      }
    } else {
      result += char
    }
  }
  
  fixed = result
  
  // Fix single quotes to double quotes
  fixed = fixed.replace(/'([^']+)'\s*:/g, '"$1":')
  fixed = fixed.replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":')
  
  // Remove trailing commas
  fixed = fixed.replace(/,\s*}/g, '}')
  fixed = fixed.replace(/,\s*]/g, ']')
  
  return fixed.trim()
}

/**
 * Validate and merge questions from chunks
 */
function validateAndMergeQuestions(
  allQuestions: ParsedQuestion[],
  newQuestions: ParsedQuestion[]
): { questions: ParsedQuestion[]; errors: string[] } {
  const errors: string[] = []
  const questionMap = new Map<string, ParsedQuestion>()
  
  // Add existing questions
  allQuestions.forEach(q => {
    questionMap.set(q.id, q)
  })
  
  // Add new questions, check for duplicates
  newQuestions.forEach(q => {
    if (questionMap.has(q.id)) {
      errors.push(`Duplicate question ID: ${q.id}`)
      // Keep the existing one, don't overwrite
    } else {
      questionMap.set(q.id, q)
    }
  })
  
  // Sort by question ID
  const sortedQuestions = Array.from(questionMap.values()).sort((a, b) => {
    // Extract numeric part for comparison
    const aNum = parseInt(a.id.replace(/\D/g, '')) || 0
    const bNum = parseInt(b.id.replace(/\D/g, '')) || 0
    if (aNum !== bNum) return aNum - bNum
    return a.id.localeCompare(b.id)
  })
  
  return { questions: sortedQuestions, errors }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const chunkIndex = parseInt(formData.get('chunkIndex') as string || '0')
    const totalChunks = parseInt(formData.get('totalChunks') as string || '1')
    const questionsPerChunk = parseInt(formData.get('questionsPerChunk') as string || '10')
    const previousQuestionsJson = formData.get('previousQuestions') as string
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }
    
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      )
    }

    console.log(`\n📦 CHUNKED PARSING - Chunk ${chunkIndex + 1}/${totalChunks}`)
    console.log(`   Questions per chunk: ${questionsPerChunk}`)
    console.log(`   Expected range: Q${chunkIndex * questionsPerChunk + 1} - Q${Math.min((chunkIndex + 1) * questionsPerChunk, 999)}`)

    // Parse previous questions if provided
    let previousQuestions: ParsedQuestion[] = []
    if (previousQuestionsJson) {
      try {
        previousQuestions = JSON.parse(previousQuestionsJson) as ParsedQuestion[]
        console.log(`   Context: ${previousQuestions.length} previous questions loaded`)
      } catch (e) {
        console.warn('   Warning: Could not parse previous questions context')
      }
    }

    // Convert PDF to Base64
    const base64Data = await fileToBase64(file)
    
    // Create chunked prompt
    const chunkedPrompt = createChunkedPrompt(
      chunkIndex,
      totalChunks,
      questionsPerChunk,
      previousQuestions
    )

    const model = genAI.getGenerativeModel({ model: MODEL_NAME })
    
    const pdfPart = {
      inlineData: {
        data: base64Data,
        mimeType: 'application/pdf',
      },
    }

    console.log(`🚀 Calling Gemini API for chunk ${chunkIndex + 1}...`)
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: chunkedPrompt }, pdfPart] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 16384, // Smaller for chunks
      },
    })

    let jsonText = result.response.text()
    jsonText = fixJSONSyntax(jsonText)
    
    // Parse JSON
    let parsedData: ParsedQuestion[] = []
    try {
      parsedData = JSON.parse(jsonText) as ParsedQuestion[]
      if (!Array.isArray(parsedData)) {
        throw new Error('Response is not an array')
      }
    } catch (parseError: any) {
      console.error(`❌ JSON Parse Error in chunk ${chunkIndex + 1}:`, parseError.message)
      return NextResponse.json(
        { 
          error: `Failed to parse JSON in chunk ${chunkIndex + 1}`,
          details: parseError.message,
          rawResponse: jsonText.substring(0, 500)
        },
        { status: 500 }
      )
    }

    console.log(`✅ Chunk ${chunkIndex + 1} parsed: ${parsedData.length} questions`)
    parsedData.forEach(q => {
      console.log(`   - ${q.id}: ${q.type}`)
    })

    // Validate questions
    const validation = validateAndMergeQuestions(previousQuestions, parsedData)
    
    if (validation.errors.length > 0) {
      console.warn(`⚠️  Validation warnings in chunk ${chunkIndex + 1}:`, validation.errors)
    }

    return NextResponse.json({
      success: true,
      chunkIndex,
      questions: parsedData,
      totalParsed: parsedData.length,
      validationErrors: validation.errors,
    })

  } catch (error: any) {
    console.error('❌ Error in chunked parsing:', error)
    return NextResponse.json(
      { 
        error: 'Failed to parse PDF chunk',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
