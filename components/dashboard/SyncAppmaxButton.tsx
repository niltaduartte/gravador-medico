'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { revalidateAdminPages } from '@/lib/actions/revalidate'

export function SyncAppmaxButton() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const days = 90 // Fixo em 90 dias

  const handleSync = async () => {
    console.log(`🚀 [SYNC] Iniciando sincronização Appmax (últimos ${days} dias)...`)
    try {
      setSyncing(true)
      setResult(null)
      
      toast.info(`Buscando vendas dos últimos ${days} dias na Appmax...`, {
        duration: 3000
      })
      console.log('📤 [SYNC] Fazendo requisição POST para /api/admin/sync-appmax')

      const response = await fetch('/api/admin/sync-appmax', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          days: days,
          force: true
        })
      })

      console.log('📥 [SYNC] Response status:', response.status, response.statusText)
      
      const data = await response.json()
      console.log('📊 [SYNC] Response data:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao sincronizar')
      }

      setResult(data.stats)
      console.log('✅ [SYNC] Sucesso! Stats:', data.stats)
      
      // 🔄 Revalidar cache IMEDIATAMENTE após sincronização
      if (data.stats.successful > 0 || data.stats.total > 0) {
        console.log('🔄 [SYNC APPMAX] Revalidando cache do admin...')
        await revalidateAdminPages()
        console.log('✅ [SYNC APPMAX] Cache revalidado - dados atualizados!')
      }
      
      if (data.stats.successful > 0) {
        toast.success(
          `🎉 ${data.stats.successful} vendas antigas importadas com sucesso! Dashboard atualizado automaticamente.`,
          { duration: 5000 }
        )
      } else if (data.stats.total === 0) {
        toast.info('Nenhuma venda encontrada na Appmax no período selecionado.')
      } else {
        toast.warning(`${data.stats.failed} vendas não puderam ser importadas. Veja os detalhes abaixo.`)
      }

    } catch (error: any) {
      console.error('❌ [SYNC] Erro na sincronização:', error)
      console.error('❌ [SYNC] Error stack:', error.stack)
      toast.error(error.message || 'Erro ao sincronizar com Appmax. Verifique se o APPMAX_TOKEN está configurado.')
    } finally {
      console.log('🏁 [SYNC] Finalizando...')
      setSyncing(false)
    }
  }

  return (
    <>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 border border-purple-500/30 rounded-xl hover:bg-purple-600/30 text-white transition-colors disabled:opacity-50"
        title="Sincronizar vendas da Appmax (últimos 90 dias)"
      >
        {syncing ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <RefreshCw className="w-4 h-4 text-purple-400" />
        )}
        <span className="text-sm font-medium">
          {syncing ? 'Sincronizando...' : 'Importar Appmax'}
        </span>
      </button>

      {/* Resultado da sincronização */}
      {result && (
        <div className="fixed bottom-4 right-4 z-[9999] bg-gray-900 border-2 border-purple-500 rounded-xl p-5 shadow-2xl min-w-[320px] max-w-[420px]">
          <div className="flex items-center gap-2 text-purple-300 mb-3">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-bold text-base text-white">Sincronização Concluída</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div className="bg-gray-800 rounded-lg p-3 text-center border border-gray-700">
              <div className="text-2xl font-bold text-white">{result.total}</div>
              <div className="text-gray-300 text-sm mt-1 font-medium">Encontrados</div>
            </div>
            <div className="bg-green-900/30 border-2 border-green-600 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{result.successful}</div>
              <div className="text-green-200 text-sm mt-1 font-medium">Importados</div>
            </div>
          </div>

          {result.failed > 0 && (
            <div className="bg-yellow-900/30 border-2 border-yellow-600 rounded-lg p-3 mb-3">
              <div className="text-sm text-yellow-200 font-bold">⚠️ {result.failed} erros encontrados</div>
            </div>
          )}

          <button
            onClick={() => setResult(null)}
            className="w-full bg-purple-900 hover:bg-purple-800 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            Fechar
          </button>
        </div>
      )}
    </>
  )
}
