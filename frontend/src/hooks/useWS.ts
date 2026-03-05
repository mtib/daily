import { useEffect, useRef, useCallback } from "react";
import type { WSMessage } from "../types.js";

type MessageHandler = (msg: WSMessage) => void;

export function useWS(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1000);
  const mountedRef = useRef(true);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/api/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = 1000; // reset backoff on successful connect
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WSMessage;
        handlerRef.current(msg);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      // Reconnect with exponential backoff (max 30s)
      reconnectTimer.current = setTimeout(() => {
        connect();
      }, backoffRef.current);
      backoffRef.current = Math.min(backoffRef.current * 2, 30000);
    };

    ws.onerror = () => {
      ws.close();
    };

    // Keepalive ping
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 25000);

    ws.addEventListener("close", () => clearInterval(pingInterval));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
