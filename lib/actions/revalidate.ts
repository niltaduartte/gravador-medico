/**
 * 🔄 SERVER ACTIONS - REVALIDAÇÃO DE CACHE
 * 
 * Actions para forçar atualização do cache após operações manuais
 * (importação Appmax, importação MP, etc.)
 */

'use server'

import { revalidatePath } from 'next/cache'

/**
 * Invalida cache de todas as páginas do admin
 * 🎯 CHAMAR ESTA FUNÇÃO APÓS SINCRONIZAÇÃO!
 */
export async function revalidateAdminPages() {
  console.log('🔄 [REVALIDATE] Invalidando páginas do admin...')
  
  // Revalidar todas as páginas principais
  revalidatePath('/admin/dashboard', 'page')
  revalidatePath('/admin/sales', 'page')
  revalidatePath('/admin/crm', 'page')
  revalidatePath('/admin/reports', 'page')
  revalidatePath('/admin/analytics', 'page')
  
  // Revalidar layout inteiro do admin (força reload de tudo)
  revalidatePath('/admin', 'layout')
  
  // Revalidar API routes
  revalidatePath('/api/admin/dashboard')
  revalidatePath('/api/admin/sales')
  
  console.log('✅ [REVALIDATE] Cache do admin invalidado')
  
  return { success: true }
}

/**
 * Invalida cache apenas do dashboard
 */
export async function revalidateDashboard() {
  console.log('🔄 [REVALIDATE] Invalidando dashboard...')
  revalidatePath('/admin/dashboard', 'page')
  console.log('✅ [REVALIDATE] Dashboard invalidado')
  return { success: true }
}

/**
 * Invalida cache apenas da página de vendas
 */
export async function revalidateSales() {
  console.log('🔄 [REVALIDATE] Invalidando página de vendas...')
  revalidatePath('/admin/sales', 'page')
  console.log('✅ [REVALIDATE] Vendas invalidadas')
  return { success: true }
}
