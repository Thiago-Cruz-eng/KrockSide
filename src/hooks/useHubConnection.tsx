import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { HUB_URL, getStoredToken } from '../service/Api';

export interface HubConnectionApi {
  connection: HubConnection | null;
  state: HubConnectionState;
  invoke: <T = unknown>(method: string, ...args: unknown[]) => Promise<T>;
  on: (event: string, handler: (...args: unknown[]) => void) => () => void;
}

export const HubContext = createContext<HubConnectionApi | null>(null);

export interface HubProviderProps {
  url?: string;
  factory?: () => HubConnection;
  children: React.ReactNode;
}

function defaultFactory(url: string): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(url, {
      accessTokenFactory: () => {
        const userId = sessionStorage.getItem('currentUserId');
        return getStoredToken(userId) ?? '';
      },
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .configureLogging(LogLevel.Warning)
    .build();
}

export const HubProvider: React.FC<HubProviderProps> = ({
  url = HUB_URL,
  factory,
  children,
}) => {
  const connectionRef = useRef<HubConnection | null>(null);
  const [state, setState] = useState<HubConnectionState>(HubConnectionState.Disconnected);

  useEffect(() => {
    const conn = factory ? factory() : defaultFactory(url);
    connectionRef.current = conn;

    const onStateChange = () => setState(conn.state);
    conn.onreconnecting(onStateChange);
    conn.onreconnected(onStateChange);
    conn.onclose(onStateChange);

    setState(HubConnectionState.Connecting);
    conn
      .start()
      .then(() => setState(conn.state))
      .catch((err) => {
        console.error('Hub start failed:', err);
        setState(HubConnectionState.Disconnected);
      });

    return () => {
      conn.stop().catch(() => undefined);
      connectionRef.current = null;
    };
  }, [url, factory]);

  const invoke = useCallback(
    async <T,>(method: string, ...args: unknown[]): Promise<T> => {
      const conn = connectionRef.current;
      if (!conn || conn.state !== HubConnectionState.Connected) {
        throw new Error(`Hub not connected (state=${conn?.state ?? 'null'})`);
      }
      return conn.invoke<T>(method, ...args);
    },
    [],
  );

  const on = useCallback(
    (event: string, handler: (...args: unknown[]) => void) => {
      const conn = connectionRef.current;
      if (!conn) return () => undefined;
      conn.on(event, handler);
      return () => conn.off(event, handler);
    },
    [],
  );

  const value = useMemo<HubConnectionApi>(
    () => ({ connection: connectionRef.current, state, invoke, on }),
    [state, invoke, on],
  );

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
};

export function useHubConnection(): HubConnectionApi {
  const ctx = useContext(HubContext);
  if (!ctx) {
    throw new Error('useHubConnection must be used inside HubProvider');
  }
  return ctx;
}
