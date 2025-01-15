import { Interface as ReadlineInterface } from 'readline';
import { elizaLogger } from "@ai16z/eliza";

export class ChatInputHandler {
  private rl: ReadlineInterface;
  private inputBuffer: string = '';
  private isProcessing: boolean = false;

  constructor(readline: ReadlineInterface) {
    this.rl = readline;
    
    // Configure readline
    const input = (this.rl as any).input;
    input.setRawMode(true);
    input.setEncoding('utf8');
    
    // Handle raw input
    input.on('data', this.handleRawInput.bind(this));
  }

  private handleRawInput(key: Buffer) {
    // Prevent duplicate processing
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      const char = key.toString();

      // Handle special keys
      switch (char) {
        case '\u0003': // Ctrl+C
          process.exit();
          break;
          
        case '\r':
        case '\n':
          // Handle enter key
          this.rl.write('\n');
          this.processLine(this.inputBuffer);
          this.inputBuffer = '';
          break;
          
        case '\u007F': // Backspace
          if (this.inputBuffer.length > 0) {
            this.inputBuffer = this.inputBuffer.slice(0, -1);
            this.rl.write('\b \b'); // Move back, write space, move back again
          }
          break;
          
        default:
          // Only add printable characters
          if (char >= ' ' && char <= '~') {
            this.inputBuffer += char;
            this.rl.write(char);
          }
      }
    } catch (error) {
      elizaLogger.error('Error processing input:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processLine(line: string) {
    if (line.trim()) {
      // Emit processed line event
      this.rl.emit('line', line);
    }
  }

  public prompt(promptText: string = '> ') {
    this.rl.write(promptText);
  }

  public close() {
    this.rl.close();
  }
}