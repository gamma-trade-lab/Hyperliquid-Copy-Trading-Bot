import fs from 'fs';
import path from 'path';
import { CharacterSchema } from './types.js';
export class CharacterLoadError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CharacterLoadError';
    }
}
export async function loadCharacter(filePath) {
    try {
        const resolvedPath = path.resolve(process.cwd(), filePath);
        const fileContents = await fs.promises.readFile(resolvedPath, 'utf-8');
        const parsedContents = JSON.parse(fileContents);
        const result = CharacterSchema.safeParse(parsedContents);
        if (!result.success) {
            throw new CharacterLoadError(`Invalid character configuration: ${result.error.message}`);
        }
        return result.data;
    }
    catch (error) {
        if (error instanceof CharacterLoadError) {
            throw error;
        }
        throw new CharacterLoadError(`Failed to load character configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
}
