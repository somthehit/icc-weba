/**
 * lib/pos/broadcaster.ts
 *
 * Real-time event bus for terminal sync (SSE / WebSockets).
 * Broadcasts stock changes, price updates, and terminal locks to all connected registers.
 */

type Listener = (data: string) => void;

class TerminalBroadcaster {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  broadcast(event: string, payload: unknown) {
    const formatted = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const listener of this.listeners) {
      try {
        listener(formatted);
      } catch (err) {
        console.warn('Listener error in broadcaster:', err);
      }
    }
  }

  broadcastStockChange(productId: number, newStock: number, stockStatus: string) {
    this.broadcast('stock_change', {
      productId,
      newStock,
      stockStatus,
      timestamp: Date.now(),
    });
  }

  broadcastPriceChange(productId: number, newPrice: number) {
    this.broadcast('price_change', {
      productId,
      newPrice,
      timestamp: Date.now(),
    });
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __terminalBroadcaster: TerminalBroadcaster | undefined;
}

export const terminalBroadcaster = global.__terminalBroadcaster || new TerminalBroadcaster();
if (process.env.NODE_ENV !== 'production') {
  global.__terminalBroadcaster = terminalBroadcaster;
}
