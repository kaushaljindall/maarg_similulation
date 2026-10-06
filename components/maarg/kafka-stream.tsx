"use client";

import { useState } from "react";
import { Server, ArrowRight } from "lucide-react";
import { ExplainTabs, Panel, Section, SimBadge, TechChip, cn, useInterval } from "./ui";

type Msg = { id: number; offset: number; fresh: boolean };
const PRODUCERS = ["EDGE CAM_01", "EDGE CAM_02", "EDGE CAM_03", "EDGE CAM_04"];
const CONSUMERS = [
  { name: "Ingestion & storage", desc: "validate · enrich · store" },
  { name: "Traffic analytics", desc: "counts · queues · speeds" },
  { name: "Alert engine", desc: "emergency · congestion" },
];

export function KafkaStream() {
  const [parts, setParts] = useState<Msg[][]>(() =>
    [0, 1, 2, 3].map((p) => Array.from({ length: 6 }, (_, i) => ({ id: 10400 + p * 6 + i, offset: 884200 + i, fresh: false }))),
  );
  const [next, setNext] = useState(10424);
  const [last, setLast] = useState(-1);
  const [rates, setRates] = useState([0, 0, 0, 0]);

  useInterval(() => {
    const p = Math.floor(Math.random() * 4);
    setLast(p);
    setRates((r) => r.map((v, i) => (i === p ? v + 1 : v)));
    setParts((ps) =>
      ps.map((msgs, i) => {
        const base = msgs.map((m) => ({ ...m, fresh: false }));
        if (i !== p) return base;
        const off = (base[base.length - 1]?.offset ?? 884200) + 1;
        return [...base, { id: next, offset: off, fresh: true }].slice(-7);
      }),
    );
    setNext((n) => n + 1);
  }, 650);

  return (
    <Section
      id="kafka"
      n="04"
      kicker="Real-time streaming"
      title="Apache Kafka: the real-time event bus"
      lead="Kafka allows observations from many intersections to continuously reach the central intelligence layer — durably, in order, and without overloading any single service."
      actions={<TechChip id="kafka" />}
    >
      <Panel title="Topic maarg.observations · 4 partitions" right={<SimBadge />}>
        <div className="grid items-stretch gap-4 p-4 lg:grid-cols-[180px_1fr_200px]">
          <div className="flex flex-col justify-around gap-2">
            {PRODUCERS.map((p, i) => (
              <div key={p} className={cn("flex items-center gap-2 rounded-md border px-3 py-2 transition-colors", last === i ? "border-edge bg-edge/10" : "border-edge/30 bg-surface-2")}>
                <Server className="h-4 w-4 text-edge" aria-hidden />
                <div className="min-w-0">
                  <div className="font-mono text-xs text-foreground">{p}</div>
                  <div className="font-mono text-[10px] text-muted">producer · {rates[i]} sent</div>
                </div>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted" aria-hidden />
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-success/50 bg-success/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-success">KAFKA CLUSTER</span>
              <span className="font-mono text-[10px] text-muted">retention 7 days · replication 3</span>
            </div>
            <div className="space-y-2">
              {parts.map((msgs, p) => (
                <div key={p} className="flex items-center gap-2">
                  <span className="w-8 shrink-0 font-mono text-[10px] text-muted">P{p}</span>
                  <div className="flex flex-1 gap-1 overflow-hidden rounded border border-border bg-background/60 p-1">
                    {msgs.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "shrink-0 rounded-sm px-1.5 py-1 font-mono text-[10px] transition-colors",
                          m.fresh ? "fade-up bg-primary text-background" : "bg-primary/15 text-primary",
                        )}
                        title={`offset ${m.offset}`}
                      >
                        OBS-{m.id}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 font-mono text-[10px] text-muted">Partition key = camera / junction · order preserved within a partition · newest on the right</p>
          </div>

          <div className="flex flex-col justify-around gap-2">
            {CONSUMERS.map((c) => (
              <div key={c.name} className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                <div className="font-mono text-xs text-foreground">{c.name}</div>
                <div className="font-mono text-[10px] text-muted">consumer group · {c.desc}</div>
              </div>
            ))}
            <div className="text-center font-mono text-[10px] text-primary">→ MAARG CLOUD SERVICES</div>
          </div>
        </div>
      </Panel>
      <div className="mt-4">
        <ExplainTabs
          simple={<p>Kafka is like a high-speed conveyor belt. Every junction drops its notes on the belt, and every department in the city system picks up the notes it needs, at its own pace — nothing gets lost if one department is busy.</p>}
          technical={
            <p>
              Edge nodes act as Kafka producers. Each consumer group (ingestion, analytics, alerts) keeps its own committed offset, so they read the same
              stream independently and can replay from retention after a failure. Partitioning scales throughput horizontally across brokers.
            </p>
          }
        />
      </div>
    </Section>
  );
}
