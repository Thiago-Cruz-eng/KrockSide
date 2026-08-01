import React from 'react';
import { HubConnectionState } from '@microsoft/signalr';
import { HubConnectionApi, HubContext } from '../hooks/useHubConnection';

export interface FakeHub extends HubConnectionApi {
  emit: (event: string, ...args: unknown[]) => void;
  setInvoke: (impl: (method: string, ...args: unknown[]) => Promise<unknown>) => void;
}

export function createFakeHub(
  initialState: HubConnectionState = HubConnectionState.Connected,
): FakeHub {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  let invokeImpl: (method: string, ...args: unknown[]) => Promise<unknown> = async () => {
    throw new Error('invoke not stubbed');
  };

  const hub: FakeHub = {
    connection: null,
    state: initialState,
    invoke: (method, ...args) => invokeImpl(method, ...args) as Promise<never>,
    on: (event, handler) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return () => handlers.get(event)?.delete(handler);
    },
    emit: (event, ...args) => {
      handlers.get(event)?.forEach((h) => h(...args));
    },
    setInvoke: (impl) => {
      invokeImpl = impl;
    },
  };

  return hub;
}

export const HubTestProvider: React.FC<{
  hub: FakeHub;
  children: React.ReactNode;
}> = ({ hub, children }) => (
  <HubContext.Provider value={hub}>{children}</HubContext.Provider>
);
