import { skSK } from "@clerk/localizations/sk-SK";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Opravovňa",
  description: "Spoločné opravovanie PDF riešení.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sk">
      <body>
        <ClerkProvider
          localization={skSK}
          appearance={{
            theme: dark,
            variables: {
              colorPrimary: "oklch(76% .15 225)",
              colorPrimaryForeground: "oklch(19% .025 235)",
              colorBackground: "oklch(27% .018 245)",
              colorForeground: "oklch(94% .008 245)",
              colorMutedForeground: "oklch(76% .018 245)",
              colorInput: "oklch(33% .018 245)",
              colorInputForeground: "oklch(94% .008 245)",
              fontFamily: "Ubuntu, system-ui, sans-serif",
              borderRadius: "0.5rem",
            },
            elements: {
              modalBackdrop: { backgroundColor: "oklch(10% .015 245 / .8)" },
              cardBox: {
                border: "1px solid oklch(43% .02 245)",
                boxShadow: "0 18px 80px oklch(8% .01 245 / .6)",
              },
              card: { backgroundColor: "oklch(27% .018 245)" },
              footer: { background: "oklch(24% .018 245)" },
              formButtonPrimary: { minHeight: "40px" },
              formFieldInput: { minHeight: "40px" },
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
