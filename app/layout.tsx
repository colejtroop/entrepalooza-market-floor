import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Floor",
  description: "A live entrepreneurship market simulation.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<aside className="join-placard" aria-label="Join Market Floor"><img src="/join-qr.svg" alt="QR code to join Market Floor"/><div><small>PLAY ON YOUR PHONE</small><strong>SCAN TO JOIN</strong><span>market-floor-lehigh<br/>.chic-jam-6793.chatgpt.site</span></div></aside></body></html>;
}
