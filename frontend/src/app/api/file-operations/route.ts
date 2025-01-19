import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(req: Request) {
  try {
    const { operation, filePath, data } = await req.json()
    
    switch (operation) {
      case 'read':
        const content = fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8')
        return NextResponse.json({ content })
      
      case 'write':
        fs.writeFileSync(path.join(process.cwd(), filePath), data)
        return NextResponse.json({ success: true })
      
      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}