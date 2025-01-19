export async function readFile(filePath: string): Promise<string> {
    const response = await fetch('/api/file-operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'read',
        filePath
      })
    })
    
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    return data.content
  }
  
  export async function writeFile(filePath: string, data: string): Promise<void> {
    const response = await fetch('/api/file-operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'write',
        filePath,
        data
      })
    })
    
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
  }
  