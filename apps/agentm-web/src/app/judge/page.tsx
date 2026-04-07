"use client";

import { JudgeDashboard } from "@/components/settlement/JudgeDashboard";
import { useDaemonConnection } from "@/lib/connection/useDaemonConnection";

const c = {
  bg: "#F3F3F8",
  surface: "#FFFFFF",
  ink: "#16161A",
};

const styles = {
  container: {
    minHeight: "100vh",
    background: c.bg,
    padding: "24px",
  },
  header: {
    maxWidth: "800px",
    margin: "0 auto 24px",
    padding: "24px",
    background: c.surface,
    borderRadius: "16px",
    border: `1.5px solid ${c.ink}`,
  },
  title: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: "24px",
    fontWeight: 700,
    margin: 0,
    color: c.ink,
  },
  subtitle: {
    fontSize: "14px",
    color: c.ink,
    opacity: 0.6,
    marginTop: "4px",
  },
  content: {
    maxWidth: "800px",
    margin: "0 auto",
  },
};

export default function JudgePage() {
  const { walletAddress } = useDaemonConnection();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Judge Tasks</h1>
        <p style={styles.subtitle}>
          Review submissions and settle tasks with on-chain payment.
        </p>
      </div>
      <div style={styles.content}>
        <JudgeDashboard walletAddress={walletAddress} />
      </div>
    </div>
  );
}
