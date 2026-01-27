/**
 * 🔍 BOTÃO DE RECONCILIAÇÃO MANUAL
 * 
 * OBJETIVO: Permitir que o admin dispare manualmente a verificação
 * de pedidos pendentes nas APIs dos gateways
 * 
 * USAGE: Colocar no header do dashboard ou na barra de ferramentas
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCcw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ReconciliationResult {
  processed: number
  updated: number
  details: Array<{
    orderId: string
    oldStatus: string
    newStatus: string
    gateway: string
    provisioned: boolean
  }>
}

export function ReconciliationButton() {
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<ReconciliationResult | null>(null)

  const runReconciliation = async () => {
    setIsRunning(true)
    setResult(null)

    try {
      toast.info('Iniciando reconciliação...', {
        description: 'Verificando pedidos pendentes nos gateways'
      })

      // Chamar a API de reconciliação
      // Nota: Em produção, você configuraria o CRON_SECRET no Vercel
      const response = await fetch('/api/cron/sync-transactions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'dev-secret'}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao executar reconciliação')
      }

      setResult(data)

      if (data.updated > 0) {
        toast.success(`Reconciliação concluída!`, {
          description: `${data.updated} pedidos foram corrigidos. Dashboard atualizado.`
        })
      } else {
        toast.success('Tudo certo!', {
          description: `${data.processed} pedidos verificados. Nenhuma divergência encontrada.`
        })
      }

    } catch (error: any) {
      console.error('[RECONCILIATION] Error:', error)
      toast.error('Erro na reconciliação', {
        description: error.message
      })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={runReconciliation}
        disabled={isRunning}
        variant="outline"
        className="border-yellow-500/30 bg-yellow-950/20 hover:bg-yellow-950/40 text-yellow-200"
      >
        {isRunning ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Verificando...
          </>
        ) : (
          <>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Reconciliar Pendentes
          </>
        )}
      </Button>

      {/* Resultado (mostrar por 10 segundos) */}
      {result && !isRunning && (
        <div className="flex items-center gap-2 text-sm">
          {result.updated > 0 ? (
            <>
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span className="text-yellow-200">
                {result.updated} corrigidos de {result.processed}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-green-200">
                Tudo OK ({result.processed} verificados)
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
