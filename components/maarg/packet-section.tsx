"use client";

import { Package, Video, Cloud, Server } from "lucide-react";
import { SAMPLE_OBSERVATION } from "@/lib/sim-data";
import { CloudShape, ServerRack } from "./illustrations";
import { useSim } from "./sim-context";
import { Btn, ExplainTabs, JsonView, Modal, Panel, Section, SimBadge } from "./ui";

function HumanReadable() {
  const o = SAMPLE_OBSERVATION;
  return (
    <blockquote className="rounded-md border-l-4 border-primary bg-primary/10 p-4 text-base leading-relaxed text-foreground">
      &quot;Car <span className="font-mono text-edge">{o.plate}</span> was detected at <span className="font-mono">{o.camera_id}</span>, moving {o.direction} in lane {o.lane} at {o.speed} km/h
      (08:42:16, confidence {Math.round(o.confidence * 100)}%).&quot;
    </blockquote>
  );
}

export function PacketModal() {
  const { overlay, setOverlay } = useSim();
  return (
    <Modal open={overlay === "packet"} onClose={() => setOverlay(null)} title="Data inside this packet" subtitle="Observation OBS-10421 · EDGE_J04 → Kafka → MAARG cloud · ~0.5 KB" size="lg">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 font-mono text-xs uppercase tracking-wider text-muted">Technical (JSON)</div>
          <JsonView data={SAMPLE_OBSERVATION} />
        </div>
        <div className="flex flex-col gap-3">
          <div className="font-mono text-xs uppercase tracking-wider text-muted">Human readable</div>
          <HumanReadable />
          <FieldNotes />
        </div>
      </div>
      <TravelRule />
    </Modal>
  );
}

function FieldNotes() {
  const rows: [string, string][] = [
    ["vehicle_id", "Local ID from ByteTrack; unique only inside this camera"],
    ["plate", "PaddleOCR output — the key for cross-camera matching"],
    ["speed", "Approximate, from track displacement (km/h)"],
    ["latitude / longitude", "Camera location from configuration"],
    ["confidence", "Detection/OCR confidence (0–1)"],
  ];
  return (
    <dl className="divide-y divide-border rounded-md border border-border text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-3 px-3 py-2">
          <dt className="w-36 shrink-0 font-mono text-xs text-primary">{k}</dt>
          <dd className="text-muted">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function TravelRule() {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="flex items-start gap-3 rounded-lg border border-edge/50 bg-edge/10 p-4">
        <Video className="mt-0.5 h-5 w-5 shrink-0 text-edge" aria-hidden />
        <div>
          <div className="font-mono text-sm font-semibold text-edge">VIDEO → stays / gets processed at EDGE</div>
          <p className="mt-1 text-sm text-muted">Decoded and analysed locally. Raw or selected clips remain available at the edge and can be retrieved when required.</p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-primary/50 bg-primary/10 p-4">
        <Package className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div>
          <div className="font-mono text-sm font-semibold text-primary">OBSERVATION → travels to CENTRAL MAARG</div>
          <p className="mt-1 text-sm text-muted">A small structured event per vehicle passage, streamed in real time through Kafka.</p>
        </div>
      </div>
    </div>
  );
}

export function PacketSection() {
  const { setOverlay } = useSim();
  const path = "M 190 120 C 360 40, 560 40, 720 110";
  return (
    <Section
      id="packet"
      n="03"
      kicker="Edge → cloud"
      title="Exactly what travels from the edge to the cloud"
      lead="Each vehicle passage becomes one small observation packet. Click the moving packet to open it."
      actions={
        <Btn variant="primary" onClick={() => setOverlay("packet")}>
          <Package className="h-4 w-4" aria-hidden /> Open packet
        </Btn>
      }
    >
      <Panel title="Uplink · EDGE_J04 → MAARG cloud" right={<SimBadge />}>
        <svg viewBox="0 0 920 230" className="block w-full grid-bg" role="img" aria-label="An observation packet travels from the edge server to the MAARG cloud">
          <ServerRack x={100} y={60} w={80} h={110} label="EDGE_J04" active />
          <CloudShape x={720} y={56} w={180} h={110}>
            <text x={90} y={50} textAnchor="middle" fontSize={13} fontWeight={600} className="fill-foreground">
              MAARG CLOUD
            </text>
            <text x={90} y={70} textAnchor="middle" fontSize={10} className="fill-muted font-mono">
              via Kafka
            </text>
          </CloudShape>
          <path d={path} fill="none" stroke="var(--primary)" strokeOpacity={0.5} strokeWidth={2} className="flow-line" />
          <path d="M 190 160 L 300 160" stroke="var(--edge)" strokeWidth={3} className="flow-line" />
          <text x={196} y={185} fontSize={10} className="fill-edge font-mono">
            video stays local
          </text>
          {[0, 1.3, 2.6].map((begin, i) => (
            <g key={i} className="cursor-pointer" onClick={() => setOverlay("packet")} role="button" aria-label="Open observation packet">
              <g>
                <animateMotion dur="3.9s" repeatCount="indefinite" begin={`${begin}s`} path={path} />
                <rect x={-34} y={-13} width={68} height={26} rx={4} fill="var(--primary)" />
                <text x={0} y={4} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--background)" className="font-mono">
                  OBS-{10421 + i}
                </text>
              </g>
            </g>
          ))}
          <text x={455} y={210} textAnchor="middle" fontSize={11} className="fill-primary font-mono">
            ~0.5 KB structured observation · click to inspect
          </text>
        </svg>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Technical representation">
          <div className="p-4">
            <JsonView data={SAMPLE_OBSERVATION} highlight={["plate", "camera_id", "timestamp"]} />
          </div>
        </Panel>
        <Panel title="Human readable">
          <div className="flex flex-col gap-3 p-4">
            <HumanReadable />
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="flex flex-col items-center gap-1 rounded-md border border-edge/40 p-2">
                <Server className="h-4 w-4 text-edge" aria-hidden />
                <span className="text-muted">Created at edge</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-md border border-success/40 p-2">
                <Package className="h-4 w-4 text-success" aria-hidden />
                <span className="text-muted">Streamed via Kafka</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-md border border-primary/40 p-2">
                <Cloud className="h-4 w-4 text-primary" aria-hidden />
                <span className="text-muted">Used city-wide</span>
              </div>
            </div>
          </div>
        </Panel>
      </div>
      <TravelRule />
      <div className="mt-4">
        <ExplainTabs
          simple={<p>Instead of sending the whole video, the junction sends a tiny note about each vehicle. The city system collects millions of these notes.</p>}
          technical={
            <p>
              Observations are serialised (JSON in this view; a binary schema such as Avro/Protobuf is equally possible) and produced to Kafka with the
              camera/junction as the partition key so events from one location stay ordered. The cloud never needs the video to compute flows, journeys
              or predictions.
            </p>
          }
        />
      </div>
    </Section>
  );
}
