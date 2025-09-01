import Image from "next/image";

export function Hero() {
  return (
    <div className="relative w-full h-64 md:h-96">
      <Image
        src="https://picsum.photos/1200/600"
        alt="A person reviewing their finances on a laptop."
        fill
        sizes="100vw"
        className="object-cover"
        priority
        data-ai-hint="finance planning"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
    </div>
  );
}
