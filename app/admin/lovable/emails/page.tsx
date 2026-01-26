'use client'

// =====================================================
// PÁGINA: Logs de E-mail e Integração
// =====================================================
// Auditoria completa de todas as ações da integração Lovable
// =====================================================

import { useEffect, useState } from 'react'
import { getIntegrationLogs, type IntegrationLog } from '@/services/lovable-integration'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import {
  Mail,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Eye,
  User,
  Key,
  Send,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function LovableEmailLogsPage() {
  const { toast } = useToast()
  const [logs, setLogs] = useState<IntegrationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filtros
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Modal de detalhes
  const [selectedLog, setSelectedLog] = useState<IntegrationLog | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  // =====================================================
  // CARREGAR LOGS
  // =====================================================

  const loadLogs = async () => {
    setRefreshing(true)

    const filters: any = {}
    if (actionFilter !== 'all') filters.action = actionFilter
    if (statusFilter !== 'all') filters.status = statusFilter

    const result = await getIntegrationLogs(filters)

    if (result.success && result.logs) {
      setLogs(result.logs)
      toast(`✅ ${result.logs.length} logs carregados`)
    } else {
      toast(`❌ ${result.error || 'Erro ao carregar logs'}`, 'error')
    }

    setRefreshing(false)
    setLoading(false)
  }

  useEffect(() => {
    loadLogs()
  }, [actionFilter, statusFilter])

  // =====================================================
  // UTILITÁRIOS
  // =====================================================

  const getActionIcon = (action: string) => {
    if (action.includes('user')) return <User className="h-4 w-4" />
    if (action.includes('password')) return <Key className="h-4 w-4" />
    if (action.includes('email')) return <Mail className="h-4 w-4" />
    return <Send className="h-4 w-4" />
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      create_user: 'Criar Usuário',
      reset_password: 'Reset Senha',
      list_users: 'Listar Usuários',
      send_email: 'Enviar E-mail',
    }
    return labels[action] || action
  }

  const getStatusBadge = (status: string) => {
    if (status === 'success') {
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Sucesso
        </Badge>
      )
    }
    if (status === 'error') {
      return (
        <Badge variant="default" className="flex items-center gap-1 bg-red-100 text-red-800">
          <XCircle className="h-3 w-3" />
          Erro
        </Badge>
      )
    }
    return (
      <Badge variant="default" className="flex items-center gap-1 bg-yellow-100 text-yellow-800">
        <Clock className="h-3 w-3" />
        Pendente
      </Badge>
    )
  }

  const formatDate = (date?: string) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const openDetails = (log: IntegrationLog) => {
    setSelectedLog(log)
    setDetailsOpen(true)
  }

  // =====================================================
  // STATS
  // =====================================================

  const stats = {
    total: logs.length,
    success: logs.filter((l) => l.status === 'success').length,
    error: logs.filter((l) => l.status === 'error').length,
    pending: logs.filter((l) => l.status === 'pending').length,
  }

  // =====================================================
  // RENDER
  // =====================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando logs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="h-8 w-8" />
            Logs de E-mail e Integração
          </h1>
          <p className="text-muted-foreground mt-1">
            Auditoria completa de todas as operações da integração Lovable
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadLogs}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sucesso</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.success}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Erros</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.error}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Ação</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as ações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="create_user">Criar Usuário</SelectItem>
                  <SelectItem value="reset_password">Reset Senha</SelectItem>
                  <SelectItem value="list_users">Listar Usuários</SelectItem>
                  <SelectItem value="send_email">Enviar E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Registros de Log</CardTitle>
          <CardDescription>
            Histórico completo de todas as operações realizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>
              {logs.length === 0 ? 'Nenhum log encontrado' : `Total: ${logs.length} logs`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(log.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getActionIcon(log.action)}
                      <span className="text-sm font-medium">
                        {getActionLabel(log.action)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(log.status)}</TableCell>
                  <TableCell className="text-sm">
                    {log.recipient_email || '-'}
                  </TableCell>
                  <TableCell>
                    {log.http_status_code && (
                      <Badge variant={log.http_status_code < 400 ? 'success' : 'default'}>
                        {log.http_status_code}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDetails(log)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog: Detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Log</DialogTitle>
            <DialogDescription>
              Informações completas sobre a operação
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">ID</label>
                  <p className="text-sm font-mono">{selectedLog.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Data/Hora</label>
                  <p className="text-sm">{formatDate(selectedLog.created_at)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Ação</label>
                  <p className="text-sm">{getActionLabel(selectedLog.action)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>
                {selectedLog.recipient_email && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Destinatário
                    </label>
                    <p className="text-sm">{selectedLog.recipient_email}</p>
                  </div>
                )}
                {selectedLog.http_status_code && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Código HTTP
                    </label>
                    <p className="text-sm">{selectedLog.http_status_code}</p>
                  </div>
                )}
              </div>

              {selectedLog.error_message && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Mensagem de Erro
                  </label>
                  <pre className="mt-1 p-3 bg-red-50 text-red-800 rounded text-xs overflow-x-auto">
                    {selectedLog.error_message}
                  </pre>
                </div>
              )}

              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Detalhes</label>
                  <pre className="mt-1 p-3 bg-slate-50 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.request_payload && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Request Payload
                  </label>
                  <pre className="mt-1 p-3 bg-blue-50 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.request_payload, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.response_payload && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Response Payload
                  </label>
                  <pre className="mt-1 p-3 bg-green-50 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.response_payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
