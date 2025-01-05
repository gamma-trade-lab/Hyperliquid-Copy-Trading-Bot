import { loadCharacter, CharacterLoadError } from '../loadCharacter';
import path from 'path';

describe('loadCharacter', () => {
  const validCharacterPath = path.join(__dirname, '../config/myAgent.character.json');
  const invalidCharacterPath = path.join(__dirname, '../config/nonexistent.character.json');

  it('should load a valid character configuration', async () => {
    const character = await loadCharacter(validCharacterPath);
    expect(character).toBeDefined();
    expect(character.name).toBe('MemeAgent');
    expect(character.clients).toContain('twitter');
    expect(character.templates).toBeDefined();
    expect(character.templates.twitterPostTemplate).toBeDefined();
    expect(character.templates.twitterReplyTemplate).toBeDefined();
  });

  it('should throw CharacterLoadError for non-existent file', async () => {
    await expect(loadCharacter(invalidCharacterPath))
      .rejects
      .toThrow(CharacterLoadError);
  });

  it('should throw CharacterLoadError for invalid JSON', async () => {
    const invalidJsonPath = path.join(__dirname, '../config/invalid.character.json');
    // Create temporary invalid JSON file
    require('fs').writeFileSync(invalidJsonPath, '{ invalid json', 'utf-8');
    
    await expect(loadCharacter(invalidJsonPath))
      .rejects
      .toThrow(CharacterLoadError);
      
    // Clean up
    require('fs').unlinkSync(invalidJsonPath);
  });
});
