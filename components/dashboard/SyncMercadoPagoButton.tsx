'use client'

import { useState } from 'react'
import { RefreshCw, CreditCard } from 'lucide-react'
import Image from 'next/image'
import { revalidateAdminPages } from '@/lib/actions/revalidate'

interface SyncResult {
  total: number
  created: number
  updated: number
  skipped: number
  errors: number
}

export function SyncMercadoPagoButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    try {
      setLoading(true)
      setError(null)
      setResult(null)

      const response = await fetch('/api/admin/sync-mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ days: 30 })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao sincronizar')
      }

      setResult(data.results)
      
      // 🔄 Revalidar todas as páginas do admin para atualizar métricas
      console.log('🔄 [SYNC MP] Revalidando cache do admin...')
      await revalidateAdminPages()
      console.log('✅ [SYNC MP] Cache revalidado')
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-xl hover:bg-blue-600/30 text-white transition-colors disabled:opacity-50"
        title="Sincronizar vendas do Mercado Pago"
      >
        {loading ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <CreditCard className="w-4 h-4 text-blue-400" />
        )}
        <span className="text-sm font-medium">
          {loading ? 'Sincronizando...' : 'Importar Mercado Pago'}
        </span>
      </button>

      {/* Toast de resultado */}
      {result && (
        <div className="fixed bottom-4 right-4 z-[9999] bg-gray-900 border-2 border-blue-500 rounded-xl p-5 shadow-2xl min-w-[280px] max-w-[400px] backdrop-blur-sm">
          <div className="text-base text-white font-bold mb-3 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-400" />
            Sincronização MP Concluída
          </div>
          <div className="space-y-2 text-sm text-gray-200">
            <p className="font-semibold">Total encontrado: <span className="text-blue-400">{result.total}</span></p>
            <p className="text-green-400 font-medium">✅ Criados: {result.created}</p>
            <p className="text-yellow-400 font-medium">🔄 Atualizados: {result.updated}</p>
            <p className="text-gray-300 font-medium">⏭️ Ignorados: {result.skipped}</p>
            {result.errors > 0 && (
              <p className="text-red-400 font-medium">❌ Erros: {result.errors}</p>
            )}
          </div>
          <button
            onClick={() => setResult(null)}
            className="mt-3 w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Toast de erro */}
      {error && (
        <div className="fixed bottom-4 right-4 z-[9999] bg-red-950 border-2 border-red-500 rounded-xl p-5 shadow-2xl min-w-[280px] max-w-[400px]">
          <div className="text-base text-red-100 font-bold mb-2 flex items-center gap-2">
            <span className="text-2xl">❌</span>
            Erro na Sincronização
          </div>
          <p className="text-sm text-red-200 mb-3">{error}</p>
          <button
            onClick={() => setError('')}
            className="w-full bg-red-900 hover:bg-red-800 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  )
}
