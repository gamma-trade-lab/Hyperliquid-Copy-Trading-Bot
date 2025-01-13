export class ChatHistoryManager {
    static MAX_HISTORY = 50;
    messages = [];
    addMessage(role, content) {
        const message = {
            role,
            content,
            timestamp: Date.now()
        };
        this.messages.push(message);
        // Maintain history size limit
        if (this.messages.length > ChatHistoryManager.MAX_HISTORY) {
            this.messages = this.messages.slice(-ChatHistoryManager.MAX_HISTORY);
        }
    }
    getContext() {
        return this.messages.map(msg => `${msg.role}: ${msg.content}`);
    }
    clearHistory() {
        this.messages = [];
    }
    // Helper method to get recent context window
    getRecentContext(windowSize = 5) {
        return this.messages.slice(-windowSize);
    }
    // Helper method to get messages by role
    getMessagesByRole(role) {
        return this.messages.filter(msg => msg.role === role);
    }
}
