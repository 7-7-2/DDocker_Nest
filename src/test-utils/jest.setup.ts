jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'test-nanoid'),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

// Global RxJS interval mock to prevent open handles in tests
jest.mock('rxjs', () => {
  const original = jest.requireActual('rxjs');
  return {
    ...original,
    interval: jest.fn(() => original.NEVER),
  };
});
