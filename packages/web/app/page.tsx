import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { SettlementSection } from "@/components/landing/settlement-section";
import { FeesSection } from "@/components/landing/fees-section";
import { IntegrationsSection } from "@/components/landing/integrations-section";
import { SecuritySection } from "@/components/landing/security-section";
import { LeaderboardTeaserSection } from "@/components/landing/leaderboard-teaser-section";
import { CtaSection } from "@/components/landing/cta-section";
import { FooterSection } from "@/components/landing/footer-section";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <SettlementSection />
      <IntegrationsSection />
      <SecuritySection />
      <LeaderboardTeaserSection />
      <FeesSection />
      <CtaSection />
      <FooterSection />
    </main>
  );
}
