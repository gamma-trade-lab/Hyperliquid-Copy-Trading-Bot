import { Schema, model, Document } from 'mongoose';

export interface IAnalysisResult extends Document {
  taskId: string;
  agentId: string;
  userId?: string;
  type: string;
  content: Record<string, any>;
  summary?: string;
  confidence?: number;
  metadata: Record<string, any>;
  relatedEntities?: string[];
  tags?: string[];
  timestamp: Date;
}

const analysisResultSchema = new Schema<IAnalysisResult>({
  taskId: {
    type: String,
    required: true,
    index: true
  },
  agentId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: false,
    index: true
  },
  type: {
    type: String,
    required: true
  },
  content: {
    type: Map,
    of: Schema.Types.Mixed,
    required: true
  },
  summary: {
    type: String
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  relatedEntities: [{
    type: String
  }],
  tags: [{
    type: String
  }],
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create indexes for common queries
analysisResultSchema.index({ timestamp: -1 });
analysisResultSchema.index({ tags: 1 });
analysisResultSchema.index({ type: 1, timestamp: -1 });

export const AnalysisResult = model<IAnalysisResult>('AnalysisResult', analysisResultSchema); 