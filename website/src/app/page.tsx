import { Hero } from "./components/Hero";
import { LiveProtocol } from "./components/LiveProtocol";
import { Economics } from "./components/Economics";
import { Architecture } from "./components/Architecture";
import { Footer } from "./components/Footer";
import { Nav } from "./components/Nav";

export default function Home() {
  return (
    <main className="min-h-screen grid-bg">
      <Nav />
      <Hero />
      <LiveProtocol />
      <Economics />
      <Architecture />
      <Footer />
    </main>
  );
}
