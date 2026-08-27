jest.mock('../src/main', () => ({
  update_properties: jest.fn(),
}));

import type { Editor } from '../src/editor';
import { File } from '../src/file';
import { UseEvent } from '../src/state';
import type { CalendarEvent } from '../src/state';
import type { TLFBProperties, UseEventProperties } from '../src/types';
import { FakeCalendar } from './helpers/fake-calendar';

const MODAL_IDS = [
  'modal-select-substances',
  'modal-update-properties',
  'modal-get-summary',
  'modal-import-json',
  'modal-import-csv',
  'modal-confirm-export',
  'modal-incomplete-export',
];

const SUMMARY_IDS = [
  'tlfb_etoh_total_days',
  'tlfb_mj_total_days',
  'tlfb_nic_total_days',
  'tlfb_etoh_total_units',
  'tlfb_mj_total_units',
  'tlfb_nic_total_units',
  'tlfb_etoh_avg_unitsday',
  'tlfb_mj_avg_unitsday',
  'tlfb_nic_avg_unitsday',
  'tlfb_etoh_avg_units',
  'tlfb_mj_avg_units',
  'tlfb_nic_avg_units',
  'tlfb_etoh_avg_days',
  'tlfb_mj_avg_days',
  'tlfb_nic_avg_days',
  'tlfb_etoh_last_use',
  'tlfb_mj_last_use',
  'tlfb_nic_last_use',
];

function mountSummaryDom() {
  const modalMarkup: Record<string, string> = {
    'modal-get-summary': `
      <div id="modal-get-summary" class="modal">
        <form><button id="summary-export" type="submit">Export Data</button></form>
      </div>
    `,
    'modal-confirm-export': `
      <div id="modal-confirm-export" class="modal">
        <form>
          <select name="select-export-method"><option value="json">json</option></select>
          <button type="submit">Confirm</button>
        </form>
      </div>
    `,
    'modal-incomplete-export': `
      <div id="modal-incomplete-export" class="modal">
        <p id="incomplete-export-description"></p>
        <p id="incomplete-export-guidance"></p>
        <details id="incomplete-export-date-details">
          <summary id="missing-date-summary"></summary>
          <ul id="missing-date-list"></ul>
        </details>
        <button id="incomplete-export-return" class="cancel-operation" type="button"></button>
      </div>
    `,
  };

  document.body.innerHTML = [
    ...MODAL_IDS.map((id) => modalMarkup[id] ?? `<div id="${id}" class="modal"></div>`),
    ...SUMMARY_IDS.map((id) => `<span id="${id}"></span>`),
  ].join('');
}

function alcoholEvent(date: string, amount: number): UseEvent {
  const properties: UseEventProperties = {
    category: 'etoh',
    substance: 'Alcohol',
    methodType: '',
    methodTypeOther: '',
    method: 'Beer',
    methodOther: '',
    times: 1,
    amount,
    units: 'standard drinks',
    unitsOther: '',
    note: '',
  };

  return new UseEvent(date, properties);
}

test('File.summarize includes use events on both inclusive range boundaries', () => {
  mountSummaryDom();

  const properties: TLFBProperties = {
    subject: 'CAM001',
    record: '42',
    pid: '9001',
    timepoint: 'week_1_arm_1',
    start: '2024-01-01',
    end: '2024-01-07',
    keyfield: 'record_id',
    staff: 'tester',
    days: 7,
  };
  const events: CalendarEvent[] = [
    alcoholEvent('2023-12-31', 100),
    alcoholEvent(properties.start, 2),
    alcoholEvent(properties.end, 3),
    alcoholEvent('2024-01-08', 100),
  ];
  const editor = {
    get_event_list: jest.fn(() => ({
      get_events: jest.fn(() => events),
    })),
    update_substances_used: jest.fn(),
  } as unknown as Editor;
  const calendar = new FakeCalendar();
  const file = new File(properties, calendar.asCalendar(), editor);

  file.summarize();

  expect(document.getElementById('tlfb_etoh_total_days')!.innerText).toBe('2');
  expect(document.getElementById('tlfb_etoh_total_units')!.innerHTML).toBe('5');
  expect(document.getElementById('modal-get-summary')!.classList).toContain('is-active');
});

test('File.summarize blocks its export flow when the timeline is incomplete', () => {
  mountSummaryDom();

  const properties: TLFBProperties = {
    subject: 'CAM001',
    record: '42',
    pid: '9001',
    timepoint: 'week_1_arm_1',
    start: '2024-01-01',
    end: '2024-01-03',
    keyfield: 'record_id',
    staff: 'tester',
    days: 3,
  };
  const events: CalendarEvent[] = [
    alcoholEvent('2024-01-01', 1),
    alcoholEvent('2024-01-03', 1),
  ];
  const editor = {
    get_event_list: jest.fn(() => ({
      get_events: jest.fn(() => events),
    })),
    update_substances_used: jest.fn(),
  } as unknown as Editor;
  const file = new File(properties, new FakeCalendar().asCalendar(), editor);

  file.summarize();
  const form = document.querySelector('#modal-get-summary form')!;
  const submitter = document.getElementById('summary-export')!;
  const submitEvent = new Event('submit', { bubbles: true, cancelable: true }) as SubmitEvent;
  Object.defineProperty(submitEvent, 'submitter', { value: submitter });
  form.dispatchEvent(submitEvent);

  expect(document.getElementById('modal-confirm-export')!.classList).not.toContain('is-active');
  expect(document.getElementById('modal-incomplete-export')!.classList).toContain('is-active');
  expect(document.getElementById('incomplete-export-description')!.innerText).toBe(
    '1 day is missing an indication.',
  );
  expect(document.querySelector('#missing-date-list time')!.getAttribute('datetime')).toBe('2024-01-02');
});
