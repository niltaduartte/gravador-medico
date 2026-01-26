"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, FileText, Video, Settings, ShoppingBag, Sparkles, Users, Mail, ExternalLink } from "lucide-react"

export default function Sidebar() {
  const pathname = usePathname()
  
  const menuItems = [
    { icon: Home, label: "Início", href: "/dashboard" },
    { icon: FileText, label: "Meus Prompts", href: "/dashboard/prompts" },
    { icon: Video, label: "Tutoriais", href: "/dashboard/tutoriais" },
    { icon: Settings, label: "Configurações", href: "/dashboard/configuracoes" },
  ]

  const lovableMenuItems = [
    { icon: Users, label: "Usuários", href: "/admin/lovable/users" },
    { icon: Mail, label: "Logs de E-mail", href: "/admin/lovable/emails" },
  ]
  
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Voice Pen</h1>
            <p className="text-xs text-slate-500">Pro Edition</p>
          </div>
        </div>
      </div>
      
      {/* Menu Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        {/* Menu Principal */}
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Seção LOVABLE */}
        <div className="mt-6">
          <div className="px-4 mb-2">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Integração Lovable
              </h3>
            </div>
          </div>
          <ul className="space-y-2">
            {lovableMenuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? "bg-purple-50 text-purple-700 font-medium"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>
      
      {/* VIP Area - Loja de Prompts */}
      <div className="p-4 border-t border-slate-200">
        <Link
          href="/dashboard/loja"
          className="block relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 p-4 shadow-lg hover:shadow-xl transition-all hover:scale-105 group"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full -ml-8 -mb-8"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="w-5 h-5 text-white" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">VIP Access</span>
            </div>
            <h3 className="text-white font-bold text-base mb-1">Loja de Prompts</h3>
            <p className="text-amber-100 text-xs">
              Pacotes premium exclusivos para sua especialidade
            </p>
          </div>
        </Link>
      </div>
    </aside>
  )
}
