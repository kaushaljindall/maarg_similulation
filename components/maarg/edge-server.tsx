"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowRight, Cpu, HelpCircle } from "lucide-react";
import { TECH } from "@/lib/sim-data";
import { ServerRack } from "./illustrations";
import { useSim } from "./sim-context";
import { Btn, ExplainTabs, Modal, Panel, Section, SimBadge, TechChip, cn, useInterval } from "./ui";

type Stage = { id: string; title: string; techId?: string; diagram: ReactNode };

const STAGES: Stage[] = [
  {
    id: "raw",
    title: "Raw video",
    techId: "camera",
    diagram: (
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-10 rounded-sm border border-border-strong bg-surface-3">
            <div className="m-1 h-1.5 w-4 rounded-sm bg-muted/50" />
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "frames",
    title: "Frame extraction",
    techId: "frames",
    diagram: (
      <div className="flex gap-1 font-mono text-[10px]">
        {[182, 183, 184].map((f) => (
          <span key={f} className="rounded-sm border border-edge/50 bg-edge/10 px-1.5 py-1 text-edge">
            #{f}
          </span>
        ))}
      </div>
    ),
  },
  {
    id: "preprocess",
    title: "Preprocessing",
    techId: "preprocess",
    diagram: (
      <div className="flex items-center gap-2 font-mono text-[10px] text-muted">
        <span className="rounded-sm border border-border-strong px-1.5 py-1">1920×1080</span>
        <ArrowRight className="h-3 w-3" aria-hidden />
        <span className="rounded-sm border border-edge/50 px-1.5 py-1 text-edge">640×640 · ROI</span>
      </div>
    ),
  },
  {
    id: "yolo",
    title: "Vehicle detection",
    techId: "yolo",
    diagram: (
      <div className="space-y-1">
        <div className="flex gap-1 font-mono text-[10px]">
          {["car", "bus", "bike"].map((c) => (
            <span key={c} className="rounded-sm border border-primary px-1.5 py-0.5 text-primary">
              [{c}]
            </span>
          ))}
        </div>
        <div className="font-mono text-[10px] leading-4 text-muted">
          V1042 · V1043 · V1044 detected
        </div>
      </div>
    ),
  },
  {
    id: "bytetrack",
    title: "Multi-object tracking",
    techId: "bytetrack",
    diagram: (
      <div className="font-mono text-[10px] text-muted">
        <div className="text-foreground">Vehicle 1042</div>
        <div className="mt-1 flex items-center gap-1">
          {[182, 183, 184].map((f, i) => (
            <span key={f} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-edge" style={{ opacity: 0.4 + i * 0.3 }} />F{f}
              {i < 2 && <ArrowRight className="h-2.5 w-2.5" aria-hidden />}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "plate",
    title: "Plate detection",
    techId: "plate",
    diagram: (
      <div className="inline-block rounded-sm border-2 border-edge bg-[#f5f5f0] px-2 py-0.5 font-mono text-xs font-bold text-[var(--surface-2)]">
        DL01AB1234
      </div>
    ),
  },
  {
    id: "ocr",
    title: "OCR",
    techId: "ocr",
    diagram: (
      <div className="font-mono text-[11px]">
        <div className="text-success">&quot;DL01AB1234&quot;</div>
        <div className="text-muted">confidence 0.96</div>
      </div>
    ),
  },
  {
    id: "observation",
    title: "Observation generation",
    techId: "observation",
    diagram: (
      <div className="rounded-sm border border-primary/50 bg-primary/10 px-2 py-1 font-mono text-[10px] leading-4 text-primary">
        {"{ cam: CAM_07, plate: DL01AB1234, type: car, lane: 2, 42 km/h }"}
      </div>
    ),
  },
];

export function EdgeServer() {
  const { setOverlay, openSpec } = useSim();
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  useInterval(() => setActive((a) => (a + 1) % STAGES.length), auto ? 1500 : null);

  return (
    <Section
      id="edge"
      n="02"
      kicker="Edge AI perception"
      title="Edge AI server: video becomes structured observations"
      lead="A GPU server installed close to the cameras (in or near the junction cabinet) runs the perception pipeline. This is where the heavy video processing happens, with low latency and without sending raw video across the city."
      actions={
        <Btn variant="primary" onClick={() => setOverlay("edge-explainer")}>
          <HelpCircle className="h-4 w-4" aria-hidden />
          WHAT IS HAPPENING INSIDE EDGE?
        </Btn>
      }
    >
      <Panel tone="edge" className="overflow-hidden">
        <div className="grid lg:grid-cols-[220px_1fr]">
          <div className="flex flex-col items-center gap-4 border-b border-edge/30 bg-edge/5 p-6 lg:border-b-0 lg:border-r">
            <svg viewBox="0 0 120 170" className="w-28" aria-hidden>
              <ServerRack x={20} y={10} w={80} h={130} active />
            </svg>
            <div className="text-center">
              <div className="font-mono text-sm font-semibold text-edge">EDGE AI SERVER</div>
              <div className="font-mono text-xs text-muted">EDGE_J04 · junction cabinet</div>
            </div>
            <ul className="w-full space-y-1.5 font-mono text-[11px] text-muted">
              <li className="flex justify-between"><span>Inputs</span><span className="text-foreground">4 camera streams</span></li>
              <li className="flex justify-between"><span>Compute</span><span className="text-foreground">GPU inference</span></li>
              <li className="flex justify-between"><span>Runtime</span><span className="text-foreground">Python</span></li>
              <li className="flex justify-between"><span>Output</span><span className="text-primary">observations</span></li>
            </ul>
            <div className="flex flex-wrap justify-center gap-1.5">
              {["frames", "yolo", "bytetrack", "ocr"].map((t) => (
                <TechChip key={t} id={t} />
              ))}
            </div>
            <SimBadge />
          </div>

          <div className="p-4 md:p-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-wider text-muted">Processing pipeline · click a stage for details</p>
              <button type="button" onClick={() => setAuto((a) => !a)} className="font-mono text-xs text-muted hover:text-foreground">
                {auto ? "Pause animation" : "Animate"}
              </button>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {STAGES.map((s, i) => {
                const spec = s.techId ? TECH[s.techId] : undefined;
                const on = i === active;
                const done = i < active;
                return (
                  <li key={s.id} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setActive(i);
                        setAuto(false);
                        if (s.techId) openSpec(s.techId);
                      }}
                      className={cn(
                        "flex h-full w-full flex-col gap-3 rounded-lg border p-3 text-left transition-colors",
                        on ? "border-edge bg-edge/10" : done ? "border-edge/30 bg-surface-2" : "border-border bg-surface-2/60 hover:border-border-strong",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-muted">STEP {i + 1}</span>
                        {spec && <span className="font-mono text-[10px] text-edge">{spec.tech}</span>}
                      </div>
                      <div className="text-sm font-semibold text-foreground">{s.title}</div>
                      <div className="min-h-10">{s.diagram}</div>
                      {spec && <p className="text-xs leading-relaxed text-muted">{spec.does}</p>}
                    </button>
                    {on && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-edge" aria-hidden />}
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground">
              <Cpu className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              Output leaving the edge: one compact observation per vehicle passage — not the video.
            </div>
          </div>
        </div>
      </Panel>

      <div className="mt-4">
        <ExplainTabs
          simple={
            <p>
              Think of the edge server as a traffic officer standing at the junction who watches the video and writes a short note for every vehicle:
              &quot;white car, DL01AB1234, lane 2, going north, 42 km/h, 08:42:16&quot;. Only the note is sent onward.
            </p>
          }
          technical={
            <p>
              OpenCV decodes RTSP into frames; frames are letterboxed and normalised; a YOLO detector (PyTorch) produces boxes and classes; ByteTrack
              assigns persistent track IDs using IoU association and a Kalman motion model; a plate detector crops the plate from the best frame of the
              track; PaddleOCR reads it; when the track crosses the virtual count line an observation event is emitted to Kafka. Speed comes from track
              displacement through a calibrated image-to-road homography, so it is an approximation.
            </p>
          }
        />
      </div>
    </Section>
  );
}

export function EdgeExplainerModal() {
  const { overlay, setOverlay } = useSim();
  const fields = ["Vehicle ID", "Plate", "Vehicle type", "Camera ID", "Timestamp", "Location", "Direction", "Lane", "Speed", "Confidence"];
  return (
    <Modal open={overlay === "edge-explainer"} onClose={() => setOverlay(null)} title="What is happening inside the edge?" subtitle="The edge server converts raw video into structured traffic observations." size="xl">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <div className="rounded-lg border border-border-strong bg-surface-2 p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-muted">Raw video</div>
          <div className="mt-1 text-lg font-semibold text-foreground">10,000 video frames</div>
          <div className="text-sm text-muted">≈ 6 min 40 s at 25 fps · ≈ 200 MB at 4 Mbit/s</div>
          <div className="mt-3 grid grid-cols-[repeat(25,minmax(0,1fr))] gap-[2px]" aria-hidden>
            {Array.from({ length: 400 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-[1px] bg-edge/50" />
            ))}
          </div>
          <div className="mt-2 font-mono text-[10px] text-muted">each square ≈ 25 frames (1 second)</div>
          <div className="mt-3 rounded bg-background/60 px-2 py-1 text-xs text-foreground">Huge amount of data</div>
        </div>

        <div className="flex items-center justify-center text-edge">
          <ArrowRight className="hidden h-6 w-6 lg:block" aria-hidden />
          <ArrowDown className="h-6 w-6 lg:hidden" aria-hidden />
        </div>

        <div className="rounded-lg border border-edge/60 bg-edge/10 p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-edge">Edge AI</div>
          <div className="mt-1 text-lg font-semibold text-foreground">Extract useful information</div>
          <ol className="mt-3 space-y-1.5 font-mono text-xs text-foreground">
            {["Frame extraction · OpenCV", "Detection · YOLO", "Tracking · ByteTrack", "Plate crop · detector", "Read plate · PaddleOCR", "Build observation · Python"].map((s, i) => (
              <li key={s} className="flex items-center gap-2 rounded border border-edge/30 bg-background/40 px-2 py-1">
                <span className="text-edge">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <div className="mt-3 text-xs text-muted">Every vehicle is detected and tracked across ~25 frames per second, but reported once.</div>
        </div>

        <div className="flex items-center justify-center text-primary">
          <ArrowRight className="hidden h-6 w-6 lg:block" aria-hidden />
          <ArrowDown className="h-6 w-6 lg:hidden" aria-hidden />
        </div>

        <div className="rounded-lg border border-primary/60 bg-primary/10 p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-primary">Structured observation</div>
          <div className="mt-1 text-lg font-semibold text-foreground">Small, meaningful event</div>
          <div className="text-sm text-muted">≈ 240 vehicles × ~0.5 KB ≈ 120 KB</div>
          <ul className="mt-3 grid grid-cols-2 gap-1">
            {fields.map((f) => (
              <li key={f} className="rounded border border-primary/30 bg-background/40 px-2 py-1 font-mono text-[11px] text-foreground">
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface-2 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-muted">Data sent onward for the same 10,000 frames</span>
          <span className="font-mono text-[10px] text-warning">illustrative estimate</span>
        </div>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between font-mono text-xs"><span className="text-foreground">Streaming raw video to the cloud</span><span className="text-edge">≈ 200 MB</span></div>
            <div className="h-4 w-full rounded bg-edge/70" />
          </div>
          <div>
            <div className="mb-1 flex justify-between font-mono text-xs"><span className="text-foreground">Sending observations from the edge</span><span className="text-primary">≈ 120 KB (~1,700× smaller)</span></div>
            <div className="h-4 w-full rounded bg-surface-3">
              <div className="h-4 rounded bg-primary" style={{ width: "0.6%" , minWidth: 4 }} />
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          This is the normal intelligence pipeline: the edge extracts observations and sends structured events. Raw or selected video is not thrown
          away — it can remain available at the edge (or be uploaded selectively) when required, for example for incident review or evidence.
        </p>
      </div>
    </Modal>
  );
}
