import type { ReactNode } from "react";
import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" className="h-full">
			<head>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</head>
			<body className={`${inter.className} h-full bg-[var(--color-pale-gray)] text-[var(--color-text-primary)]`}>
				{children}
			</body>
		</html>
	);
}
