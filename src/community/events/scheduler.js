// src/community/events/scheduler.ts
import { EventEmitter } from 'events';
export var EventType;
(function (EventType) {
    EventType["AMA"] = "ama";
    EventType["TRADING_COMPETITION"] = "trading_competition";
    EventType["COMMUNITY_CALL"] = "community_call";
    EventType["TWITTER_SPACE"] = "twitter_space";
    EventType["GIVEAWAY"] = "giveaway";
    EventType["EDUCATIONAL"] = "educational";
})(EventType || (EventType = {}));
var EventStatus;
(function (EventStatus) {
    EventStatus["SCHEDULED"] = "scheduled";
    EventStatus["LIVE"] = "live";
    EventStatus["COMPLETED"] = "completed";
    EventStatus["CANCELLED"] = "cancelled";
})(EventStatus || (EventStatus = {}));
export class EventScheduler extends EventEmitter {
    events;
    aiService;
    CHECK_INTERVAL = 60000; // 1 minute
    REMINDER_INTERVALS = [
        24 * 60 * 60 * 1000, // 24 hours
        60 * 60 * 1000, // 1 hour
        15 * 60 * 1000 // 15 minutes
    ];
    constructor(aiService) {
        super();
        this.events = new Map();
        this.aiService = aiService;
        this.startEventMonitoring();
    }
    async scheduleEvent(eventData) {
        try {
            // Validate event data
            this.validateEventData(eventData);
            const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const event = {
                ...eventData,
                id: eventId,
                status: EventStatus.SCHEDULED
            };
            // Check for time conflicts
            if (this.hasTimeConflict(event)) {
                throw new Error('Time conflict with existing event');
            }
            this.events.set(eventId, event);
            // Schedule recurring events if needed
            if (event.recurringPattern) {
                await this.scheduleRecurringEvents(event);
            }
            this.emit('eventScheduled', event);
            return eventId;
        }
        catch (error) {
            console.error('Error scheduling event:', error);
            throw error;
        }
    }
    validateEventData(eventData) {
        if (!eventData.title || !eventData.description) {
            throw new Error('Event title and description are required');
        }
        if (!eventData.startTime || !eventData.endTime) {
            throw new Error('Event start and end times are required');
        }
        if (eventData.startTime >= eventData.endTime) {
            throw new Error('End time must be after start time');
        }
        if (eventData.startTime < Date.now()) {
            throw new Error('Cannot schedule events in the past');
        }
    }
    hasTimeConflict(newEvent) {
        for (const existingEvent of this.events.values()) {
            if (existingEvent.status === EventStatus.CANCELLED)
                continue;
            const overlap = (newEvent.startTime < existingEvent.endTime &&
                newEvent.endTime > existingEvent.startTime);
            if (overlap)
                return true;
        }
        return false;
    }
    async scheduleRecurringEvents(event) {
        if (!event.recurringPattern)
            return;
        const { frequency, interval, endDate, maxOccurrences } = event.recurringPattern;
        let occurrences = 0;
        let currentDate = event.startTime;
        while ((!endDate || currentDate < endDate) &&
            (!maxOccurrences || occurrences < maxOccurrences)) {
            // Calculate next occurrence
            currentDate = this.calculateNextOccurrence(currentDate, frequency, interval);
            if (!currentDate)
                break;
            // Create recurring instance
            const recurringEvent = {
                ...event,
                id: `${event.id}-${occurrences + 1}`,
                startTime: currentDate,
                endTime: currentDate + (event.endTime - event.startTime),
                metadata: {
                    ...event.metadata,
                    isRecurring: true,
                    originalEventId: event.id,
                    occurrenceNumber: occurrences + 1
                }
            };
            this.events.set(recurringEvent.id, recurringEvent);
            occurrences++;
        }
    }
    calculateNextOccurrence(currentDate, frequency, interval) {
        const date = new Date(currentDate);
        switch (frequency) {
            case 'daily':
                date.setDate(date.getDate() + interval);
                break;
            case 'weekly':
                date.setDate(date.getDate() + (interval * 7));
                break;
            case 'monthly':
                date.setMonth(date.getMonth() + interval);
                break;
            default:
                return 0;
        }
        return date.getTime();
    }
    async updateEvent(eventId, updates) {
        const event = this.events.get(eventId);
        if (!event) {
            throw new Error('Event not found');
        }
        // Don't allow updating past events
        if (event.startTime < Date.now()) {
            throw new Error('Cannot update past events');
        }
        const updatedEvent = {
            ...event,
            ...updates
        };
        // Validate updates
        this.validateEventData(updatedEvent);
        // Check for time conflicts if time was updated
        if (updates.startTime || updates.endTime) {
            const otherEvents = Array.from(this.events.values())
                .filter(e => e.id !== eventId);
            const hasConflict = otherEvents.some(e => updatedEvent.startTime < e.endTime &&
                updatedEvent.endTime > e.startTime);
            if (hasConflict) {
                throw new Error('Time conflict with existing event');
            }
        }
        this.events.set(eventId, updatedEvent);
        this.emit('eventUpdated', updatedEvent);
    }
    cancelEvent(eventId, reason) {
        const event = this.events.get(eventId);
        if (!event) {
            throw new Error('Event not found');
        }
        event.status = EventStatus.CANCELLED;
        this.events.set(eventId, event);
        this.emit('eventCancelled', { event, reason });
    }
    startEventMonitoring() {
        setInterval(() => {
            this.checkUpcomingEvents();
        }, this.CHECK_INTERVAL);
    }
    async checkUpcomingEvents() {
        const now = Date.now();
        for (const event of this.events.values()) {
            if (event.status !== EventStatus.SCHEDULED)
                continue;
            // Check if event should start
            if (now >= event.startTime && now < event.endTime) {
                await this.startEvent(event);
                continue;
            }
            // Check if event should end
            if (now >= event.endTime) {
                await this.completeEvent(event);
                continue;
            }
            // Send reminders
            this.checkReminders(event);
        }
    }
    async startEvent(event) {
        event.status = EventStatus.LIVE;
        this.events.set(event.id, event);
        this.emit('eventStarted', event);
    }
    async completeEvent(event) {
        event.status = EventStatus.COMPLETED;
        this.events.set(event.id, event);
        this.emit('eventCompleted', event);
    }
    checkReminders(event) {
        const timeToEvent = event.startTime - Date.now();
        this.REMINDER_INTERVALS.forEach(interval => {
            if (timeToEvent > interval && timeToEvent < interval + this.CHECK_INTERVAL) {
                this.emit('eventReminder', {
                    event,
                    timeToEvent: interval
                });
            }
        });
    }
    getUpcomingEvents(filter) {
        let events = Array.from(this.events.values())
            .filter(event => event.status === EventStatus.SCHEDULED &&
            event.startTime > Date.now());
        if (filter?.type) {
            events = events.filter(event => event.type === filter.type);
        }
        if (filter?.startTime) {
            events = events.filter(event => event.startTime >= filter.startTime);
        }
        if (filter?.endTime) {
            events = events.filter(event => event.endTime <= filter.endTime);
        }
        events.sort((a, b) => a.startTime - b.startTime);
        if (filter?.limit) {
            events = events.slice(0, filter.limit);
        }
        return events;
    }
    getEventById(eventId) {
        return this.events.get(eventId) || null;
    }
    getUserEvents(userId) {
        return Array.from(this.events.values())
            .filter(event => event.participants.includes(userId))
            .sort((a, b) => a.startTime - b.startTime);
    }
}
