import { find_parent_modal, next_date, set_inner } from '../src/util';

describe('DOM utilities', () => {
  test('set_inner writes plain text without interpreting markup', () => {
    document.body.innerHTML = '<div id="output"></div>';

    set_inner('output', '<strong>safe text</strong>');

    const output = document.getElementById('output')!;
    expect(output.innerText).toBe('<strong>safe text</strong>');
    expect(output.children).toHaveLength(0);
  });

  test('set_inner appends every node in a NodeList', () => {
    document.body.innerHTML = `
      <div id="output"></div>
      <div id="source"><span>one</span><span>two</span></div>
    `;
    const nodes = document.querySelectorAll('#source span');

    set_inner('output', nodes);

    expect(document.querySelectorAll('#output span')).toHaveLength(2);
    expect(document.getElementById('output')!.textContent).toBe('onetwo');
  });

  test('set_inner rejects an unknown target', () => {
    expect(() => set_inner('missing', 'value')).toThrow('Failed to select element #missing.');
  });

  test('find_parent_modal returns the nearest modal ancestor', () => {
    document.body.innerHTML = '<div id="modal" class="modal"><button id="child"></button></div>';

    expect(find_parent_modal(document.getElementById('child')!)).toBe(document.getElementById('modal'));
  });

  test('find_parent_modal rejects elements outside a modal', () => {
    document.body.innerHTML = '<button id="child"></button>';

    expect(() => find_parent_modal(document.getElementById('child')!)).toThrow('No modal found');
  });
});

describe('next_date', () => {
  test.each([
    ['2024-01-31', '2024-02-01'],
    ['2024-02-29', '2024-03-01'],
    ['2024-03-09', '2024-03-10'],
    ['2024-11-02', '2024-11-03'],
    ['2024-12-31', '2025-01-01'],
  ])('returns the calendar day after %s', (date, expected) => {
    expect(next_date(date)).toBe(expected);
  });
});
