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
  document.body.innerHTML = [
    ...MODAL_IDS.map((id) => `<div id="${id}" class="modal"></div>`),
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
