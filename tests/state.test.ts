import {
  COLOR_ORANGE,
  COLOR_PURPLE,
  COLOR_TEXT,
  COLOR_WHITE,
  COLOR_YELLOW,
} from '../src/constants';
import {
  CalendarDate,
  CalendarEventList,
  KeyEvent,
  NoUseEvent,
  UseEvent,
} from '../src/state';
import type { UseEventProperties } from '../src/types';
import { FakeCalendar } from './helpers/fake-calendar';

const useProperties = (
  overrides: Partial<UseEventProperties> = {},
): UseEventProperties => ({
  category: 'etoh',
  substance: 'Alcohol',
  methodType: '',
  methodTypeOther: '',
  method: 'Alcohol',
  methodOther: '',
  times: 2,
  amount: 3,
  units: 'standard drinks',
  unitsOther: '',
  note: 'With dinner',
  ...overrides,
});

const useEvent = (
  date = '2024-01-01',
  overrides: Partial<UseEventProperties> = {},
) => new UseEvent(date, useProperties(overrides));

describe('CalendarDate', () => {
  test('parses calendar dates in UTC and exposes their components', () => {
    const date = new CalendarDate('2024-02-29');

    expect(date.Date.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(date.toString()).toBe('2024-02-29');
    expect(date.year).toBe(2024);
    expect(date.month).toBe(2);
    expect(date.day).toBe(29);
    expect(date.weekday).toBe(5); // Thursday when Sunday is 1.
  });

  test.each([
    '2024-2-29',
    '2024-02-29T00:00:00Z',
    'not-a-date',
    '2023-02-29',
    '2024-04-31',
    '2024-13-01',
  ])('rejects malformed or impossible date %s', (date) => {
    expect(() => new CalendarDate(date)).toThrow();
  });

  test('compares dates across month and year boundaries', () => {
    const endOfYear = new CalendarDate('2023-12-31');
    const newYear = new CalendarDate('2024-01-01');
    const sameNewYear = new CalendarDate('2024-01-01');

    expect(endOfYear.isBefore(newYear)).toBe(true);
    expect(newYear.isAfter(endOfYear)).toBe(true);
    expect(newYear.isSameDay(sameNewYear)).toBe(true);
    expect(newYear.isBefore(sameNewYear)).toBe(false);
    expect(newYear.isAfter(sameNewYear)).toBe(false);
  });

  test('moves across leap-day and year boundaries without mutating the source', () => {
    const leapDay = new CalendarDate('2024-02-29');
    const newYear = new CalendarDate('2024-01-01');

    expect(leapDay.next_day.toString()).toBe('2024-03-01');
    expect(leapDay.toString()).toBe('2024-02-29');
    expect(newYear.previous_day.toString()).toBe('2023-12-31');
    expect(newYear.toString()).toBe('2024-01-01');
  });
});

describe('calendar event variants', () => {
  test('key and no-use events expose their titles, types, and colors', () => {
    const key = new KeyEvent('2024-01-01', 'Birthday');
    const noUse = new NoUseEvent('2024-01-02');

    expect([key.type, key.title, key.colors]).toEqual([
      'key',
      'Birthday',
      [COLOR_ORANGE, COLOR_TEXT],
    ]);
    expect([noUse.type, noUse.title, noUse.colors]).toEqual([
      'no-use',
      'No substances used',
      [COLOR_YELLOW, COLOR_TEXT],
    ]);
  });

  test('use events round-trip their properties and build a display title', () => {
    const properties = useProperties({ amount: 'unknown' });
    const event = new UseEvent('2024-01-01', properties);

    expect(event.type).toBe('use');
    expect(event.properties).toEqual(properties);
    expect(event.title).toBe('Alcohol 2x | unknown standard drinks');
    expect(event.colors).toEqual([COLOR_PURPLE, COLOR_WHITE]);
  });

  test('updating a use event recomputes its title and prefers custom units', () => {
    const event = useEvent();
    const updated = useProperties({
      method: 'Other Cannabis',
      times: 4,
      amount: 1.5,
      units: 'other_unit',
      unitsOther: 'cookies',
    });

    event.set_properties(updated);

    expect(event.properties).toEqual(updated);
    expect(event.title).toBe('Other Cannabis 4x | 1.5 cookies');
  });

  test('creates an inclusive recurrence on selected weekdays', () => {
    const source = new KeyEvent('2024-01-01', 'Check-in')
      .set_eid(23)
      .set_gid(9);

    const recurrence = source.make_recurrence([2, 4], '2024-01-07');

    expect(recurrence.map((event) => event.date)).toEqual([
      '2024-01-01',
      '2024-01-03',
    ]);
    expect(recurrence.map((event) => [event.eid, event.gid])).toEqual([
      [23, 9],
      [23, 9],
    ]);
    expect(recurrence.every((event) => event !== source)).toBe(true);
    expect(source.date).toBe('2024-01-01');
    expect(source.make_recurrence([1, 2, 3, 4, 5, 6, 7], '2023-12-31')).toEqual([]);
  });
});

describe('CalendarEventList', () => {
  let calendar: FakeCalendar;
  let list: CalendarEventList;

  beforeEach(() => {
    calendar = new FakeCalendar();
    list = new CalendarEventList(
      '2024-01-01',
      '2024-01-31',
      calendar.asCalendar(),
    );
  });

  test('adds an event with assigned IDs and synchronizes calendar and storage', () => {
    const event = useEvent();

    expect(list.add(event)).toBe(list);

    expect([event.eid, event.gid]).toEqual([1, 1]);
    expect(calendar.added).toHaveLength(1);
    expect(calendar.added[0]).toMatchObject({
      id: '1',
      groupId: '1',
      start: '2024-01-01',
      title: 'Alcohol 2x | 3 standard drinks',
      textColor: COLOR_WHITE,
      backgroundColor: COLOR_PURPLE,
      borderColor: COLOR_PURPLE,
    });
    expect(JSON.parse(sessionStorage.getItem('eventsList') ?? '[]')).toHaveLength(1);
  });

  test('preserves source group relationships while assigning fresh event IDs', () => {
    const first = new KeyEvent('2024-01-01', 'First').set_gid(41);
    const second = new KeyEvent('2024-01-02', 'Second').set_gid(41);
    const third = new KeyEvent('2024-01-03', 'Third').set_gid(99);

    list.import_events([first, second, third]);

    expect(list.get_events().map((event) => event.eid)).toEqual([1, 2, 3]);
    expect(list.get_events().map((event) => event.gid)).toEqual([1, 1, 2]);
    expect(list.get_event(2)).toBe(second);
    expect(list.get_event_group(1)).toEqual([first, second]);
    expect(list.get_event_siblings(1)).toEqual([second]);
  });

  test('throws when an event or group cannot be found', () => {
    expect(() => list.get_event(99)).toThrow('Could not find event 99');
    expect(() => list.get_event_group(99)).toThrow('Could not find events in group 99');
  });

  test('prevents use and no-use events from occupying the same date', () => {
    list.add(useEvent('2024-01-05'));
    list.add(new NoUseEvent('2024-01-05'));
    list.add(new NoUseEvent('2024-01-06'));
    list.add(useEvent('2024-01-06'));

    expect(list.get_events().map((event) => [event.date, event.type])).toEqual([
      ['2024-01-05', 'use'],
      ['2024-01-06', 'no-use'],
    ]);
    expect(calendar.added).toHaveLength(2);
  });

  test('prefers use over no-use when both arrive in one batch', () => {
    const noUse = new NoUseEvent('2024-01-07');
    const use = useEvent('2024-01-07');

    list.import_events([noUse, use]);

    expect(list.get_events()).toEqual([use]);
    expect(calendar.added.map((event) => event.title)).toEqual([
      'Alcohol 2x | 3 standard drinks',
    ]);
  });

  test('allows key events to coexist with use-status events', () => {
    list.add(new KeyEvent('2024-01-08', 'Holiday'));
    list.add(new NoUseEvent('2024-01-08'));

    expect(list.get_events().map((event) => event.type)).toEqual(['key', 'no-use']);
  });

  test('deletes a single event from the model, calendar, and storage', () => {
    const first = useEvent('2024-01-01');
    const second = useEvent('2024-01-02');
    list.add(first).add(second);
    const calendarEvent = calendar.getEventById(String(first.eid));

    list.delete_event(first.eid);

    expect(list.get_events()).toEqual([second]);
    expect(calendarEvent?.remove).toHaveBeenCalledTimes(1);
    expect(calendar.getEventById(String(first.eid))).toBeNull();
    const stored = JSON.parse(sessionStorage.getItem('eventsList') ?? '[]');
    expect(stored.map((event: { _eid: number }) => event._eid)).toEqual([second.eid]);
  });

  test('deletes every event in a group and leaves other groups intact', () => {
    const recurrence = new KeyEvent('2024-01-01', 'Diary')
      .set_gid(12)
      .make_recurrence([2, 3, 4], '2024-01-03');
    const unrelated = new KeyEvent('2024-01-04', 'Unrelated');
    list.import_events(recurrence);
    list.add(unrelated);
    const groupId = recurrence[0].gid;
    const removedCalendarEvents = calendar.added.filter(
      (event) => event.groupId === String(groupId),
    );

    list.delete_group(groupId);

    expect(list.get_events()).toEqual([unrelated]);
    expect(removedCalendarEvents.every((event) => event.remove.mock.calls.length === 1)).toBe(true);
    expect(calendar.added).toHaveLength(1);
  });

  test('deletes use events by method without deleting other event types', () => {
    const alcoholOne = useEvent('2024-01-01');
    const alcoholTwo = useEvent('2024-01-02');
    const cannabis = useEvent('2024-01-03', {
      category: 'cb',
      substance: 'Cannabis',
      method: 'Smoked Cannabis',
      units: 'grams',
    });
    const key = new KeyEvent('2024-01-04', 'Alcohol');
    list.add(alcoholOne).add(alcoholTwo).add(cannabis).add(key);

    list.delete_substance('Alcohol');

    expect(list.get_events()).toEqual([cannabis, key]);
    expect(calendar.getEventById(String(alcoholOne.eid))).toBeNull();
    expect(calendar.getEventById(String(alcoholTwo.eid))).toBeNull();
  });

  test('serializes CSV fields in a stable order', () => {
    const key = new KeyEvent('2024-01-01', 'New year');
    const use = useEvent('2024-01-02');
    list.add(key).add(use);

    expect(list.serialize_events('csv')).toEqual([
      [
        'Event', 'Date', 'Type', 'eID', 'gID', 'Title', 'Category',
        'Substance', 'MethodType', 'MethodTypeOther', 'Method', 'MethodOther',
        'Times', 'Amount', 'Units', 'UnitsOther', 'Note',
      ],
      [1, '2024-01-01', 'key', 1, 1, 'New year'],
      [
        2, '2024-01-02', 'use', 2, 2,
        'Alcohol 2x | 3 standard drinks',
        'etoh', 'Alcohol', '', '', 'Alcohol', '', 2, 3,
        'standard drinks', '', 'With dinner',
      ],
    ]);
  });

  test('serializes JSON with flattened ISO dates without changing live events', () => {
    const use = useEvent('2024-01-02');
    list.add(use);

    expect(list.serialize_events('json')).toEqual([
      expect.objectContaining({
        _eid: 1,
        _gid: 1,
        _type: 'use',
        _date: '2024-01-02T00:00:00.000Z',
        _category: 'etoh',
        _amount: 3,
      }),
    ]);
    expect(use.date).toBe('2024-01-02');
    expect(use.date_object).toBeInstanceOf(CalendarDate);
  });
});
