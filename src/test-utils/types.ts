/**
 * A flexible type helper that transforms all methods of a class/interface into Jest Mocks.
 * This version uses the base jest.Mock type to support complex method overloads (like ConfigService.get)
 * while maintaining 100% cast-free usage in spec files.
 */
export type Mock<T> = {
  [P in keyof T]?: T[P] extends (...args: any[]) => any ? jest.Mock : T[P];
};
