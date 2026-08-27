import type { Calendar } from '@fullcalendar/core';

export type FakeCalendarEvent = {
  id: string;
  groupId: string;
  start: string;
  title: string;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  remove: jest.Mock<void, []>;
  setProp: jest.Mock<void, [string, unknown]>;
};

export class FakeCalendar {
  public readonly added: FakeCalendarEvent[] = [];
  public readonly handlers: Record<string, (event: any) => void> = {};
  public readonly options: Array<[string, unknown]> = [];
  public readonly render = jest.fn();

  public on(name: string, handler: (event: any) => void) {
    this.handlers[name] = handler;
  }

  public setOption(name: string, value: unknown) {
    this.options.push([name, value]);
  }

  public addEvent(input: Omit<FakeCalendarEvent, 'remove' | 'setProp'>) {
    const event = {
      ...input,
      remove: jest.fn(() => {
        const index = this.added.indexOf(event);
        if (index >= 0) this.added.splice(index, 1);
      }),
      setProp: jest.fn((name: string, value: unknown) => {
        (event as unknown as Record<string, unknown>)[name] = value;
      }),
    } as FakeCalendarEvent;

    this.added.push(event);
    return event;
  }

  public getEventById(id: string) {
    return this.added.find((event) => event.id === id) ?? null;
  }

  public getEvents() {
    return [...this.added];
  }

  public asCalendar() {
    return this as unknown as Calendar;
  }
}
