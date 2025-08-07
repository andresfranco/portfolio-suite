// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock the window.matchMedia function used by some components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Suppress React warning messages during tests
const originalConsoleError = console.error;
console.error = (...args) => {
  // Skip React 19 and related warnings in tests
  if (
    args[0] && typeof args[0] === 'string' && 
    (args[0].includes('ReactDOM.render') || 
     args[0].includes('validateDOMNesting') ||
     args[0].includes('useLayoutEffect') ||
     args[0].includes('Warning:'))
  ) {
    return;
  }
  originalConsoleError(...args);
};

// Increase default test timeout for async tests
jest.setTimeout(10000);
