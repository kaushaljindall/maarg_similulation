import { SimProvider } from "@/components/maarg/sim-context";
import { SystemOverview } from "@/components/maarg/system-overview";
import { CameraCapture } from "@/components/maarg/camera-capture";
import { EdgeServer, EdgeExplainerModal } from "@/components/maarg/edge-server";
import { KafkaStream } from "@/components/maarg/kafka-stream";
import { CloudSection } from "@/components/maarg/cloud-section";
import { TrafficIntelligence } from "@/components/maarg/traffic-intelligence";
import { DynamicSignal } from "@/components/maarg/dynamic-signal";
import { PacketModal } from "@/components/maarg/packet-section";
import { MultiCamera } from "@/components/maarg/multi-camera";

export default function MaargSimulationPage() {
  return (
    <SimProvider>
      <main className="min-h-screen bg-background pb-32">
        <div className="mx-auto max-w-[1400px] px-4 py-8 md:py-12 md:px-8">
          <header className="mb-12 max-w-3xl">
            <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">MAARG Traffic Intelligence</h1>
            <p className="text-xl text-muted">An interactive simulation of the pipeline from camera video to edge AI, streaming, cloud analytics, and dynamic signal control.</p>
          </header>
          
          <SystemOverview />
        </div>
        
        <div className="mt-8 flex flex-col gap-0">
          <CameraCapture />
          <MultiCamera />
          <EdgeServer />
          <KafkaStream />
          <CloudSection />
          <TrafficIntelligence />
          <DynamicSignal />
        </div>

        {/* Modals */}
        <EdgeExplainerModal />
        <PacketModal />
      </main>
    </SimProvider>
  );
}
