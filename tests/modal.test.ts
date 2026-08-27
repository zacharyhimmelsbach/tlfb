import { Modal } from '../src/modal';

function renderModal(id = 'test-modal') {
  document.body.innerHTML = `
    <div id="${id}" class="modal">
      <form>
        <input name="title" value="Original title">
        <select name="kind">
          <option value="key">Key</option>
          <option value="use">Use</option>
        </select>
        <input name="ignored" value="not submitted" disabled>
        <p class="summary"></p>
        <div class="toggle is-hidden"></div>
        <button class="cancel-operation" type="button">Cancel</button>
        <button id="submit-modal" type="submit" value="multiple">Save</button>
      </form>
      <button class="modal-close" type="button">Close</button>
    </div>
  `;

  return document.getElementById(id) as HTMLElement;
}

describe('Modal', () => {
  test('requires an existing element with the modal class', () => {
    expect(() => new Modal('missing')).toThrow(
      "Modal(): Could not locate DOM element '#missing'.",
    );

    document.body.innerHTML = '<div id="not-a-modal"></div>';

    expect(() => new Modal('not-a-modal')).toThrow(
      "Modal(): '#not-a-modal' is not of class 'modal'.",
    );
  });

  test('opens, submits FormData with the submitter action, then closes and resets', () => {
    const element = renderModal();
    const modal = new Modal('test-modal');
    const onSubmit = jest.fn<void, [FormData]>();
    const title = element.querySelector('[name="title"]') as HTMLInputElement;
    const kind = element.querySelector('[name="kind"]') as HTMLSelectElement;
    const submit = document.getElementById('submit-modal') as HTMLButtonElement;

    expect(modal.open(onSubmit)).toBe(modal);
    expect(element.classList.contains('is-active')).toBe(true);

    title.value = 'Updated title';
    kind.value = 'use';
    const submitEvent = new Event('submit', {
      bubbles: true,
      cancelable: true,
    }) as SubmitEvent;
    Object.defineProperty(submitEvent, 'submitter', { value: submit });
    element.querySelector('form')!.dispatchEvent(submitEvent);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.get('title')).toBe('Updated title');
    expect(submitted.get('kind')).toBe('use');
    expect(submitted.get('ignored')).toBeNull();
    expect(submitted.get('action')).toBe('multiple');

    expect(element.classList.contains('is-active')).toBe(false);
    expect(title.value).toBe('Original title');
    expect(kind.value).toBe('key');
  });

  test.each(['.cancel-operation', '.modal-close'])(
    '%s closes an active modal and resets its form',
    (selector) => {
      const element = renderModal();
      const modal = new Modal('test-modal');
      const title = element.querySelector('[name="title"]') as HTMLInputElement;

      modal.open(jest.fn());
      title.value = 'Unsaved title';
      (element.querySelector(selector) as HTMLElement).click();

      expect(element.classList.contains('is-active')).toBe(false);
      expect(title.value).toBe('Original title');
    },
  );

  test('populates controls and text, toggles classes, and returns FormData', () => {
    const element = renderModal();
    const modal = new Modal('test-modal');

    expect(modal.populateForm({ title: 'Populated', kind: 'use' })).toBe(modal);
    expect(modal.populateText({ '.summary': '<strong>Three events</strong>' })).toBe(modal);
    expect(modal.setElementClass({ '.toggle': ['is-hidden', false] })).toBe(modal);

    expect((element.querySelector('[name="title"]') as HTMLInputElement).value).toBe('Populated');
    expect((element.querySelector('[name="kind"]') as HTMLSelectElement).value).toBe('use');
    expect(element.querySelector('.summary')!.innerHTML).toBe('<strong>Three events</strong>');
    expect(element.querySelector('.toggle')!.classList.contains('is-hidden')).toBe(false);

    modal.setElementClass({ '.toggle': ['is-hidden', true] });
    expect(element.querySelector('.toggle')!.classList.contains('is-hidden')).toBe(true);

    const data = modal.getFormData();
    expect(data.get('title')).toBe('Populated');
    expect(data.get('kind')).toBe('use');
  });

  test('reports missing forms, named controls, and descendant selectors', () => {
    document.body.innerHTML = '<div id="formless" class="modal"><p class="copy"></p></div>';
    const formless = new Modal('formless');

    expect(() => formless.getFormData()).toThrow(
      'Modal.getFormData(): Cannot get form data for modal with no descendant form formless.',
    );
    expect(() => formless.populateForm({ title: 'No form' })).toThrow(
      'Modal.populateForm(): Cannot populate modal with no descendant form formless.',
    );

    renderModal();
    const modal = new Modal('test-modal');

    expect(() => modal.populateForm({ missing: 'value' })).toThrow(
      "Modal.populateForm(): Named element 'missing' not found in form.",
    );
    expect(() => modal.populateText({ '.missing': 'value' })).toThrow(
      "Modal.populateText(): Element not found for '.missing'.",
    );
    expect(() => modal.setElementClass({ '.missing': ['active', true] })).toThrow(
      "Modal.addElementClass(): Element not found for '.missing'.",
    );
  });

  test('throws when a form is submitted without a handler', () => {
    const element = renderModal();
    const modal = new Modal('test-modal');
    const submitter = document.getElementById('submit-modal') as HTMLButtonElement;

    modal.open();

    expect(() => modal.submit({ submitter } as unknown as SubmitEvent)).toThrow(
      'Modal.submit(): Form submitted but no handler specified.',
    );
    expect(element.classList.contains('is-active')).toBe(true);
  });
});
