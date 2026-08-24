jest.mock('../src/main', () => ({
  update_properties: jest.fn(),
}));

import type { Editor } from '../src/editor';
import { File } from '../src/file';
import {
  CalendarDate,
  CalendarEventList,
  KeyEvent,
  NoUseEvent,
  UseEvent,
} from '../src/state';
import type { SerializedEvent, TLFBProperties } from '../src/types';
import { FakeCalendar } from './helpers/fake-calendar';

const MODAL_IDS = [
  'modal-select-substances',
  'modal-update-properties',
  'modal-get-summary',
  'modal-import-json',
  'modal-import-csv',
  'modal-confirm-export',
];

const CSV_TITLE_ROW = [
  'Subject', 'Event', 'pID', 'Start', 'End', 'Staff', 'Record', 'Keyfield',
  'Datetime', 'AppVersion', '', '', '', '', '', '', '',
];

const CSV_EVENT_TITLE_ROW = [
  'Event', 'Date', 'Type', 'eID', 'gID', 'Title', 'Category', 'Substance',
  'MethodType', 'MethodTypeOther', 'Method', 'MethodOther', 'Times', 'Amount',
  'Units', 'UnitsOther', 'Note',
];

const CSV_FILLER_ROW = Array<string>(17).fill('');

function properties(): TLFBProperties {
  return {
    subject: 'CAM001',
    record: '42',
    pid: '9001',
    timepoint: 'week_12_arm_1',
    start: '2024-01-01',
    end: '2024-01-31',
    keyfield: 'record_id',
    staff: 'tester',
    days: 31,
  };
}

function mountFileDom() {
  document.body.innerHTML = [
    ...MODAL_IDS.map((id) => `<div id="${id}" class="modal"></div>`),
    `<div id="modal-incomplete-export" class="modal">
      <p id="incomplete-export-description"></p>
      <p id="incomplete-export-guidance"></p>
      <details id="incomplete-export-date-details">
        <summary id="missing-date-summary"></summary>
        <ul id="missing-date-list"></ul>
      </details>
      <button id="incomplete-export-return" class="cancel-operation" type="button"></button>
    </div>`,
  ].join('');
}

type EventListStub = {
  get_events?: jest.Mock;
  import_events?: jest.Mock;
  serialize_events?: jest.Mock;
};

function completeRangeEvents(start: string, end: string) {
  const events: NoUseEvent[] = [];
  const endDate = new CalendarDate(end);

  for (let date = new CalendarDate(start); !date.isAfter(endDate); date = date.next_day) {
    events.push(new NoUseEvent(date.toString()));
  }

  return events;
}

function makeFile(eventList?: EventListStub, currentProperties = properties()) {
  mountFileDom();

  const calendar = new FakeCalendar();
  const list = eventList
    ? {
      get_events: jest.fn(() => completeRangeEvents(currentProperties.start, currentProperties.end)),
      ...eventList,
    }
    : new CalendarEventList(
      currentProperties.start,
      currentProperties.end,
      calendar.asCalendar(),
    );
  const editor = {
    get_event_list: jest.fn(() => list),
    update_substances_used: jest.fn(),
  } as unknown as Editor;

  return {
    calendar,
    editor,
    eventList: list,
    file: new File(currentProperties, calendar.asCalendar(), editor),
  };
}

function validJsonBase() {
  return {
    subject: 'CAM001',
    event: 'week_12_arm_1',
    pid: '9001',
    start: '2024-01-01',
    end: '2024-01-31',
    staff: 'tester',
    record: '42',
    keyfield: 'record_id',
    datetime: '2024-02-01T12:00:00.000Z',
    events: [] as any[],
  };
}

function currentUseEvent(overrides: Record<string, unknown> = {}) {
  return {
    _eid: 1,
    _gid: 1,
    _title: 'Beer 2x | 3 standard drinks',
    _type: 'use',
    _date: '2024-01-10',
    _category: 'etoh',
    _substance: 'Alcohol',
    _methodType: null,
    _methodTypeOther: null,
    _method: 'Beer',
    _methodOther: null,
    _times: 2,
    _amount: 3,
    _units: 'standard drinks',
    _unitsOther: null,
    _note: 'with dinner',
    ...overrides,
  };
}

function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function createdDownload() {
  const createObjectUrl = URL.createObjectURL as jest.MockedFunction<typeof URL.createObjectURL>;
  const click = HTMLAnchorElement.prototype.click as jest.MockedFunction<
    typeof HTMLAnchorElement.prototype.click
  >;

  return {
    anchor: click.mock.contexts[0] as unknown as HTMLAnchorElement,
    blob: createObjectUrl.mock.calls[0][0] as Blob,
    blobUrl: createObjectUrl.mock.results[0].value,
  };
}

afterEach(() => {
  jest.useRealTimers();
});

describe('File.valid_JSON', () => {
  test('accepts an empty current-format export and nullable metadata', () => {
    const { file } = makeFile();
    const json = validJsonBase();
    json.staff = null as unknown as string;

    expect(file.valid_JSON(json)).toBe(true);
  });

  test('accepts current-format key, no-use, and use events', () => {
    const { file } = makeFile();
    const json = validJsonBase();
    json.events = [
      {
        _eid: 1,
        _gid: 1,
        _title: 'Birthday',
        _type: 'key',
        _date: '2024-01-05',
      },
      {
        _eid: 2,
        _gid: 2,
        _title: 'No substances used',
        _type: 'no-use',
        _date: '2024-01-06',
      },
      currentUseEvent({ _eid: 3, _gid: 3, _amount: 'unknown' }),
    ];

    expect(file.valid_JSON(json)).toBe(true);
  });

  test('accepts a version 2 export', () => {
    const { file } = makeFile();
    const json = validJsonBase();
    json.events = [
      {
        title: 'Vacation',
        type: 'key-event',
        start: '2024-01-02',
        end: '2024-01-03',
      },
      {
        title: 'Alcohol',
        type: 'substance-event',
        start: '2024-01-08',
        category: 'etoh',
        substance: 'Beer',
        occasions: '2',
        amount: '1.5',
        units: 'standard drinks',
        notes: 'with dinner',
      },
    ];

    expect(file.valid_JSON(json)).toBe(true);
  });

  test.each([
    ['a missing top-level property', () => {
      const json = validJsonBase() as Record<string, unknown>;
      delete json.pid;
      return json;
    }],
    ['a non-string top-level property', () => ({ ...validJsonBase(), record: 42 })],
    ['a non-array events value', () => ({ ...validJsonBase(), events: null })],
    ['an invalid current event id', () => ({
      ...validJsonBase(),
      events: [currentUseEvent({ _eid: '1' })],
    })],
    ['an invalid current use amount', () => ({
      ...validJsonBase(),
      events: [currentUseEvent({ _amount: {} })],
    })],
    ['an invalid current use occasion count', () => ({
      ...validJsonBase(),
      events: [currentUseEvent({ _times: '2' })],
    })],
    ['an invalid version 2 end date', () => ({
      ...validJsonBase(),
      events: [{ title: 'Trip', type: 'key-event', start: '2024-01-01', end: 2 }],
    })],
    ['a version 2 substance event with a numeric amount', () => ({
      ...validJsonBase(),
      events: [{
        title: 'Alcohol',
        type: 'substance-event',
        start: '2024-01-08',
        category: 'etoh',
        substance: 'Beer',
        occasions: '2',
        amount: 1.5,
        units: 'standard drinks',
        notes: '',
      }],
    })],
  ])('rejects %s', (_description, buildJson) => {
    const { file } = makeFile();

    expect(file.valid_JSON(buildJson())).toBe(false);
  });
});

describe('File.valid_CSV', () => {
  test('accepts the three fixed header rows and event header', () => {
    const { file } = makeFile();
    const csv = [
      CSV_TITLE_ROW,
      ['CAM001', 'week_12_arm_1', '9001'],
      CSV_FILLER_ROW,
      CSV_EVENT_TITLE_ROW,
      [1, '2024-01-05', 'key', 1, 1, 'Birthday'],
    ];

    expect(file.valid_CSV(csv)).toBe(true);
  });

  test.each([
    ['file title', 0, 0, 'Participant'],
    ['filler row', 2, 4, 'unexpected'],
    ['event title', 3, 2, 'Event Type'],
  ])('rejects a changed %s row', (_description, row, column, value) => {
    const { file } = makeFile();
    const csv = [
      [...CSV_TITLE_ROW],
      ['CAM001'],
      [...CSV_FILLER_ROW],
      [...CSV_EVENT_TITLE_ROW],
    ];
    csv[row][column] = value;

    expect(file.valid_CSV(csv)).toBe(false);
  });

  test('rejects truncated input without throwing', () => {
    const { file } = makeFile();

    expect(file.valid_CSV([CSV_TITLE_ROW])).toBe(false);
  });
});

describe('File event deserialization', () => {
  test('deserializes JSON events, trims timestamps, and preserves imported groups', () => {
    const { calendar, eventList, file } = makeFile();
    const events: SerializedEvent[] = [
      {
        _eid: 20,
        _gid: 7,
        _title: 'Vacation starts',
        _type: 'key',
        _date: '2024-01-03T12:00:00.000Z',
      },
      {
        _eid: 21,
        _gid: 7,
        _title: 'Vacation continues',
        _type: 'key',
        _date: '2024-01-04',
      },
      {
        _eid: 22,
        _gid: 8,
        _title: 'No substances used',
        _type: 'no-use',
        _date: '2024-01-05',
      },
      {
        ...currentUseEvent({
          _eid: 23,
          _gid: 9,
          _date: '2024-01-06',
          _amount: 'unknown',
          _methodType: 'beer',
          _methodTypeOther: '',
          _methodOther: '',
          _unitsOther: '',
        }),
      },
    ];

    file.deserialize_events_json(events);

    const imported = (eventList as CalendarEventList).get_events();
    expect(imported).toHaveLength(4);
    expect(imported.map((event) => event.date)).toEqual([
      '2024-01-03',
      '2024-01-04',
      '2024-01-05',
      '2024-01-06',
    ]);
    expect(imported[0]).toBeInstanceOf(KeyEvent);
    expect(imported[1]).toBeInstanceOf(KeyEvent);
    expect(imported[0].gid).toBe(imported[1].gid);
    expect(imported[2]).toBeInstanceOf(NoUseEvent);
    expect(imported[2].gid).not.toBe(imported[0].gid);
    expect(imported[3]).toBeInstanceOf(UseEvent);
    expect((imported[3] as UseEvent).properties).toEqual({
      category: 'etoh',
      substance: 'Alcohol',
      methodType: 'beer',
      methodTypeOther: '',
      method: 'Beer',
      methodOther: '',
      times: 2,
      amount: 'unknown',
      units: 'standard drinks',
      unitsOther: '',
      note: 'with dinner',
    });
    expect(calendar.added).toHaveLength(4);
    expect(JSON.parse(sessionStorage.getItem('eventsList')!)).toHaveLength(4);
  });

  test('deserializes CSV fields and converts numeric use values', () => {
    const { eventList, file } = makeFile();
    const rows: (string | number)[][] = [
      [1, '2024-01-07T08:00:00.000Z', 'key', 4, 12, 'Payday'],
      [
        2, '2024-01-08', 'use', 5, 13, 'ignored serialized title', 'nic',
        'Nicotine', 'smoked', '', 'Cigarettes', '', '3', '4.5', 'cigarettes',
        '', 'after lunch',
      ],
      [3, '2024-01-09', 'no-use', 6, 14, 'No substances used'],
    ];

    file.deserialize_events_csv(rows);

    const imported = (eventList as CalendarEventList).get_events();
    expect(imported).toHaveLength(3);
    expect(imported[0]).toBeInstanceOf(KeyEvent);
    expect(imported[0].date).toBe('2024-01-07');
    expect(imported[1]).toBeInstanceOf(UseEvent);
    expect((imported[1] as UseEvent).properties).toEqual({
      category: 'nic',
      substance: 'Nicotine',
      methodType: 'smoked',
      methodTypeOther: '',
      method: 'Cigarettes',
      methodOther: '',
      times: 3,
      amount: 4.5,
      units: 'cigarettes',
      unitsOther: '',
      note: 'after lunch',
    });
    expect(imported[2]).toBeInstanceOf(NoUseEvent);
  });
});

describe('File exports', () => {
  test.each(['json', 'csv'] as const)(
    'blocks %s export and lists dates without a use indication',
    (format) => {
      const currentProperties = {
        ...properties(),
        start: '2024-01-01',
        end: '2024-01-03',
        days: 3,
      };
      const serializeEvents = jest.fn(() => []);
      const events = [
        new NoUseEvent('2024-01-01'),
        new KeyEvent('2024-01-02', 'Birthday'),
        new NoUseEvent('2024-01-03'),
      ];
      const { file } = makeFile({
        get_events: jest.fn(() => events),
        serialize_events: serializeEvents,
      }, currentProperties);

      if (format === 'json') file.export_json();
      else file.export_csv();

      expect(serializeEvents).not.toHaveBeenCalled();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
      expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      expect(document.getElementById('modal-incomplete-export')!.classList).toContain('is-active');
      expect(document.getElementById('incomplete-export-description')!.innerText).toBe(
        '1 day is missing an indication.',
      );
      expect(document.getElementById('missing-date-summary')!.innerText).toBe(
        'Show missing dates (1)',
      );
      expect(Array.from(document.querySelectorAll('#missing-date-list time')).map(
        (element) => [element.getAttribute('datetime'), (element as HTMLElement).innerText],
      )).toEqual([['2024-01-02', '2024-01-02']]);
      expect(document.activeElement).toBe(document.getElementById('incomplete-export-return'));
    },
  );

  test('checks current events again when an incomplete export is retried', () => {
    const currentProperties = {
      ...properties(),
      start: '2024-01-01',
      end: '2024-01-02',
      days: 2,
    };
    const events = [new NoUseEvent('2024-01-01')];
    const serializeEvents = jest.fn(() => []);
    const { file } = makeFile({
      get_events: jest.fn(() => events),
      serialize_events: serializeEvents,
    }, currentProperties);

    file.export_json();
    expect(URL.createObjectURL).not.toHaveBeenCalled();

    document.getElementById('incomplete-export-return')!.click();
    events.push(new NoUseEvent('2024-01-02'));
    file.export_json();

    expect(serializeEvents).toHaveBeenCalledWith('json');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  test('checks the live property range instead of the event list constructor range', () => {
    const currentProperties = {
      ...properties(),
      start: '2024-01-01',
      end: '2024-01-01',
      days: 1,
    };
    const events = [new NoUseEvent('2024-01-01')];
    const serializeEvents = jest.fn(() => []);
    const { file } = makeFile({
      get_events: jest.fn(() => events),
      serialize_events: serializeEvents,
    }, currentProperties);

    file.export_json();
    expect(serializeEvents).toHaveBeenCalledTimes(1);

    currentProperties.end = '2024-01-02';
    currentProperties.days = 2;
    file.export_json();

    expect(serializeEvents).toHaveBeenCalledTimes(1);
    expect(document.getElementById('incomplete-export-description')!.innerText).toBe(
      '1 day is missing an indication.',
    );
    expect(document.querySelector('#missing-date-list time')!.getAttribute('datetime')).toBe('2024-01-02');
  });

  test('blocks export when the current property range is invalid', () => {
    const currentProperties = {
      ...properties(),
      start: '2024-01-03',
      end: '2024-01-01',
      days: -1,
    };
    const serializeEvents = jest.fn(() => []);
    const { file } = makeFile({
      get_events: jest.fn(() => []),
      serialize_events: serializeEvents,
    }, currentProperties);

    file.export_csv();

    expect(serializeEvents).not.toHaveBeenCalled();
    expect(document.getElementById('incomplete-export-description')!.innerText).toBe(
      'The timeline date range is missing or invalid.',
    );
    expect(document.getElementById('incomplete-export-date-details')!.classList).toContain('is-hidden');
  });

  test('exports the expected JSON payload and filename', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-02-01T12:34:56.000Z'));
    const serializeEvents = jest.fn(() => [
      {
        _eid: 1,
        _gid: 1,
        _title: 'Birthday',
        _type: 'key',
        _date: '2024-01-03',
      },
    ]);
    const { file } = makeFile({ serialize_events: serializeEvents });

    file.export_json();

    const { anchor, blob, blobUrl } = createdDownload();
    const payload = JSON.parse(await blobText(blob));
    expect(serializeEvents).toHaveBeenCalledWith('json');
    expect(payload).toEqual({
      subject: 'CAM001',
      event: 'week_12_arm_1',
      pid: '9001',
      start: '2024-01-01',
      end: '2024-01-31',
      staff: 'tester',
      record: '42',
      keyfield: 'record_id',
      datetime: '2024-02-01T12:34:56.000Z',
      appversion: '3.0.1',
      events: [{
        _eid: 1,
        _gid: 1,
        _title: 'Birthday',
        _type: 'key',
        _date: '2024-01-03',
      }],
    });
    expect(blob.type).toBe('application/json');
    expect(anchor.href).toBe(blobUrl);
    expect(anchor.download).toBe('TLFB-9001-CAM001-2024-01-01-2024-01-31.json');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(blobUrl);
  });

  test('exports metadata and serialized event rows as CSV', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-02-01T12:34:56.000Z'));
    const eventRows: (string | number)[][] = [
      CSV_EVENT_TITLE_ROW,
      [1, '2024-01-03', 'key', 1, 1, 'Birthday'],
    ];
    const serializeEvents = jest.fn(() => eventRows);
    const { file } = makeFile({ serialize_events: serializeEvents });

    file.export_csv();

    const { anchor, blob, blobUrl } = createdDownload();
    const text = await blobText(blob);
    expect(serializeEvents).toHaveBeenCalledWith('csv');
    expect(text).toBe([
      CSV_TITLE_ROW.join(','),
      [
        'CAM001', 'week_12_arm_1', '9001', '2024-01-01', '2024-01-31',
        'tester', '42', 'record_id', '2024-02-01T12:34:56.000Z', '3.0.1',
        '', '', '', '', '', '', '', '',
      ].join(','),
      CSV_FILLER_ROW.join(','),
      CSV_EVENT_TITLE_ROW.join(','),
      [1, '2024-01-03', 'key', 1, 1, 'Birthday'].join(','),
      '',
    ].join('\n'));
    expect(blob.type).toBe('text/csv');
    expect(anchor.href).toBe(blobUrl);
    expect(anchor.download).toBe('TLFB-9001-CAM001-2024-01-01-2024-01-31.csv');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(blobUrl);
  });
});
