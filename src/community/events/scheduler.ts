// src/community/events/scheduler.ts

import { EventEmitter } from 'events';
import { AIService } from '../../services/ai/ai';

export interface ScheduledEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  startTime: number;
  endTime: number;
  timeZone: string;
  recurringPattern?: RecurringPattern;
  platform: string;
  participants: string[];
  metadata: {
    maxParticipants?: number;
    requirements?: string[];
    rewards?: any[];
    isRecurring?: boolean;
    originalEventId?: string;
    occurrenceNumber?: number;
    tags: string[];
  };
  status: EventStatus;
}

interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  dayOfWeek?: number[];
  endDate?: number;
  maxOccurrences?: number;
}

export enum EventType {
  AMA = 'ama',
  TRADING_COMPETITION = 'trading_competition',
  COMMUNITY_CALL = 'community_call',
  TWITTER_SPACE = 'twitter_space',
  GIVEAWAY = 'giveaway',
  EDUCATIONAL = 'educational'
}

enum EventStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export class EventScheduler extends EventEmitter {
  private events: Map<string, ScheduledEvent>;
  private aiService: AIService;
  private readonly CHECK_INTERVAL = 60000; // 1 minute
  private readonly REMINDER_INTERVALS = [
    24 * 60 * 60 * 1000, // 24 hours
    60 * 60 * 1000,      // 1 hour
    15 * 60 * 1000       // 15 minutes
  ];

  constructor(aiService: AIService) {
    super();
    this.events = new Map();
    this.aiService = aiService;
    this.startEventMonitoring();
  }

  public async scheduleEvent(
    eventData: Omit<ScheduledEvent, 'id' | 'status'>
  ): Promise<string> {
    try {
      // Validate event data
      this.validateEventData(eventData);

      const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const event: ScheduledEvent = {
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
    } catch (error) {
      console.error('Error scheduling event:', error);
      throw error;
    }
  }

  private validateEventData(eventData: any): void {
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

  private hasTimeConflict(newEvent: ScheduledEvent): boolean {
    for (const existingEvent of this.events.values()) {
      if (existingEvent.status === EventStatus.CANCELLED) continue;

      const overlap = (
        newEvent.startTime < existingEvent.endTime &&
        newEvent.endTime > existingEvent.startTime
      );

      if (overlap) return true;
    }

    return false;
  }

  private async scheduleRecurringEvents(event: ScheduledEvent): Promise<void> {
    if (!event.recurringPattern) return;

    const { frequency, interval, endDate, maxOccurrences } = event.recurringPattern;
    let occurrences = 0;
    let currentDate = event.startTime;

    while (
      (!endDate || currentDate < endDate) &&
      (!maxOccurrences || occurrences < maxOccurrences)
    ) {
      // Calculate next occurrence
      currentDate = this.calculateNextOccurrence(currentDate, frequency, interval);
      if (!currentDate) break;

      // Create recurring instance
      const recurringEvent: ScheduledEvent = {
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

  private calculateNextOccurrence(
    currentDate: number,
    frequency: string,
    interval: number
  ): number {
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

  public async updateEvent(
    eventId: string,
    updates: Partial<ScheduledEvent>
  ): Promise<void> {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Don't allow updating past events
    if (event.startTime < Date.now()) {
      throw new Error('Cannot update past events');
    }

    const updatedEvent: ScheduledEvent = {
      ...event,
      ...updates
    };

    // Validate updates
    this.validateEventData(updatedEvent);

    // Check for time conflicts if time was updated
    if (updates.startTime || updates.endTime) {
      const otherEvents = Array.from(this.events.values())
        .filter(e => e.id !== eventId);

      const hasConflict = otherEvents.some(e => 
        updatedEvent.startTime < e.endTime &&
        updatedEvent.endTime > e.startTime
      );

      if (hasConflict) {
        throw new Error('Time conflict with existing event');
      }
    }

    this.events.set(eventId, updatedEvent);
    this.emit('eventUpdated', updatedEvent);
  }

  public cancelEvent(eventId: string, reason?: string): void {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    event.status = EventStatus.CANCELLED;
    this.events.set(eventId, event);

    this.emit('eventCancelled', { event, reason });
  }

  private startEventMonitoring(): void {
    setInterval(() => {
      this.checkUpcomingEvents();
    }, this.CHECK_INTERVAL);
  }

  private async checkUpcomingEvents(): Promise<void> {
    const now = Date.now();

    for (const event of this.events.values()) {
      if (event.status !== EventStatus.SCHEDULED) continue;

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

  private async startEvent(event: ScheduledEvent): Promise<void> {
    event.status = EventStatus.LIVE;
    this.events.set(event.id, event);
    this.emit('eventStarted', event);
  }

  private async completeEvent(event: ScheduledEvent): Promise<void> {
    event.status = EventStatus.COMPLETED;
    this.events.set(event.id, event);
    this.emit('eventCompleted', event);
  }

  private checkReminders(event: ScheduledEvent): void {
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

  public getUpcomingEvents(
    filter?: {
      type?: EventType;
      startTime?: number;
      endTime?: number;
      limit?: number;
    }
  ): ScheduledEvent[] {
    let events = Array.from(this.events.values())
      .filter(event => 
        event.status === EventStatus.SCHEDULED &&
        event.startTime > Date.now()
      );

    if (filter?.type) {
      events = events.filter(event => event.type === filter.type);
    }

    if (filter?.startTime) {
      events = events.filter(event => event.startTime >= filter.startTime!);
    }

    if (filter?.endTime) {
      events = events.filter(event => event.endTime <= filter.endTime!);
    }

    events.sort((a, b) => a.startTime - b.startTime);

    if (filter?.limit) {
      events = events.slice(0, filter.limit);
    }

    return events;
  }

  public getEventById(eventId: string): ScheduledEvent | null {
    return this.events.get(eventId) || null;
  }

  public getUserEvents(userId: string): ScheduledEvent[] {
    return Array.from(this.events.values())
      .filter(event => event.participants.includes(userId))
      .sort((a, b) => a.startTime - b.startTime);
  }
}