import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Audiences } from "./components/Audiences";
import { HowItWorks } from "./components/HowItWorks";
import { GetStarted } from "./components/GetStarted";
import { Footer } from "./components/Footer";

export default function Home() {
  return (
    <main className="noise">
      <Nav />
      <Hero />
      <Audiences />
      <HowItWorks />
      <GetStarted />
      <Footer />
    </main>
  );
}
