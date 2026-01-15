import { NextRequest, NextResponse } from 'next/server'
import { generateReloopSyntax } from '@/lib/spssProcessingGenerators'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { questionName, numAttributes, numBrands, rebaseQuestion, brandNames, attributeTexts } = body
    
    const safeBrandNames = String(brandNames || '').split(/\r?\n/).filter(line => line.trim() !== '').join('|||')
    const safeAttributeTexts = String(attributeTexts || '').split(/\r?\n/).filter(line => line.trim() !== '').join('|||')
    const syntax = generateReloopSyntax(
      questionName, 
      parseInt(String(numAttributes)), 
      parseInt(String(numBrands)), 
      rebaseQuestion, 
      safeBrandNames, 
      safeAttributeTexts
    )
    
    return NextResponse.json({ success: true, syntax })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
