import { NextRequest, NextResponse } from 'next/server'
import { generateTopboxSyntax } from '@/lib/spssProcessingGenerators'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { varNames, varLabels, t2b, nonT2b, b2b, nonB2b } = body
    
    const labelsString = String(varLabels || '').split(/\r?\n/).filter(line => line.trim() !== '').join('|||')
    const syntax = generateTopboxSyntax(varNames, labelsString, t2b, nonT2b, b2b, nonB2b)
    
    return NextResponse.json({ success: true, syntax })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
