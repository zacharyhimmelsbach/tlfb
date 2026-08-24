import {
  KeyEvent,
  NoUseEvent,
  UseEvent,
  check_timeline_coverage,
} from '../src/state';
import type { UseEventProperties } from '../src/types';

function useEvent(date: string): UseEvent {
  const properties: UseEventProperties = {
    category: 'etoh',
    substance: 'Alcohol',
    methodType: '',
    methodTypeOther: '',
    method: 'Alcohol',
    methodOther: '',
    times: 1,
    amount: 1,
    units: 'standard drinks',
    unitsOther: '',
    note: '',
  };

  return new UseEvent(date, properties);
}

describe('check_timeline_coverage', () => {
  test('returns every day in an empty inclusive range', () => {
    expect(check_timeline_coverage([], '2024-01-01', '2024-01-03')).toEqual({
      status: 'incomplete',
      missingDates: ['2024-01-01', '2024-01-02', '2024-01-03'],
    });
  });

  test('counts use and no-use events but not key events as indications', () => {
    const events = [
      useEvent('2024-01-01'),
      new KeyEvent('2024-01-02', 'Birthday'),
      new NoUseEvent('2024-01-03'),
    ];

    expect(check_timeline_coverage(events, '2024-01-01', '2024-01-03')).toEqual({
      status: 'incomplete',
      missingDates: ['2024-01-02'],
    });
  });

  test('handles leap days and duplicate indications', () => {
    const events = [
      useEvent('2024-02-28'),
      new NoUseEvent('2024-02-29'),
      useEvent('2024-03-01'),
      useEvent('2024-03-01'),
      new KeyEvent('2024-03-01', 'Trip'),
    ];

    expect(check_timeline_coverage(events, '2024-02-28', '2024-03-01')).toEqual({
      status: 'complete',
      missingDates: [],
    });
  });

  test('ignores indications outside the current range across a year boundary', () => {
    const events = [
      new NoUseEvent('2024-12-30'),
      useEvent('2024-12-31'),
      useEvent('2025-01-02'),
    ];

    expect(check_timeline_coverage(events, '2024-12-31', '2025-01-01')).toEqual({
      status: 'incomplete',
      missingDates: ['2025-01-01'],
    });
  });

  test.each([
    ['no event', []],
    ['only a key event', [new KeyEvent('2024-04-10', 'Interview')]],
  ])('reports a one-day range as incomplete with %s', (_description, events) => {
    expect(check_timeline_coverage(events, '2024-04-10', '2024-04-10')).toEqual({
      status: 'incomplete',
      missingDates: ['2024-04-10'],
    });
  });

  test.each([
    ['a use event', useEvent('2024-04-10')],
    ['a no-use event', new NoUseEvent('2024-04-10')],
  ])('reports a one-day range as complete with %s', (_description, event) => {
    expect(check_timeline_coverage([event], '2024-04-10', '2024-04-10')).toEqual({
      status: 'complete',
      missingDates: [],
    });
  });

  test.each([
    ['invalid start', 'not-a-date', '2024-01-01'],
    ['invalid end', '2024-01-01', '2024-02-30'],
    ['reversed range', '2024-01-02', '2024-01-01'],
  ])('reports an invalid range for %s', (_description, start, end) => {
    expect(check_timeline_coverage([], start, end)).toEqual({
      status: 'invalid-range',
      missingDates: [],
    });
  });
});
