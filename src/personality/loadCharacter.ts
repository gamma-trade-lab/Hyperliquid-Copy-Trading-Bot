import fs from 'fs';
import path from 'path';
import { CharacterSchema, Character } from '@/personality/types';

export class CharacterLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CharacterLoadError';
  }
}

export async function loadCharacter(filePath: string): Promise<Character> {
  try {
    const resolvedPath = path.resolve(process.cwd(), filePath);
    const fileContents = await fs.promises.readFile(resolvedPath, 'utf-8');
    const parsedContents = JSON.parse(fileContents);
    
    const result = CharacterSchema.safeParse(parsedContents);
    if (!result.success) {
      throw new CharacterLoadError(`Invalid character configuration: ${result.error.message}`);
    }
    
    return result.data;
  } catch (error) {
    if (error instanceof CharacterLoadError) {
      throw error;
    }
    throw new CharacterLoadError(
      `Failed to load character configuration: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
