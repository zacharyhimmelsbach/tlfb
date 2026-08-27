import type { DateClickArg } from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg } from '@fullcalendar/core';

import { Editor } from '../src/editor';
import { KeyEvent, NoUseEvent } from '../src/state';
import { FakeCalendar } from './helpers/fake-calendar';

function modal(id: string, fields = '') {
  return `
    <div id="${id}" class="modal">
      <form>
        <p class="modal-card-title"></p>
        <p class="subtitle"></p>
        <div class="content"></div>
        ${fields}
      </form>
      <button class="modal-close" type="button"></button>
      <button class="cancel-operation" type="button"></button>
    </div>
  `;
}

function installEditorDOM() {
  document.body.innerHTML = `
    <div id="mode-notification"></div>
    <button class="tlfb-edit-mode" id="edit-mode-key-event"></button>
    <button class="tlfb-edit-mode" id="edit-mode-substance-event"></button>
    <button class="tlfb-edit-mode" id="edit-mode-no-substance"></button>
    <button class="tlfb-edit-mode" id="edit-mode-copy"></button>
    <button class="tlfb-edit-mode" id="edit-mode-delete"></button>
    ${modal('modal-key-event', '<input name="key-text"><button id="add-key-event" type="submit">Save</button>')}
    ${modal('modal-substance-event', '<button id="add-substance-event" type="submit">Save</button>')}
    ${modal('modal-confirm', `
      <button type="submit" name="action" value="single">Delete one</button>
      <button id="delete-all-button" type="submit" name="action" value="multiple">Delete all</button>
    `)}
  `;
}

function clickDate(date: string): DateClickArg {
  return {
    date: new Date(`${date}T00:00:00`),
    dateStr: date,
    allDay: true,
    dayEl: document.createElement('div'),
    jsEvent: new MouseEvent('click'),
    view: {} as DateClickArg['view'],
  };
}

function clickEvent(id: number, gid: number, title: string): EventClickArg {
  return {
    el: document.createElement('div'),
    event: {
      id: String(id),
      groupId: String(gid),
      title,
      setProp: jest.fn(),
    } as unknown as EventClickArg['event'],
    jsEvent: new MouseEvent('click'),
    view: {} as EventClickArg['view'],
  };
}

describe('Editor', () => {
  beforeEach(() => {
    installEditorDOM();
    history.replaceState({}, '', '/?start=2024-01-01&end=2024-01-31');
  });

  test('wires calendar callbacks and retains the URL date range', () => {
    const calendar = new FakeCalendar();
    const editor = new Editor(calendar.asCalendar());

    expect(Object.keys(calendar.handlers).sort()).toEqual(['dateClick', 'eventClick', 'select']);
    expect(editor.get_event_list().start_date.toString()).toBe('2024-01-01');
    expect(editor.get_event_list().end_date.toString()).toBe('2024-01-31');
  });

  test('uses a safe fallback range when URL dates are absent', () => {
    history.replaceState({}, '', '/');

    const editor = new Editor(new FakeCalendar().asCalendar());

    expect(editor.get_event_list().start_date.toString()).toBe('2000-01-01');
    expect(editor.get_event_list().end_date.toString()).toBe('2000-01-01');
  });

  test('uses the safe fallback range when URL dates are blank', () => {
    history.replaceState({}, '', '/?start=&end=');

    const editor = new Editor(new FakeCalendar().asCalendar());

    expect(editor.get_event_list().start_date.toString()).toBe('2000-01-01');
    expect(editor.get_event_list().end_date.toString()).toBe('2000-01-01');
  });

  test('blocks substance mode until at least one substance is selected', () => {
    const editor = new Editor(new FakeCalendar().asCalendar());
    const button = document.getElementById('edit-mode-substance-event')!;

    button.click();
    expect(document.getElementById('mode-notification')!.innerHTML).toContain('update the <b>substance list</b>');

    editor.update_substances_used({ etoh: [{ label: 'Alcohol', units: ['standard drinks'] }] });
    button.click();
    expect(document.getElementById('mode-notification')!.innerHTML).toContain('add a <b>substance use event</b>');
  });

  test('adds a key event through the modal form', () => {
    const editor = new Editor(new FakeCalendar().asCalendar());
    document.getElementById('edit-mode-key-event')!.click();

    editor.click_date(clickDate('2024-01-08'));
    const form = document.querySelector('#modal-key-event form') as HTMLFormElement;
    (form.elements.namedItem('key-text') as HTMLInputElement).value = 'Birthday';
    const submitter = document.getElementById('add-key-event') as HTMLButtonElement;
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true }) as SubmitEvent;
    Object.defineProperty(submitEvent, 'submitter', { value: submitter });
    form.dispatchEvent(submitEvent);

    expect(editor.get_event_list().get_events()).toHaveLength(1);
    expect(editor.get_event_list().get_events()[0]).toBeInstanceOf(KeyEvent);
    expect(editor.get_event_list().get_events()[0].title).toBe('Birthday');
  });

  test('adds no-use events for every day in the selected inclusive range', () => {
    const editor = new Editor(new FakeCalendar().asCalendar());
    document.getElementById('edit-mode-no-substance')!.click();

    editor.select_range({
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-01-04T00:00:00Z'),
      startStr: '2024-01-01',
      endStr: '2024-01-04',
      allDay: true,
      jsEvent: new MouseEvent('mouseup'),
      view: {} as DateSelectArg['view'],
    });

    const events = editor.get_event_list().get_events();
    expect(events).toHaveLength(3);
    expect(events.every((event) => event instanceof NoUseEvent)).toBe(true);
    expect(events.map((event) => event.date)).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
    expect(new Set(events.map((event) => event.gid)).size).toBe(1);
  });

  test('copies an event to a new date while preserving its group', () => {
    const editor = new Editor(new FakeCalendar().asCalendar());
    const original = new KeyEvent('2024-01-03', 'Milestone');
    editor.get_event_list().add(original);
    document.getElementById('edit-mode-copy')!.click();

    editor.click_event(clickEvent(original.eid, original.gid, original.title));
    editor.click_date(clickDate('2024-01-12'));

    const events = editor.get_event_list().get_events();
    expect(events).toHaveLength(2);
    expect(events[1].date).toBe('2024-01-12');
    expect(events[1].gid).toBe(original.gid);
    expect(events[1].title).toBe(original.title);
  });

  test('clear exits the current mode and restores the instruction', () => {
    const editor = new Editor(new FakeCalendar().asCalendar());
    document.getElementById('edit-mode-delete')!.click();

    editor.clear();

    expect(document.getElementById('mode-notification')!.innerText).toBe('Click the edit menu to begin adding events.');
  });
});
