export const metadata = {
  title: 'Gradience OWS - Agent Identity with Reputation',
  description: 'OWS Hackathon Miami 2026',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
