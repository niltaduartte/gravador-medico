'use client'

// =====================================================
// PÁGINA: Usuários Lovable
// =====================================================
// Gerenciamento completo de usuários do sistema externo
// =====================================================

import { useEffect, useState } from 'react'
import {
  listLovableUsers,
  createLovableUser,
  resetLovableUserPassword,
  generateSecurePassword,
  type LovableUser,
} from '@/services/lovable-integration'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useToast } from '@/components/ui/toast'
import { 
  User, 
  UserPlus, 
  Key, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Copy,
  Mail,
  Calendar,
  Shield
} from 'lucide-react'

export default function LovableUsersPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<LovableUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Modal de criar usuário
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newUserForm, setNewUserForm] = useState({
    full_name: '',
    email: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)

  // Modal de resetar senha
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [selectedUser, setSelectedUser] = useState<LovableUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)

  // =====================================================
  // CARREGAR USUÁRIOS
  // =====================================================

  const loadUsers = async () => {
    setRefreshing(true)
    const result = await listLovableUsers()
    
    if (result.success && result.users) {
      setUsers(result.users)
      toast(`✅ ${result.users.length} usuários carregados`)
    } else {
      toast(`❌ ${result.error || 'Erro ao carregar'}`, 'error')
    }
    
    setRefreshing(false)
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // =====================================================
  // CRIAR USUÁRIO
  // =====================================================

  const handleCreateUser = async () => {
    if (!newUserForm.full_name || !newUserForm.email || !newUserForm.password) {
      toast('⚠️ Preencha todos os campos', 'error')
      return
    }

    setCreating(true)

    const result = await createLovableUser(newUserForm)

    if (result.success) {
      toast(`✅ Usuário ${newUserForm.email} criado com sucesso`)
      setCreateDialogOpen(false)
      setNewUserForm({ full_name: '', email: '', password: '' })
      loadUsers() // Recarregar lista
    } else {
      toast(`❌ ${result.error || 'Erro ao criar'}`, 'error')
    }

    setCreating(false)
  }

  // =====================================================
  // RESETAR SENHA
  // =====================================================

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) {
      toast('⚠️ Informe a nova senha', 'error')
      return
    }

    setResetting(true)

    const result = await resetLovableUserPassword({
      userId: selectedUser.id,
      newPassword,
    })

    if (result.success) {
      toast(`✅ Senha de ${selectedUser.email} foi alterada`)
      setResetDialogOpen(false)
      setNewPassword('')
      setSelectedUser(null)
    } else {
      toast(`❌ ${result.error || 'Erro ao resetar'}`, 'error')
    }

    setResetting(false)
  }

  // =====================================================
  // UTILITÁRIOS
  // =====================================================

  const handleGeneratePassword = (target: 'create' | 'reset') => {
    const password = generateSecurePassword(12)
    
    if (target === 'create') {
      setNewUserForm({ ...newUserForm, password })
      setShowPassword(true)
    } else {
      setNewPassword(password)
      setShowNewPassword(true)
    }

    toast('🎲 Senha forte gerada automaticamente')
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast(`📋 ${label} copiado`)
  }

  const formatDate = (date?: string) => {
    if (!date) return 'Nunca'
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // =====================================================
  // RENDER
  // =====================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando usuários...</p>
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
            <User className="h-8 w-8" />
            Usuários Lovable
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os usuários do sistema externo
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsers}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">E-mails Confirmados</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.email_confirmed_at).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'admin').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
          <CardDescription>
            Todos os usuários cadastrados no sistema Lovable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>
              {users.length === 0 ? 'Nenhum usuário encontrado' : `Total: ${users.length} usuários`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Último Login</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{user.email}</span>
                      {user.email_confirmed_at && (
                        <Badge variant="success" className="text-xs">
                          ✓ Confirmado
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'premium' : 'default'}>
                      {user.role || 'user'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(user.last_sign_in_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user)
                        setResetDialogOpen(true)
                      }}
                    >
                      <Key className="h-4 w-4 mr-2" />
                      Alterar Senha
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog: Criar Usuário */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo usuário no Lovable
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome Completo</Label>
              <Input
                id="full_name"
                placeholder="João da Silva"
                value={newUserForm.full_name}
                onChange={(e) =>
                  setNewUserForm({ ...newUserForm, full_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="joao@exemplo.com"
                value={newUserForm.email}
                onChange={(e) =>
                  setNewUserForm({ ...newUserForm, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres"
                    value={newUserForm.password}
                    onChange={(e) =>
                      setNewUserForm({ ...newUserForm, password: e.target.value })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleGeneratePassword('create')}
                >
                  🎲 Gerar
                </Button>
                {newUserForm.password && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(newUserForm.password, 'Senha')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Criar Usuário
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Resetar Senha */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para <strong>{selectedUser?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">Nova Senha</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="new_password"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleGeneratePassword('reset')}
                >
                  🎲 Gerar
                </Button>
                {newPassword && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(newPassword, 'Nova senha')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
              disabled={resetting}
            >
              Cancelar
            </Button>
            <Button onClick={handleResetPassword} disabled={resetting}>
              {resetting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Alterando...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Alterar Senha
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
