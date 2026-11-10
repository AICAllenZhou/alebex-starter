import { createMockTransport, type MockTransportOptions } from './mockTransport';
import type { SessionMode, SessionTransport } from './types';
import { createWebSocketTransport } from './websocketTransport';

export function createTransport(options: {
  mode: SessionMode;
  forceMock: boolean;
  mock?: MockTransportOptions;
}): SessionTransport {
  if (options.forceMock || options.mode === 'mock') {
    return createMockTransport(options.mock);
  }
  return createWebSocketTransport();
}
