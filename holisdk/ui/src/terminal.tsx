import { useEffect, useRef } from 'react';
import { Terminal as Xterm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

// Terminal is the SDK's interactive terminal primitive. It owns the xterm.js dependency
// (which service UIs may not import directly) and the WebSocket transport, so a service
// only needs to hand it a WS endpoint. The wire protocol mirrors remshel's daemon:
//   • binary frames  : raw shell I/O (server→client = output, client→server = keystrokes)
//   • text frames    : JSON control — client sends {type:"resize",rows,cols};
//                      server may send {type:"error",message}
// Cookies authenticate the handshake (same-origin), so no token travels in the URL.
export interface TerminalProps {
  /** WebSocket endpoint. http(s) or ws(s); relative URLs resolve against the page origin. */
  url: string;
  /** CSS height of the terminal viewport (default '70vh'). */
  height?: string | number;
  /** Notified when the socket closes (the shell ended or the connection dropped). */
  onClose?: (info: { code: number; reason: string }) => void;
  /** Notified on a server-sent error control frame. */
  onError?: (message: string) => void;
  className?: string;
}

export function Terminal({ url, height = '70vh', onClose, onError, className }: TerminalProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Hold the latest callbacks so the connect effect doesn't re-run when they change.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new Xterm({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      cursorBlink: true,
      scrollback: 5000,
      theme: { background: '#0b0e14', foreground: '#d6deeb' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    const refit = () => {
      try {
        fit.fit();
      } catch {
        /* host not measured yet */
      }
    };
    refit();
    term.focus();

    const ws = new WebSocket(toWsUrl(url));
    ws.binaryType = 'arraybuffer';
    const enc = new TextEncoder();

    const sendResize = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }));
      }
    };

    ws.onopen = () => {
      sendResize();
      term.focus();
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        try {
          const msg = JSON.parse(ev.data) as { type?: string; message?: string };
          if (msg.type === 'error' && msg.message) onErrorRef.current?.(msg.message);
        } catch {
          /* ignore malformed control frame */
        }
        return;
      }
      term.write(new Uint8Array(ev.data as ArrayBuffer));
    };
    ws.onclose = (ev) => onCloseRef.current?.({ code: ev.code, reason: ev.reason });

    const dataSub = term.onData((d) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(enc.encode(d));
    });

    const ro = new ResizeObserver(() => {
      refit();
      sendResize();
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      dataSub.dispose();
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      term.dispose();
    };
  }, [url]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ width: '100%', height, overflow: 'hidden', borderRadius: 8, background: '#0b0e14' }}
    />
  );
}

function toWsUrl(u: string): string {
  const abs = new URL(u, window.location.href);
  abs.protocol = abs.protocol === 'https:' ? 'wss:' : 'ws:';
  return abs.toString();
}
