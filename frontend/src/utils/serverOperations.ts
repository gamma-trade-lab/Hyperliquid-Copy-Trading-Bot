export async function processEmbedding(input: any) {
    const response = await fetch('/api/embedding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to process embedding: ${response.statusText}`)
    }
    
    return response.json()
  }
  
  export async function handleFileOperation(operation: 'read' | 'write', filePath: string, data?: string) {
    const response = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation, filePath, data })
    })
    
    if (!response.ok) {
      throw new Error(`File operation failed: ${response.statusText}`)
    }
    
    return response.json()
  }
  