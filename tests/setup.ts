beforeEach(() => {
  document.body.innerHTML = '';
  sessionStorage.clear();
  history.replaceState({}, '', '/');

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: jest.fn(() => 'blob:test-download'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: jest.fn(),
  });

  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(window, 'alert').mockImplementation(() => undefined);
});
