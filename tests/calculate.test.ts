import {
  calc_days_since_last_use,
  calc_days_used,
  calc_days_used_amount,
  calc_total_occasions,
  calc_total_units,
} from '../src/calculate';
import type { CalendarEvent } from '../src/state';
import { KeyEvent, NoUseEvent, UseEvent } from '../src/state';
import type { UseEventProperties } from '../src/types';

const useEvent = (
  date: string,
  overrides: Partial<UseEventProperties> = {},
): UseEvent => new UseEvent(date, {
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
  ...overrides,
});

describe('substance-use calculations', () => {
  const events: CalendarEvent[] = [
    useEvent('2024-01-03', { amount: 'unknown', times: 2 }),
    useEvent('2024-01-01', { amount: 2, times: 1 }),
    useEvent('2024-01-01', { amount: 'unknown', times: 3 }),
    useEvent('2024-01-02', { amount: 'unknown', times: 4 }),
    useEvent('2024-01-03', { amount: 1.5, times: 2 }),
    useEvent('2024-01-04', {
      category: 'cb',
      substance: 'Cannabis',
      method: 'Smoked Cannabis',
      times: 5,
      amount: 4,
      units: 'grams',
    }),
  ];

  test('counts unique use days by category, including unknown amounts', () => {
    expect(calc_days_used(events, 'etoh')).toBe(3);
    expect(calc_days_used(events, 'cb')).toBe(1);
    expect(calc_days_used(events, 'nic')).toBe(0);
  });

  test('counts only days having at least one known amount', () => {
    expect(calc_days_used_amount(events, 'etoh')).toBe(2);
    expect(calc_days_used_amount(events, 'cb')).toBe(1);
    expect(calc_days_used_amount(events, 'nic')).toBe(0);
  });

  test('sums occasions for every matching event', () => {
    expect(calc_total_occasions(events, 'etoh')).toBe(12);
    expect(calc_total_occasions(events, 'cb')).toBe(5);
    expect(calc_total_occasions(events, 'nic')).toBe(0);
  });

  test('sums only known amounts with the requested substance and units', () => {
    expect(calc_total_units(events, 'Alcohol', 'standard drinks')).toBe(3.5);
    expect(calc_total_units(events, 'Cannabis', 'grams')).toBe(4);
    expect(calc_total_units(events, 'Alcohol', 'grams')).toBe(0);
    expect(calc_total_units(events, 'Missing', 'standard drinks')).toBe(0);
  });

  test('calculates from the latest matching date regardless of input order', () => {
    expect(calc_days_since_last_use(events, 'etoh', '2024-01-10')).toBe(7);
    expect(calc_days_since_last_use(events, 'cb', '2024-01-04')).toBe(0);
  });

  test('handles leap-day boundaries and reports NaN when no use exists', () => {
    const leapEvents = [useEvent('2024-02-29')];

    expect(calc_days_since_last_use(leapEvents, 'etoh', '2024-03-01')).toBe(1);
    expect(calc_days_since_last_use(leapEvents, 'nic', '2024-03-01')).toBeNaN();
  });

  test('ignores key and no-use events accepted by the public input type', () => {
    const mixedEvents: CalendarEvent[] = [
      new KeyEvent('2024-01-01', 'Holiday'),
      new NoUseEvent('2024-01-02'),
      useEvent('2024-01-03', { amount: 2, times: 3 }),
    ];

    expect(calc_days_used(mixedEvents, 'etoh')).toBe(1);
    expect(calc_days_used_amount(mixedEvents, 'etoh')).toBe(1);
    expect(calc_total_occasions(mixedEvents, 'etoh')).toBe(3);
    expect(calc_total_units(mixedEvents, 'Alcohol', 'standard drinks')).toBe(2);
    expect(calc_days_since_last_use(mixedEvents, 'etoh', '2024-01-05')).toBe(2);
  });
});
