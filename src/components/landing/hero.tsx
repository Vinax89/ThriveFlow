import { SmoothImage } from "@/components/perf-kit";

export function Hero() {
  return (
    <div className="relative w-full h-64 md:h-96">
      <SmoothImage
        src="https://picsum.photos/1200/600"
        alt="A person reviewing their finances on a laptop."
        fill
        className="object-cover"
        aboveFold
        data-ai-hint="finance planning"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
    </div>
  );
}
