import { Hero } from "./components/Hero";
import { ThreeThings } from "./components/ThreeThings";
import { HowItWorks } from "./components/HowItWorks";
import { Economics } from "./components/Economics";
import { Comparison } from "./components/Comparison";
import { Architecture } from "./components/Architecture";
import { Footer } from "./components/Footer";
import { Nav } from "./components/Nav";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Nav />
      <Hero />
      <ThreeThings />
      <HowItWorks />
      <Economics />
      <Comparison />
      <Architecture />
      <Footer />
    </main>
  );
}
