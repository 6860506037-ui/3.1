// src/app/layout.js

export const metadata = {
  title: 'CineStream - Interactive Movie Ticketing Platform',
  description: 'Project 3 Multimedia Streaming & Movie Booking',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-white antialiased">
        {children}
      </body>
    </html>
  )
}
