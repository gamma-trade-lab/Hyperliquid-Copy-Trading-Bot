export interface Character {
    name: string;
    type: string;
    settings?: Record<string, any>;
    personality?: {
      traits?: string[];
      style?: string;
      voice?: string;
    };
    knowledge?: string[];
    capabilities?: string[];
    background?: string[];
    goals?: string[];
    preferences?: Record<string, any>;
    interests?: string[];
    relationships?: Record<string, any>;
    memories?: any[];
    states?: Record<string, any>;
  }