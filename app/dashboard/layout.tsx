import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ToastProvider } from "@/components/ui/toast"
import { NotificationProvider } from "@/components/NotificationProvider"
import { Toaster } from "sonner"
import DockSidebar from "@/components/DockSidebar"

const inter = Inter({ subsets: ["latin"], display: "swap" })

export const metadata: Metadata = {
  title: "Gravador Médico - Recupere Seu Tempo",
  description: "O método operacional simples para ter prontuários perfeitos, sem tocar no teclado",
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} antialiased bg-white overflow-x-hidden`}>
        <NotificationProvider>
          <ToastProvider>
            <Toaster
              position="bottom-right"
              className="z-[9999]"
              toastOptions={{
                style: { zIndex: 9999 }
              }}
            />
          {/* Aurora Gradients Background */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            {/* Blue Aurora */}
            <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-blue-50 rounded-full blur-[120px]" />
            {/* Purple Aurora */}
            <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] bg-brand-50 rounded-full blur-[120px]" />
          </div>

          {/* Dock Sidebar */}
          <DockSidebar />
          
          {/* Main Content with Left Padding for Dock */}
          <div className="pl-32">
            {children}
          </div>
          </ToastProvider>
        </NotificationProvider>
      </body>
    </html>
  )
}
