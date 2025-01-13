import { Schema, model } from 'mongoose';
const chatMessageSchema = new Schema({
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
const chatLogSchema = new Schema({
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
export const ChatLog = model('ChatLog', chatLogSchema);
