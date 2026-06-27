import { HeroScene } from '@/components/hero/HeroScene';
import { Marquee } from '@/components/landing/Marquee';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Contracts } from '@/components/landing/Contracts';
import { CTA } from '@/components/landing/CTA';
import { Footer } from '@/components/landing/Footer';

export default function Home() {
  return (
    <main className="flex flex-col">
      <HeroScene />
      <Marquee />
      <Features />
      <HowItWorks />
      <Contracts />
      <CTA />
      <Footer />
    </main>
  );
}
