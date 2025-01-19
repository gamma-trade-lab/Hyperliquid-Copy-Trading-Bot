'use client'

import { useState } from 'react'
import { processEmbedding, handleFileOperation } from '@/utils/serverOperations'

export default function EmbeddingComponent() {
  const [result, setResult] = useState<any>(null)
  
  async function handleProcess() {
    try {
      const data = await processEmbedding({ /* your input */ })
      setResult(data)
      
      // Example file operation
      await handleFileOperation('write', 'results.json', JSON.stringify(data))
    } catch (error) {
      console.error('Processing failed:', error)
    }
  }
  
  return (
    <div>
      <button onClick={handleProcess}>Process</button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  )
}