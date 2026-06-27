import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MEW Blockchain — Smart Escrow for Reforestation",
  description: "A decentralized platform using Forest NFTs, NDVI Oracle data, and smart contract escrows to fund and verify reforestation projects on-chain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
