import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

/** Önizleme görsellerinin tam adresi için. Vercel'de üretim alan adı kendiliğinden kullanılır. */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Saracoğlu Koltuktan Görünüm",
  description: "Şükrü Saracoğlu Stadyumu'nda bir koltuk seç, sahayı oradan nasıl göreceğini 3B olarak gör. Resmi olmayan bir taraftar projesi.",
};

export const viewport: Viewport = {
  themeColor: "#0b1f4b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
