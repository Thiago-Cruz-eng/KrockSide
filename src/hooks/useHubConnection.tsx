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
  // `connection: HubConnection | null` saiu daqui. A conexão só é criada dentro do
  // efeito, depois do primeiro render, então o valor exposto no contexto era null
  // justamente quando alguém quisesse usá-lo — e ninguém usava. Quem precisa falar com
  // o hub usa `invoke`/`on`.
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
  // Começa em Connecting porque o provider abre a conexão no primeiro efeito, sempre.
  // Antes iniciava em Disconnected e chamava setState(Connecting) dentro do efeito, o
  // que é uma escrita de estado síncrona em efeito sem ganho nenhum.
  const [state, setState] = useState<HubConnectionState>(HubConnectionState.Connecting);

  // `factory` fora do array de dependências, atrás de um ref: quem passasse uma arrow
  // inline recriava a função a cada render, e o efeito derrubava e reabria a conexão
  // SignalR junto — a partida caía a cada re-render do provider. O ref é inicializado
  // no primeiro render e deliberadamente não é ressincronizado: a fábrica que vale é a
  // do momento da montagem.
  const factoryRef = useRef(factory);

  useEffect(() => {
    const build = factoryRef.current;
    const conn = build ? build() : defaultFactory(url);
    connectionRef.current = conn;

    const onStateChange = () => setState(conn.state);
    conn.onreconnecting(onStateChange);
    conn.onreconnected(onStateChange);
    conn.onclose(onStateChange);

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
  }, [url]);

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
    () => ({ state, invoke, on }),
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
