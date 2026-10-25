/**
 * lib/pos/perf.ts
 *
 * High-precision timing & diagnostic telemetry for Counter POS.
 * Generates W3C Server-Timing headers and tracks latency across critical operations:
 * 1. Initial Page Load
 * 2. Product Grid Fetch
 * 3. Barcode Scan & Lookup
 * 4. Trigram / Fulltext Catalog Search
 * 5. Add to Cart / Reservation
 * 6. Tender Drawer Open
 * 7. Invoice & Payment Transaction Commit
 * 8. Category Aggregation
 * 9. Thermal ESC/POS Receipt Rendering
 * 10. IRD CBMS Sync Queueing
 */

export interface TimingTrace {
  name: string;
  start: number;
  dur?: number;
  desc?: string;
}

export class PosProfiler {
  private traces: TimingTrace[] = [];
  private t0: number;

  constructor(private context: string) {
    this.t0 = performance.now();
  }

  start(name: string, desc?: string): () => number {
    const start = performance.now();
    return () => {
      const dur = performance.now() - start;
      this.traces.push({ name, start, dur, desc });
      return dur;
    };
  }

  record(name: string, dur: number, desc?: string) {
    this.traces.push({ name, start: performance.now() - dur, dur, desc });
  }

  getServerTimingHeader(): string {
    const total = performance.now() - this.t0;
    const parts = this.traces.map((t) => {
      const d = t.dur !== undefined ? t.dur.toFixed(2) : '0.00';
      return `${t.name};dur=${d}${t.desc ? `;desc="${t.desc}"` : ''}`;
    });
    parts.push(`total;dur=${total.toFixed(2)};desc="Total Route Duration"`);
    return parts.join(', ');
  }

  logSummary() {
    const total = (performance.now() - this.t0).toFixed(2);
    const traceSummary = this.traces
      .map((t) => `${t.name}: ${t.dur?.toFixed(2)}ms`)
      .join(' | ');
    console.log(`⏱️ [POS-Perf:${this.context}] Total: ${total}ms [${traceSummary}]`);
  }
}
