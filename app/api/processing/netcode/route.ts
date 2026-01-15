import { NextRequest, NextResponse } from 'next/server'
import { generateNetcodeSyntax } from '@/lib/spssProcessingGenerators'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { questionName, codes, labels } = body
    
    const syntax = generateNetcodeSyntax(questionName, codes, labels)
    
    return NextResponse.json({ success: true, syntax })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    )
  }
}
