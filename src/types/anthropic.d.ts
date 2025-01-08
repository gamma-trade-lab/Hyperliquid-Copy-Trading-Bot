declare module '@anthropic-ai/sdk' {
  export interface ContentBlock {
    type: 'text';
    text: string;
  }

  export interface Message {
    id: string;
    type: string;
    role: string;
    content: (string | ContentBlock)[];
    model: string;
    stop_reason: string | null;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  }

  export interface MessageCreateParams {
    model: string;
    max_tokens?: number;
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
    stream?: boolean;
    temperature?: number;
    top_p?: number;
    top_k?: number;
  }

  export class Messages {
    create(params: MessageCreateParams): Promise<Message>;
  }

  export default class Anthropic {
    messages: Messages;
    constructor(config: { apiKey: string });
  }
}
