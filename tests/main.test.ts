import type { TLFBProperties } from '../src/types';

jest.mock('@fullcalendar/core', () => ({ Calendar: jest.fn() }));
jest.mock('@fullcalendar/daygrid', () => ({ __esModule: true, default: {} }));
jest.mock('@fullcalendar/interaction', () => ({ __esModule: true, default: {} }));
jest.mock('../src/editor', () => ({ Editor: jest.fn() }));
jest.mock('../src/file', () => ({ File: jest.fn() }));

type UpdateProperties = typeof import('../src/main')['update_properties'];

let update_properties: UpdateProperties;

beforeAll(() => {
  const nativeAddEventListener = document.addEventListener.bind(document);
  const listenerSpy = jest
    .spyOn(document, 'addEventListener')
    .mockImplementation(((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
      if (type !== 'DOMContentLoaded') {
        nativeAddEventListener(type, listener, options);
      }
    }) as typeof document.addEventListener);

  jest.isolateModules(() => {
    ({ update_properties } = require('../src/main') as typeof import('../src/main'));
  });

  listenerSpy.mockRestore();
});

function renderPropertyHeadings() {
  document.body.innerHTML = `
    <span id="calendar-file-title"></span>
    <span id="calendar-file-subtitle"></span>
  `;
}

function initialProperties(): TLFBProperties {
  return {
    subject: 'OLD_SUBJECT',
    record: '10',
    timepoint: 'screening_arm_1',
    pid: '100',
    start: '2024-01-01',
    end: '2024-01-07',
    keyfield: 'old_key',
    staff: 'old_staff',
    days: 7,
  };
}

describe('update_properties', () => {
  beforeEach(() => {
    renderPropertyHeadings();
    history.replaceState({}, '', '/timeline?source=redcap');
  });

  test('applies a full update, computes inclusive days, and updates the headings and URL', () => {
    const properties = initialProperties();
    const updated = {
      subject: 'QO10A',
      record: '66',
      timepoint: 'pilot_v6_20wk_arm_2',
      pid: '28955',
      start: '2022-07-15',
      end: '2022-08-09',
      keyfield: 'record_id',
      staff: 'AB12',
    };

    update_properties(properties, updated);

    expect(properties).toEqual({ ...updated, days: 26 });
    expect(document.getElementById('calendar-file-title')!.innerText).toBe(
      '28955 | QO10A / 66 at Pilot V6 20wk ',
    );
    expect(document.getElementById('calendar-file-subtitle')!.innerText).toBe(
      '2022-07-15 to 2022-08-09 (26 Days)',
    );

    const query = new URLSearchParams(window.location.search);
    expect(Object.fromEntries(query.entries())).toEqual({
      source: 'redcap',
      record: '66',
      pid: '28955',
      event: 'pilot_v6_20wk_arm_2',
      subject: 'QO10A',
      start: '2022-07-15',
      end: '2022-08-09',
      keyfield: 'record_id',
      staff: 'AB12',
    });
  });

  test('keeps merged property values in the URL when only some fields are updated', () => {
    const properties = initialProperties();

    update_properties(properties, {
      end: '2024-01-10',
      staff: 'new_staff',
    });

    expect(properties).toEqual({
      subject: 'OLD_SUBJECT',
      record: '10',
      timepoint: 'screening_arm_1',
      pid: '100',
      start: '2024-01-01',
      end: '2024-01-10',
      keyfield: 'old_key',
      staff: 'new_staff',
      days: 10,
    });

    const query = new URLSearchParams(window.location.search);
    expect(query.get('record')).toBe('10');
    expect(query.get('pid')).toBe('100');
    expect(query.get('event')).toBe('screening_arm_1');
    expect(query.get('subject')).toBe('OLD_SUBJECT');
    expect(query.get('start')).toBe('2024-01-01');
    expect(query.get('end')).toBe('2024-01-10');
    expect(query.get('keyfield')).toBe('old_key');
    expect(query.get('staff')).toBe('new_staff');
    expect(Array.from(query.values())).not.toContain('undefined');
  });
});
