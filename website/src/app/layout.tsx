import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gradience Protocol",
  description:
    "A Peer-to-Peer Capability Settlement Protocol for the AI Agent Economy",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Suppress wallet extension errors before React loads */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var origErr = window.onerror;
                window.onerror = function(msg) {
                  if (typeof msg === 'string' && (msg.indexOf('MetaMask') !== -1 || msg.indexOf('ethereum') !== -1 || msg.indexOf('wallet') !== -1)) {
                    return true;
                  }
                  return origErr ? origErr.apply(this, arguments) : false;
                };
                window.addEventListener('unhandledrejection', function(e) {
                  var reason = e.reason ? String(e.reason) : '';
                  if (reason.indexOf('MetaMask') !== -1 || reason.indexOf('ethereum') !== -1) {
                    e.preventDefault();
                  }
                });
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
