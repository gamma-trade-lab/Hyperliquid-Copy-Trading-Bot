import { Schema, model, Document } from 'mongoose';

interface IChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface IChatLog extends Document {
  sessionId: string;
  userId?: string;
  agentId: string;
  messages: IChatMessage[];
  metadata: Record<string, any>;
  startedAt: Date;
  endedAt?: Date;
  status: 'active' | 'completed' | 'terminated';
}

const chatMessageSchema = new Schema<IChatMessage>({
  role: {
    type: String,
    required: true,
    enum: ['user', 'assistant', 'system']
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const chatLogSchema = new Schema<IChatLog>({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: false
  },
  agentId: {
    type: String,
    required: true
  },
  messages: [chatMessageSchema],
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'terminated'],
    default: 'active'
  }
}, {
  timestamps: true
});

export const ChatLog = model<IChatLog>('ChatLog', chatLogSchema); 