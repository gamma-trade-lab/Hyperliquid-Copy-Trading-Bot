declare module 'node-ollama' {
  export interface GenerateParams {
    model: string;
    prompt: string;
    system?: string;
    template?: string;
    context?: string[];
    stream?: boolean;
    raw?: boolean;
    format?: string;
    options?: {
      temperature?: number;
      top_p?: number;
      top_k?: number;
      num_predict?: number;
      stop?: string[];
      seed?: number;
    };
  }

  export interface GenerateResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    context?: number[];
    total_duration?: number;
    load_duration?: number;
    prompt_eval_duration?: number;
    eval_duration?: number;
  }

  export default class Ollama {
    constructor(config?: { host?: string });
    generate(params: GenerateParams): Promise<GenerateResponse>;
    generateStream(params: GenerateParams): AsyncGenerator<GenerateResponse>;
  }
}
