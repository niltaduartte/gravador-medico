/**
 * 🔄 GERENCIADOR DE SINCRONIZAÇÃO EM LOTES
 * 
 * OBJETIVO: Importar TODO o histórico dos gateways usando processamento
 * em lotes controlado pelo frontend (evita timeout)
 * 
 * FEATURES:
 * - Loop recursivo com paginação
 * - Progresso em tempo real
 * - Rate limiting (1 segundo entre lotes)
 * - Retry automático em caso de erro
 * - Toast de feedback
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { RefreshCw, CheckCircle, AlertCircle, CreditCard, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { revalidateAdminPages } from '@/lib/actions/revalidate'

interface SyncState {
  isRunning: boolean
  currentBatch: number
  totalImported: number
  totalCreated: number
  totalUpdated: number
  totalErrors: number
  progress: string
  error?: string
}

export function SyncManager() {
  const [mpState, setMpState] = useState<SyncState>({
    isRunning: false,
    currentBatch: 0,
    totalImported: 0,
    totalCreated: 0,
    totalUpdated: 0,
    totalErrors: 0,
    progress: 'Aguardando...'
  })

  const [appmaxState, setAppmaxState] = useState<SyncState>({
    isRunning: false,
    currentBatch: 0,
    totalImported: 0,
    totalCreated: 0,
    totalUpdated: 0,
    totalErrors: 0,
    progress: 'Aguardando...'
  })

  /**
   * 🔄 LOOP RECURSIVO - MERCADO PAGO
   */
  const syncMercadoPago = async (offset = 0, attempt = 1): Promise<void> => {
    const maxRetries = 2
    const batchNumber = Math.floor(offset / 50) + 1

    setMpState(prev => ({
      ...prev,
      isRunning: true,
      currentBatch: batchNumber,
      progress: `Processando lote ${batchNumber}... (offset: ${offset})`
    }))

    try {
      const response = await fetch(`/api/sync/mercadopago?offset=${offset}&limit=50`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao sincronizar Mercado Pago')
      }

      // Atualizar estado com resultados do lote
      setMpState(prev => ({
        ...prev,
        totalImported: prev.totalImported + data.processed,
        totalCreated: prev.totalCreated + data.created,
        totalUpdated: prev.totalUpdated + data.updated,
        totalErrors: prev.totalErrors + data.errors,
        progress: `Lote ${batchNumber} concluído! ${data.processed} vendas processadas.`
      }))

      // Se há mais páginas, aguardar 1 segundo e continuar
      if (data.has_more) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        await syncMercadoPago(data.next_offset, 1) // Reset retry counter
      } else {
        // Finalizado!
        setMpState(prev => ({
          ...prev,
          isRunning: false,
          progress: `✅ Sincronização concluída! Total: ${prev.totalImported} vendas.`
        }))

        toast.success(`Mercado Pago sincronizado!`, {
          description: `${mpState.totalCreated} criadas, ${mpState.totalUpdated} atualizadas.`
        })

        // Revalidar cache
        await revalidateAdminPages()
      }
    } catch (error: any) {
      console.error('[SYNC MP] Error:', error)

      // Tentar novamente em caso de erro
      if (attempt < maxRetries) {
        console.log(`[SYNC MP] Retry attempt ${attempt + 1}/${maxRetries}`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        await syncMercadoPago(offset, attempt + 1)
      } else {
        // Falhou após retries
        setMpState(prev => ({
          ...prev,
          isRunning: false,
          error: error.message,
          progress: `❌ Erro no lote ${batchNumber}: ${error.message}`
        }))

        toast.error('Erro ao sincronizar Mercado Pago', {
          description: error.message
        })
      }
    }
  }

  /**
   * 🔄 LOOP RECURSIVO - APPMAX
   */
  const syncAppmax = async (page = 1, attempt = 1): Promise<void> => {
    const maxRetries = 2

    setAppmaxState(prev => ({
      ...prev,
      isRunning: true,
      currentBatch: page,
      progress: `Processando página ${page}...`
    }))

    try {
      const response = await fetch(`/api/sync/appmax?page=${page}&limit=50`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao sincronizar Appmax')
      }

      // Atualizar estado com resultados do lote
      setAppmaxState(prev => ({
        ...prev,
        totalImported: prev.totalImported + data.processed,
        totalCreated: prev.totalCreated + data.created,
        totalUpdated: prev.totalUpdated + data.updated,
        totalErrors: prev.totalErrors + data.errors,
        progress: `Página ${page} concluída! ${data.processed} vendas processadas.`
      }))

      // Se há mais páginas, aguardar 1 segundo e continuar
      if (data.has_more) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        await syncAppmax(data.next_page, 1) // Reset retry counter
      } else {
        // Finalizado!
        setAppmaxState(prev => ({
          ...prev,
          isRunning: false,
          progress: `✅ Sincronização concluída! Total: ${prev.totalImported} vendas.`
        }))

        toast.success(`Appmax sincronizada!`, {
          description: `${appmaxState.totalCreated} criadas, ${appmaxState.totalUpdated} atualizadas.`
        })

        // Revalidar cache
        await revalidateAdminPages()
      }
    } catch (error: any) {
      console.error('[SYNC APPMAX] Error:', error)

      // Tentar novamente em caso de erro
      if (attempt < maxRetries) {
        console.log(`[SYNC APPMAX] Retry attempt ${attempt + 1}/${maxRetries}`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        await syncAppmax(page, attempt + 1)
      } else {
        // Falhou após retries
        setAppmaxState(prev => ({
          ...prev,
          isRunning: false,
          error: error.message,
          progress: `❌ Erro na página ${page}: ${error.message}`
        }))

        toast.error('Erro ao sincronizar Appmax', {
          description: error.message
        })
      }
    }
  }

  /**
   * Calcular progresso em %
   */
  const calculateProgress = (state: SyncState): number => {
    if (!state.isRunning) return state.totalImported > 0 ? 100 : 0
    // Estimativa: cada lote é ~2% do total (50 lotes = 100%)
    return Math.min((state.currentBatch / 50) * 100, 95)
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* CARD MERCADO PAGO */}
      <Card className="bg-gradient-to-br from-blue-950/50 to-gray-900 border-blue-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <CreditCard className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-white">Mercado Pago</CardTitle>
                <CardDescription>Sincronização em lotes (últimos 90 dias)</CardDescription>
              </div>
            </div>
            {mpState.totalImported > 0 && !mpState.isRunning && (
              <CheckCircle className="w-6 h-6 text-green-500" />
            )}
            {mpState.error && (
              <AlertCircle className="w-6 h-6 text-red-500" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progresso */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{mpState.progress}</span>
              <span className="text-blue-400 font-medium">
                {calculateProgress(mpState).toFixed(0)}%
              </span>
            </div>
            <Progress value={calculateProgress(mpState)} className="h-2" />
          </div>

          {/* Estatísticas */}
          {mpState.totalImported > 0 && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-2xl font-bold text-white">{mpState.totalImported}</div>
                <div className="text-xs text-gray-400">Processadas</div>
              </div>
              <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-400">{mpState.totalCreated}</div>
                <div className="text-xs text-gray-400">Criadas</div>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3">
                <div className="text-2xl font-bold text-yellow-400">{mpState.totalUpdated}</div>
                <div className="text-xs text-gray-400">Atualizadas</div>
              </div>
            </div>
          )}

          {/* Botão */}
          <Button
            onClick={() => syncMercadoPago(0)}
            disabled={mpState.isRunning}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {mpState.isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Iniciar Sincronização
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* CARD APPMAX */}
      <Card className="bg-gradient-to-br from-purple-950/50 to-gray-900 border-purple-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <CreditCard className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-white">Appmax</CardTitle>
                <CardDescription>Sincronização em lotes (todo histórico)</CardDescription>
              </div>
            </div>
            {appmaxState.totalImported > 0 && !appmaxState.isRunning && (
              <CheckCircle className="w-6 h-6 text-green-500" />
            )}
            {appmaxState.error && (
              <AlertCircle className="w-6 h-6 text-red-500" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progresso */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{appmaxState.progress}</span>
              <span className="text-purple-400 font-medium">
                {calculateProgress(appmaxState).toFixed(0)}%
              </span>
            </div>
            <Progress value={calculateProgress(appmaxState)} className="h-2" />
          </div>

          {/* Estatísticas */}
          {appmaxState.totalImported > 0 && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-2xl font-bold text-white">{appmaxState.totalImported}</div>
                <div className="text-xs text-gray-400">Processadas</div>
              </div>
              <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-400">{appmaxState.totalCreated}</div>
                <div className="text-xs text-gray-400">Criadas</div>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3">
                <div className="text-2xl font-bold text-yellow-400">{appmaxState.totalUpdated}</div>
                <div className="text-xs text-gray-400">Atualizadas</div>
              </div>
            </div>
          )}

          {/* Botão */}
          <Button
            onClick={() => syncAppmax(1)}
            disabled={appmaxState.isRunning}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {appmaxState.isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Iniciar Sincronização
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
