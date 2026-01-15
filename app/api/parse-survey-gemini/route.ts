import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini Client
const API_KEY = process.env.GEMINI_API_KEY || ''
if (!API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY environment variable is not set')
}
const genAI = new GoogleGenerativeAI(API_KEY)
const MODEL_NAME = 'gemini-2.5-flash' // Using Gemini 2.5 Flash model

/**
 * Master Prompt for Market Research Survey Parsing
 * Enhanced with strict JSON format requirements to ensure valid output
 */
const MASTER_PROMPT = `Bạn là chuyên gia phân tích Bảng câu hỏi (BCH) Market Research.
Nhiệm vụ: Đọc PDF và trả về MỘT MẢNG JSON hợp lệ, không có text thừa.

QUAN TRỌNG - PHẢI TUÂN THỦ:
- Chỉ trả về JSON array, bắt đầu bằng [ và kết thúc bằng ]
- KHÔNG có text giải thích trước hoặc sau JSON
- KHÔNG có markdown code blocks (\`\`\`json)
- Tất cả strings phải được đóng dấu ngoặc kép đúng cách
- Escape các ký tự đặc biệt trong strings: \\", \\n, \\\\
- Đảm bảo JSON HOÀN CHỈNH - không được cắt cụt ở giữa
- Mỗi object phải có đầy đủ các trường và đóng ngoặc đúng cách

PHÂN LOẠI TYPE:
- "Note: SA" hoặc "SCRIPT: HỎI TẤT CẢ" → type:"SA"
- "Note: MA" → type:"MA"
- "Note: SA/MA per attribute" → type:"SA_Grid" hoặc "MA_Grid"
- "Ranking = 5" → type:"Rank_Fixed", limit:5
- "Ranking upto 5" → type:"Rank_Upto", limit:5
- "OE/OA" hoặc nhãn có "(ghi rõ)" → type:"OE"
- "OE/OA per attribute" hoặc "OE Grid" → type:"OE_Grid" (chỉ có rows, KHÔNG có columns)

LOGIC:
- "SCRIPT: HỎI TẤT CẢ" → logic.type:"Ask All"
- "Piping code in Q8" hoặc "Show codes in Q8" hoặc "Piping code from Q8" → logic.piping_source:"Q8"
  * Với Grid questions (SA_Grid, MA_Grid): columns = lấy options từ Q8
  * Với MA questions: options = lấy tất cả options từ Q8 (code và label)
- "ASK FOR RESPONDENTS CHOSE CODE 6-10 IN Q5" hoặc "ASK FOR RESPONDENTS CHOSE CODE 6, 7, 8, 9, 10 IN Q5" → logic.piping_source:"Q5" VÀ logic.ask_if_condition:"IF (Q5R6 = 6 OR Q5R7 = 7 OR Q5R8 = 8 OR Q5R9 = 9 OR Q5R10 = 10)"
- "ASK IF RESPONDENTS CHOSE CODE 1 IN Q3" → logic.piping_source:"Q3" VÀ logic.ask_if_condition:"IF (Q3R1 = 1)"
- "ASK FOR" và "ASK IF" là giống nhau - đều dùng để tạo ask_if_condition
- Format ask_if_condition: Với MA questions, format là QXRX = X (ví dụ: Q5R6 = 6). Với SA questions, format là QX = X (ví dụ: Q3 = 1)
- Extract source question ID từ pattern "IN QX", "FROM QX" hoặc "IN QUESTION X"
- Extract codes từ pattern "CODE 6-10" (range) hoặc "CODE 6, 7, 8" (list)
- "None = SA Exclusive" → codeType:"Exclusive" cho option "Không có/None"
- TERMINATE (codeType:"Terminate" và logic.terminate_if) - QUY LUẬT ĐƠN GIẢN:
  * Khi trong bảng câu hỏi có cột "Logic option", "Logic", "EXCLUSIVE" với giá trị "TERMINATE" → đánh dấu codeType:"Terminate" cho options tương ứng VÀ tạo logic.terminate_if
  * Format terminate_if:
    - SA: "IF QX = code" hoặc "IF QX = code1 or QX = code2" (không ngoặc, dùng "or")
    - MA: 
      * Nếu terminate khi CHỌN code: "IF (QXRcode = code)" hoặc "IF (QXRcode1 = code1 or QXRcode2 = code2)" (có ngoặc, có R)
      * Nếu terminate khi KHÔNG CHỌN code (không chọn = missing): "IF MIS(QXRcode)" hoặc "IF MIS(QXRcode1) or MIS(QXRcode2)" (dùng hàm MIS, không ngoặc ngoài)
  * Ví dụ SA: Code 3 có "TERMINATE" → codeType:"Terminate" VÀ logic.terminate_if:"IF Q7 = 3"
  * Ví dụ SA: Code 1, 2, 7 có "TERMINATE" → các options code 1, 2, 7 có codeType:"Terminate" VÀ logic.terminate_if:"IF Q3 = 1 or Q3 = 2 or Q3 = 7"
  * Ví dụ MA (chọn code): Code 1 có "TERMINATE" → codeType:"Terminate" VÀ logic.terminate_if:"IF (Q4R1 = 1)"
  * Ví dụ MA (không chọn code): Q4 là câu MA, terminate if không chọn code 1 → codeType:"Terminate" cho code 1 VÀ logic.terminate_if:"IF MIS(Q4R1)"


GRID QUESTIONS (SA_Grid, MA_Grid):
- Nếu có "Piping code in QX" hoặc "Show codes in QX" hoặc "Ask for codes in QX" hoặc "Piping code from QX":
  → columns = lấy code và label từ câu QX (ví dụ: nếu "Piping code in Q8" thì columns = options của Q8)
  → rows = các attributes như đang làm (ví dụ: "Chi phí thấp", "Chất lượng tốt", etc.)
- Nếu không có piping: rows và columns như bình thường

MA QUESTIONS VỚI PIPING CODE (QUAN TRỌNG):
- Nếu có "Piping code from QX" hoặc "Piping code in QX" hoặc "Show codes in QX":
  → logic.piping_source:"QX"
  → logic.type:"Piping"
  → options = COPY TẤT CẢ options từ câu QX (tìm trong JSON array đã parse, lấy question có id = QX, copy toàn bộ options của question đó)
  → Bao gồm TẤT CẢ code và label từ QX (kể cả code có "Khác (ghi rõ)")
  → Ví dụ: Q11 có "Piping code from Q10" → Tìm question có id:"Q10" trong JSON, copy tất cả options của Q10 sang Q11.options
  → QUAN TRỌNG: Phải copy cả code và label, không được bỏ sót bất kỳ option nào từ QX

OE_Grid:
- Chỉ có rows, KHÔNG có columns (columns = [])

OPTIONS VỚI "(GHI RÕ)":
- Nếu option có code X với label "Khác (ghi rõ)" hoặc bất kỳ label nào có "(ghi rõ)":
  → Giữ nguyên option code X
  → Thêm thêm 1 option nữa với code X_O (ví dụ: 99 → thêm 99_O) với label giống hệt (ví dụ: "Khác (ghi rõ)")
  → Ví dụ: Code 99 "Khác (ghi rõ)" → có cả {code: 99, label: "Khác (ghi rõ)"} VÀ {code: "99_O", label: "Khác (ghi rõ)"}

OPTIONS VỚI CODE TYPE (Normal, Exclusive, Trap, Other, Terminate):
- Mặc định tất cả options có codeType:"Normal" (nếu không có chỉ thị khác)
- Nếu có "None = SA Exclusive" hoặc label có "Exclusive" → codeType:"Exclusive"
- Nếu có "(ghi rõ)" trong label → codeType:"Other"
- Nếu trong bảng có cột "Logic option", "Logic", "EXCLUSIVE" hoặc tương tự:
  * Giá trị "TERMINATE" → codeType:"Terminate" VÀ tạo logic.terminate_if
  * Giá trị "Trap" → codeType:"Trap"
  * Giá trị "Exclusive" → codeType:"Exclusive"
  * Giá trị "Normal" → codeType:"Normal"
  * Giá trị "Other" → codeType:"Other"

LÀM SẠCH:
- Nối các dòng text bị xuống dòng sai thành 1 chuỗi
- Xóa "TERMINATE", "Note:", "SCRIPT:", "Quota", "[IF...]" khỏi label, đưa vào instruction
- Label: chỉ Tiếng Việt, bỏ Tiếng Anh

ĐỊNH DẠNG JSON CHÍNH XÁC:
[
  {
    "id": "Q1",
    "type": "SA",
    "instruction": "Lời dẫn gốc (Note, SCRIPT, etc.)",
    "label": "Nội dung câu hỏi sạch (chỉ Tiếng Việt)",
    "options": [
      {"code": 1, "label": "Đáp án 1", "codeType": "Normal"},
      {"code": 99, "label": "Không có/None", "codeType": "Exclusive"},
      {"code": 98, "label": "Khác", "codeType": "Trap"},
      {"code": 97, "label": "Dưới 18 tuổi", "codeType": "Terminate"}
    ],
    "rows": [],
    "columns": [],
    "logic": {
      "type": "Normal",
      "piping_source": null,
      "terminate_if": "IF Q1 = 97",
      "ask_if_condition": null
    }
  }
]

YÊU CẦU CUỐI: Trả về ĐÚNG ĐỊNH DẠNG JSON array như trên, KHÔNG có text nào khác.`

/**
 * Convert file to base64 (Node.js server-side)
 */
async function fileToBase64(file: File): Promise<string> {
  // Convert File to ArrayBuffer, then to Buffer, then to base64
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return buffer.toString('base64')
}

/**
 * Clean and fix common JSON syntax errors
 * Enhanced to handle unterminated strings and control characters
 */
function fixJSONSyntax(jsonText: string): string {
  let fixed = jsonText.trim()
  
  // Remove comments
  fixed = fixed.replace(/\/\/.*$/gm, '')
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '')
  
  // Fix control characters in string values - escape them properly
  // Use a state machine to properly handle strings and escape sequences
  let result = ''
  let inString = false
  let escapeNext = false
  
  for (let i = 0; i < fixed.length; i++) {
    const char = fixed[i]
    const charCode = char.charCodeAt(0)
    
    if (escapeNext) {
      // We're in an escape sequence, just add the character
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
      // Inside a string - escape control characters that aren't already escaped
      if (charCode === 0x08) {
        result += '\\b'
      } else if (charCode === 0x09) {
        result += '\\t'
      } else if (charCode === 0x0A) {
        result += '\\n'
      } else if (charCode === 0x0C) {
        result += '\\f'
      } else if (charCode === 0x0D) {
        result += '\\r'
      } else if (charCode >= 0x00 && charCode <= 0x1F) {
        // Other control characters - remove them
        continue
      } else if (charCode === 0x7F) {
        // DEL character - remove it
        continue
      } else {
        result += char
      }
    } else {
      // Outside string - keep the character (control chars outside strings are handled by JSON.parse)
      result += char
    }
  }
  
  fixed = result
  
  // Fix single quotes to double quotes for keys
  fixed = fixed.replace(/'([^']+)'\s*:/g, '"$1":')
  fixed = fixed.replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":')
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
  
  // Remove trailing commas
  fixed = fixed.replace(/,\s*}/g, '}')
  fixed = fixed.replace(/,\s*]/g, ']')
  fixed = fixed.replace(/,(\s*\n\s*[}\]])/g, '$1')
  fixed = fixed.replace(/,\s*,/g, ',')
  
  // Fix unterminated strings - find strings that start with " but don't end properly
  // This regex finds strings that are not properly closed
  try {
    // Try to fix unterminated strings in object values
    // Match pattern: "key": "value... (without closing quote)
    fixed = fixed.replace(/("(?:[^"\\]|\\.)*")\s*:\s*"([^"]*)$/gm, (match, key, value) => {
      // If value doesn't end with quote, try to find where it should end
      // Look for common patterns that might indicate end of string
      const cleanedValue = value
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .trim()
      return `${key}: "${cleanedValue}"`
    })
  } catch (e) {
    // If regex fails, continue with original
  }
  
  return fixed.trim()
}

/**
 * Attempt to repair unterminated JSON strings
 * More robust approach: scan through JSON and fix unmatched quotes
 */
function repairUnterminatedJSON(jsonText: string): string {
  let repaired = jsonText
  const lines = repaired.split('\n')
  const repairedLines: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    const trimmed = line.trim()
    
    // Skip empty lines
    if (!trimmed) {
      repairedLines.push(line)
      continue
    }
    
    // Count quotes (simple count, will handle escaped quotes separately)
    const quoteMatches = line.match(/"/g)
    const quoteCount = quoteMatches ? quoteMatches.length : 0
    
    // If odd number of quotes, might be unterminated
    if (quoteCount % 2 !== 0) {
      const nextLine = i < lines.length - 1 ? lines[i + 1] : ''
      const nextTrimmed = nextLine.trim()
      
      // Check if this looks like a string value that's not closed
      // Pattern: "key": "value... (without closing quote)
      const isValuePattern = /"\s*:\s*"[^"]*$/.test(trimmed)
      
      if (isValuePattern) {
        // Check what comes next to decide if we should close the string
        if (nextTrimmed.startsWith('"') && nextTrimmed.includes('":')) {
          // Next line is a new key, close this string
          if (!trimmed.endsWith('"')) {
            line = line.replace(/(\s*)$/, '"$1')
            console.log(`  🔧 Fixed unterminated string on line ${i + 1}`)
          }
        } else if (nextTrimmed === ',' || nextTrimmed === '}' || nextTrimmed === ']' || !nextTrimmed) {
          // Next line is delimiter or empty, close the string
          if (!trimmed.endsWith('"')) {
            line = line.replace(/(\s*)$/, '"$1')
            console.log(`  🔧 Fixed unterminated string on line ${i + 1}`)
          }
        } else if (nextTrimmed && !nextTrimmed.match(/^["{\[]/)) {
          // Next line doesn't start JSON structure, might be continuation, close here
          if (!trimmed.endsWith('"')) {
            line = line.replace(/(\s*)$/, '"$1')
            console.log(`  🔧 Fixed unterminated string on line ${i + 1} (next line: ${nextTrimmed.substring(0, 20)}...)`)
          }
        }
      }
    }
    
    repairedLines.push(line)
  }
  
  return repairedLines.join('\n')
}

/**
 * Check if error is a 429 Too Many Requests error
 */
function isRateLimitError(error: any): boolean {
  return (
    error?.status === 429 ||
    error?.response?.status === 429 ||
    error?.message?.includes('429') ||
    error?.message?.toLowerCase().includes('rate limit') ||
    error?.message?.toLowerCase().includes('too many requests')
  )
}

/**
 * Exponential backoff delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now()
  let geminiApiCalled = false // Track if we actually called Gemini API
  let totalTokensUsed = 0 // Track total tokens
  let fileName = 'Unknown' // Track file name for error logs
  
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }
    
    fileName = file.name // Store for error logs
    
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      )
    }

    // 📊 LOG: File Information
    const fileSizeKB = (file.size / 1024).toFixed(2)
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(3)
    console.log('\n' + '='.repeat(80))
    console.log('📄 PDF UPLOAD REQUEST')
    console.log('='.repeat(80))
    console.log(`📋 File Name: ${file.name}`)
    console.log(`📏 File Size: ${fileSizeKB} KB (${fileSizeMB} MB)`)
    console.log(`📦 File Type: ${file.type}`)
    console.log(`🤖 Model: ${MODEL_NAME}`)
    console.log(`📝 Prompt Length: ${MASTER_PROMPT.length} characters (~${Math.ceil(MASTER_PROMPT.length / 4)} tokens estimated)`)
    console.log(`🔑 API Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`)
    
    // Note: Retry logic is handled client-side to avoid re-uploading large PDF files

    try {
      // Convert PDF to Base64
      const base64StartTime = Date.now()
      console.log('\n🔄 Converting PDF to Base64...')
      const base64Data = await fileToBase64(file)
      const base64SizeKB = (base64Data.length / 1024).toFixed(2)
      const base64Time = Date.now() - base64StartTime
      console.log(`✅ Base64 conversion completed in ${base64Time}ms`)
      console.log(`📊 Base64 Size: ${base64SizeKB} KB`)
      // Estimate input tokens: Base64 is ~33% larger, PDF images are roughly 1 token per 4 chars (conservative estimate)
      const estimatedInputTokens = Math.ceil((base64Data.length + MASTER_PROMPT.length) / 4)
      console.log(`🔢 Estimated Input Tokens: ~${estimatedInputTokens.toLocaleString()} tokens (Base64 PDF + Prompt)`)

      // Prepare the PDF part for Gemini
      const pdfPart = {
        inlineData: {
          data: base64Data,
          mimeType: 'application/pdf',
        },
      }

      const model = genAI.getGenerativeModel({ model: MODEL_NAME })

      // Generate content with JSON response
      const apiCallStartTime = Date.now()
      console.log('\n🚀 Calling Gemini API...')
      console.log(`🌐 Request URL: https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`)
      geminiApiCalled = true // Mark that we're calling Gemini API
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: MASTER_PROMPT }, pdfPart] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 32768, // Increased from 8192 to handle larger surveys
        },
      })

      const apiCallTime = Date.now() - apiCallStartTime
      const response = result.response
      
      // 📊 LOG: Token Usage (try to get from response metadata)
      let actualPromptTokens: number | null = null
      let actualCandidatesTokens: number | null = null
      let actualTotalTokens: number | null = null
      
      try {
        // Gemini API provides usage metadata in result.response.usageMetadata
        const usageMetadata = (result.response as any).usageMetadata
        if (usageMetadata) {
          actualPromptTokens = usageMetadata.promptTokenCount || null
          actualCandidatesTokens = usageMetadata.candidatesTokenCount || null
          actualTotalTokens = usageMetadata.totalTokenCount || null
          
          // Track total tokens
          if (actualTotalTokens) {
            totalTokensUsed = actualTotalTokens
          }
          
          console.log('\n💰 TOKEN USAGE (From API Metadata)')
          console.log('─'.repeat(80))
          console.log(`📥 Prompt Tokens: ${actualPromptTokens?.toLocaleString() || 'N/A'}`)
          console.log(`📤 Candidates Tokens: ${actualCandidatesTokens?.toLocaleString() || 'N/A'}`)
          console.log(`📊 Total Tokens: ${actualTotalTokens?.toLocaleString() || 'N/A'}`)
          console.log(`⏱️  API Response Time: ${apiCallTime}ms`)
        }
      } catch (usageError) {
        // Silently continue with estimates
      }
      
      if (!actualTotalTokens) {
        console.log('\n💰 TOKEN USAGE (Estimated)')
        console.log('─'.repeat(80))
        console.log(`📥 Input Tokens: ~${estimatedInputTokens.toLocaleString()} (estimated)`)
        console.log(`⏱️  API Response Time: ${apiCallTime}ms`)
        // Use estimated tokens if no actual data
        totalTokensUsed = estimatedInputTokens
      }

      let jsonText = response.text()
      const outputSizeKB = (jsonText.length / 1024).toFixed(2)
      const estimatedOutputTokens = Math.ceil(jsonText.length / 4)
      console.log(`📤 Response Size: ${outputSizeKB} KB (~${estimatedOutputTokens.toLocaleString()} output tokens estimated)`)
      
      // Check if response might be truncated (doesn't end with ])
      const trimmedJson = jsonText.trim()
      if (!trimmedJson.endsWith(']')) {
        console.warn(`⚠️  WARNING: Response might be truncated - doesn't end with ']'`)
        console.warn(`   Last 100 chars: ${trimmedJson.substring(Math.max(0, trimmedJson.length - 100))}`)
        
        // Try to detect if it's an incomplete object/array and fix it
        // Count open brackets vs close brackets
        const openBrackets = (trimmedJson.match(/\[/g) || []).length
        const closeBrackets = (trimmedJson.match(/\]/g) || []).length
        const openBraces = (trimmedJson.match(/\{/g) || []).length
        const closeBraces = (trimmedJson.match(/\}/g) || []).length
        
        console.warn(`   Brackets: [${openBrackets} open, ${closeBrackets} close]`)
        console.warn(`   Braces: {${openBraces} open, ${closeBraces} close}`)
        
        // If we have more opens than closes, try to close them
        if (openBrackets > closeBrackets || openBraces > closeBraces) {
          console.log(`🔧 Attempting to close incomplete JSON...`)
          let fixedJson = trimmedJson
          
          // Close any incomplete objects first
          const missingBraces = openBraces - closeBraces
          for (let i = 0; i < missingBraces; i++) {
            fixedJson += '\n  }'
          }
          
          // Close any incomplete arrays
          const missingBrackets = openBrackets - closeBrackets
          for (let i = 0; i < missingBrackets; i++) {
            fixedJson += '\n]'
          }
          
          jsonText = fixedJson
          console.log(`✅ Added ${missingBraces} closing braces and ${missingBrackets} closing brackets`)
        }
      }
      
      // Log first 500 chars of response for debugging
      console.log(`\n📝 Raw Response Preview (first 500 chars):`)
      console.log(jsonText.substring(0, 500))
      if (jsonText.length > 500) {
        console.log(`... (${jsonText.length - 500} more characters)`)
      }
      
      // Log first 500 chars of response for debugging
      console.log(`\n📝 Raw Response Preview (first 500 chars):`)
      console.log(jsonText.substring(0, 500))
      if (jsonText.length > 500) {
        console.log(`... (${jsonText.length - 500} more characters)`)
      }

      // Clean JSON text
      jsonText = jsonText.trim()

      // Remove markdown code blocks if present
      if (jsonText.includes('```json')) {
        const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch && jsonMatch[1]) {
          jsonText = jsonMatch[1].trim()
        }
      } else if (jsonText.includes('```')) {
        const codeMatch = jsonText.match(/```\s*([\s\S]*?)\s*```/)
        if (codeMatch && codeMatch[1]) {
          jsonText = codeMatch[1].trim()
        }
      }

      // Try to extract JSON from text
      const firstBracket = jsonText.indexOf('[')
      const firstBrace = jsonText.indexOf('{')

      if (firstBracket >= 0 && (firstBrace < 0 || firstBracket < firstBrace)) {
        const lastBracket = jsonText.lastIndexOf(']')
        if (lastBracket > firstBracket) {
          jsonText = jsonText.substring(firstBracket, lastBracket + 1)
        }
      } else if (firstBrace >= 0) {
        const lastBrace = jsonText.lastIndexOf('}')
        if (lastBrace > firstBrace) {
          jsonText = jsonText.substring(firstBrace, lastBrace + 1)
        }
      }

      jsonText = jsonText.trim()
      
      // First attempt: basic JSON cleaning
      jsonText = fixJSONSyntax(jsonText)
      
      // Parse JSON response
      console.log('\n🔧 Processing JSON response...')
      console.log(`📏 JSON Length: ${jsonText.length} characters`)
      
      let parsedData: any = null
      let parseAttempts = 0
      const maxParseAttempts = 3
      
      // Try parsing with progressively more aggressive repairs
      for (parseAttempts = 0; parseAttempts < maxParseAttempts; parseAttempts++) {
        try {
          parsedData = JSON.parse(jsonText)
          if (parseAttempts > 0) {
            console.log(`✅ JSON parsed successfully after ${parseAttempts + 1} attempt(s)`)
          }
          break // Success, exit loop
        } catch (parseError: any) {
          const errorMsg = parseError.message || ''
          console.warn(`⚠️  JSON Parse Attempt ${parseAttempts + 1} failed: ${errorMsg}`)
          
          if (parseAttempts < maxParseAttempts - 1) {
            // Try more aggressive repairs
            if (errorMsg.includes('Unterminated string') || errorMsg.includes('string')) {
              console.log('🔧 Attempting to repair unterminated strings...')
              jsonText = repairUnterminatedJSON(jsonText)
              jsonText = fixJSONSyntax(jsonText)
            } else {
              // For other errors, try extracting just the array portion
              const arrayMatch = jsonText.match(/\[[\s\S]*\]/)
              if (arrayMatch) {
                console.log('🔧 Attempting to extract JSON array from response...')
                jsonText = fixJSONSyntax(arrayMatch[0])
              } else {
                break // No more options, give up
              }
            }
          } else {
            // Last attempt failed, throw the error
            throw parseError
          }
        }
      }
      
      try {
        if (!parsedData) {
          // Final attempt with very aggressive extraction
          console.log('🔧 Final attempt: aggressive JSON extraction...')
          const firstBracket = jsonText.indexOf('[')
          const lastBracket = jsonText.lastIndexOf(']')
          
          if (firstBracket >= 0 && lastBracket > firstBracket) {
            const extracted = jsonText.substring(firstBracket, lastBracket + 1)
            console.log(`📦 Extracted ${extracted.length} characters from position ${firstBracket} to ${lastBracket}`)
            try {
              parsedData = JSON.parse(fixJSONSyntax(extracted))
            } catch (finalError: any) {
              console.error(`❌ Final extraction failed: ${finalError.message}`)
              console.error(`📋 Extracted text preview (first 500 chars):`)
              console.error(extracted.substring(0, 500))
              throw new Error(`Could not extract valid JSON array from response. Last error: ${finalError.message}`)
            }
          } else {
            console.error(`❌ Could not find valid JSON array boundaries`)
            console.error(`   First bracket at: ${firstBracket}, Last bracket at: ${lastBracket}`)
            console.error(`📋 Full response preview (first 2000 chars):`)
            console.error(jsonText.substring(0, 2000))
            console.error(`\n📋 Full response preview (last 500 chars):`)
            console.error(jsonText.substring(Math.max(0, jsonText.length - 500)))
            
            // Save full response for debugging (limit to avoid huge error messages)
            const responsePreview = jsonText.length > 5000 
              ? jsonText.substring(0, 2500) + '\n... [truncated] ...\n' + jsonText.substring(jsonText.length - 2500)
              : jsonText
            
            throw new Error(`Could not extract valid JSON array from response. Response preview (first 500 chars): ${jsonText.substring(0, 500)}`)
          }
        }

        let questionsArray: any[] = []

        if (Array.isArray(parsedData)) {
          questionsArray = parsedData
        } else if (parsedData.questions && Array.isArray(parsedData.questions)) {
          questionsArray = parsedData.questions
        } else if (parsedData.data && Array.isArray(parsedData.data)) {
          questionsArray = parsedData.data
        } else if (typeof parsedData === 'object' && parsedData !== null) {
          const arrayKeys = Object.keys(parsedData).filter(
            (key) => Array.isArray(parsedData[key])
          )
          if (arrayKeys.length > 0) {
            questionsArray = parsedData[arrayKeys[0]]
          } else {
            questionsArray = [parsedData]
          }
        }

        if (questionsArray.length > 0) {
          const totalTime = Date.now() - requestStartTime
          
          console.log('\n✅ PARSING SUCCESS')
          console.log('─'.repeat(80))
          console.log(`📊 Questions Parsed: ${questionsArray.length}`)
          console.log(`⏱️  Total Processing Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`)
          
          if (actualTotalTokens) {
            totalTokensUsed = actualTotalTokens
            console.log(`💰 Total Tokens (Actual): ${actualTotalTokens.toLocaleString()} tokens`)
            console.log(`   - Input: ${actualPromptTokens?.toLocaleString() || 'N/A'} tokens`)
            console.log(`   - Output: ${actualCandidatesTokens?.toLocaleString() || 'N/A'} tokens`)
          } else {
            const totalEstimatedTokens = estimatedInputTokens + estimatedOutputTokens
            totalTokensUsed = totalEstimatedTokens
            console.log(`💰 Total Tokens (Estimated): ~${totalEstimatedTokens.toLocaleString()} tokens`)
            console.log(`   - Input: ~${estimatedInputTokens.toLocaleString()} tokens`)
            console.log(`   - Output: ~${estimatedOutputTokens.toLocaleString()} tokens`)
          }
          
          console.log('\n📊 REQUEST SUMMARY')
          console.log('─'.repeat(80))
          console.log(`✅ Gemini API Called: YES`)
          console.log(`💰 Total Tokens Used: ${totalTokensUsed.toLocaleString()} tokens`)
          console.log(`🤖 Model: ${MODEL_NAME}`)
          console.log(`📄 File: ${fileName}`)
          console.log('='.repeat(80) + '\n')
          
          return NextResponse.json({ questions: questionsArray })
        } else {
          throw new Error('No questions found in parsed data')
        }
      } catch (parseError: any) {
        console.error('❌ JSON Parse Error:', parseError.message)
        
        // Try more aggressive fixes
        try {
          let fixedJson = fixJSONSyntax(jsonText)
          const arrayMatch = fixedJson.match(/\[[\s\S]*\]/)
          if (arrayMatch) {
            fixedJson = fixJSONSyntax(arrayMatch[0])
            const parsedData = JSON.parse(fixedJson)
            if (Array.isArray(parsedData)) {
              return NextResponse.json({ questions: parsedData })
            }
          }
        } catch (extractError: any) {
          console.error('❌ Failed to extract/fix JSON:', extractError.message)
        }

        // Log the raw JSON text for debugging
        console.error(`\n❌ JSON Parse Failed after all attempts`)
        console.error(`📋 Error: ${parseError.message}`)
        console.error(`📋 Raw JSON text length: ${jsonText.length} characters`)
        console.error(`📋 Raw JSON preview (first 2000 chars):`)
        console.error(jsonText.substring(0, 2000))
        console.error(`📋 Raw JSON preview (last 500 chars):`)
        console.error(jsonText.substring(Math.max(0, jsonText.length - 500)))
        
        // Return error with response preview for debugging
        const preview = jsonText.substring(0, 1000)
        const lastChars = jsonText.length > 1000 ? jsonText.substring(Math.max(0, jsonText.length - 200)) : ''
        
        return NextResponse.json({
          error: `Failed to parse JSON response: ${parseError.message}`,
          debug: {
            responseLength: jsonText.length,
            preview: preview,
            lastChars: lastChars,
            error: parseError.message
          }
        }, { status: 500 })
      }
    } catch (error: any) {
      const totalTime = Date.now() - requestStartTime
      console.error('\n❌ GEMINI API ERROR')
      console.error('─'.repeat(80))
      console.error(`⏱️  Time before error: ${totalTime}ms`)
      console.error(`🔴 Error:`, error?.message || error)
      if (error?.status) console.error(`📊 Status Code: ${error.status}`)
      if (error?.response) console.error(`📋 Response:`, JSON.stringify(error.response, null, 2))
      
      // Summary
      console.error('\n📊 REQUEST SUMMARY')
      console.error('─'.repeat(80))
      console.error(`✅ Gemini API Called: ${geminiApiCalled ? 'YES' : 'NO'}`)
      console.error(`📄 File: ${fileName}`)
      if (geminiApiCalled && totalTokensUsed > 0) {
        console.error(`💰 Tokens Used: ${totalTokensUsed.toLocaleString()}`)
      } else if (geminiApiCalled) {
        console.error(`💰 Tokens Used: Unknown (API call failed before response)`)
      } else {
        console.error(`💰 Tokens Used: 0 (API was never called due to error)`)
      }
      console.error('='.repeat(80) + '\n')
      
      if (isRateLimitError(error)) {
        return NextResponse.json(
          { error: 'Hệ thống Google đang bận, vui lòng thử lại sau 1 phút' },
          { status: 429 }
        )
      }

      throw error
    }
  } catch (error) {
    const totalTime = Date.now() - requestStartTime
    console.error('\n❌ API ROUTE ERROR')
    console.error('─'.repeat(80))
    console.error(`⏱️  Total time: ${totalTime}ms`)
    console.error(`🔴 Error:`, error instanceof Error ? error.message : 'Unknown error')
    
    // Summary for route-level errors
    console.error('\n📊 REQUEST SUMMARY')
    console.error('─'.repeat(80))
    console.error(`✅ Gemini API Called: ${geminiApiCalled ? 'YES' : 'NO'}`)
    console.error(`📄 File: ${fileName}`)
    if (geminiApiCalled && totalTokensUsed > 0) {
      console.error(`💰 Tokens Used: ${totalTokensUsed.toLocaleString()}`)
    } else {
      console.error(`💰 Tokens Used: 0 (Error occurred before API call)`)
    }
    console.error('='.repeat(80) + '\n')
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse PDF' },
      { status: 500 }
    )
  }
}

