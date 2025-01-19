import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function POST(req: Request) {
  try {
    const { operation, filePath, data } = await req.json()
    const safePath = path.join(process.cwd(), 'data', filePath)
    
    switch (operation) {
      case 'read':
        const content = await fs.readFile(safePath, 'utf-8')
        return NextResponse.json({ content })
        
      case 'write':
        await fs.writeFile(safePath, data)
        return NextResponse.json({ success: true })
        
      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
