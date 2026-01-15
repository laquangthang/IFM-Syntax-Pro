import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const excelFile = formData.get('excelFile') as File
    const codelistFile = formData.get('codelistFile') as File
    const variableName = formData.get('variableName') as string

    if (!excelFile || !codelistFile || !variableName) {
      return NextResponse.json(
        { success: false, error: 'Missing required files or variable name' },
        { status: 400 }
      )
    }

    // Save files temporarily
    const excelBuffer = Buffer.from(await excelFile.arrayBuffer())
    const codelistBuffer = Buffer.from(await codelistFile.arrayBuffer())
    
    const excelPath = join(tmpdir(), `excel_${Date.now()}.xlsx`)
    const codelistPath = join(tmpdir(), `codelist_${Date.now()}.txt`)

    await writeFile(excelPath, excelBuffer)
    await writeFile(codelistPath, codelistBuffer)

    try {
      // Read Excel file
      const workbook = XLSX.readFile(excelPath)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]

      // Read data with option to include empty columns
      const data = XLSX.utils.sheet_to_json(worksheet, {
        defval: null,
        blankrows: true
      })

      // Read codelist file
      const codelistContent = codelistBuffer.toString('utf8')

      // Generate syntax
      const syntax = generateCodingOASyntax(data, codelistContent, variableName)

      return NextResponse.json({ success: true, syntax })
    } finally {
      // Clean up temp files
      await unlink(excelPath).catch(() => {})
      await unlink(codelistPath).catch(() => {})
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

function generateCodingOASyntax(data: any[], codelistContent: string, variableName: string): string {
  let syntax = ''
  
  // Find R columns (R1, R2, R3, ...)
  const rColumns: string[] = []
  if (data.length > 0) {
    const firstRow = data[0]
    Object.keys(firstRow).forEach(key => {
      if (key.match(/^R\d+$/)) {
        rColumns.push(key)
      }
    })
    // Sort by number
    rColumns.sort((a, b) => {
      const numA = parseInt(a.substring(1))
      const numB = parseInt(b.substring(1))
      return numA - numB
    })
  }
  
  // Generate IF statements for each R column
  rColumns.forEach((rCol, index) => {
    const codeNum = index + 1
    const varName = `${variableName}_code${codeNum}`
    
    data.forEach(row => {
      const vrid = row.Vrid || row.VRID || row.vrid
      const rValue = row[rCol]
      
      if (vrid && rValue !== undefined && rValue !== null && String(rValue).trim() !== '') {
        syntax += `IF Vrid = ${vrid} ${varName} = ${rValue}.\n`
      }
    })
    
    syntax += '\n'
  })
  
  // Generate value labels for all variables
  if (rColumns.length > 0) {
    const varNames = rColumns.map((_, index) => `${variableName}_code${index + 1}`)
    
    if (varNames.length === 1) {
      syntax += `val lab ${varNames[0]}\n`
    } else {
      syntax += `val lab ${varNames[0]} to ${varNames[varNames.length - 1]}\n`
    }
    
    // Parse codelist content
    const lines = codelistContent.split('\n').filter(line => line.trim())
    lines.forEach(line => {
      const trimmed = line.trim()
      if (trimmed) {
        const match = trimmed.match(/^(\d+)["']?(.+?)["']?$/)
        if (match) {
          const code = match[1]
          const label = match[2].replace(/^["']|["']$/g, '').trim()
          syntax += `    ${code} "${label}"\n`
        }
      }
    })
    syntax += '.\n'
  }
  
  return syntax
}
