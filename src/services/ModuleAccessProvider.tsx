import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthProvider'
import { notify } from '../utils/notify'

export type ModuleKey = 'todo' | 'agenda' | 'financeiro'
export type ModuleAccess = Record<ModuleKey, boolean>

const ACESSO_PADRAO: ModuleAccess = { todo: true, agenda: true, financeiro: true }
type ModuleAccessContextValue = {
  acesso: ModuleAccess
  carregado: boolean
  definirAcesso: (modulo: ModuleKey, ativo: boolean) => Promise<void>
}

const ModuleAccessContext = createContext<ModuleAccessContextValue | null>(null)

export function ModuleAccessProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const usuarioId = session?.user.id
  const [acesso, setAcesso] = useState<ModuleAccess>(ACESSO_PADRAO)
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    let ativo = true
    setAcesso(ACESSO_PADRAO)
    setCarregado(false)
    if (!usuarioId) {
      setCarregado(true)
      return () => { ativo = false }
    }
    supabase.from('preferencias_acesso_modulos')
      .select('todo_lista_ativo, agenda_ativo, financeiro_ativo')
      .eq('usuario_id', usuarioId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) console.warn('Não foi possível carregar as preferências de acesso:', error.message)
        if (data) setAcesso({ todo: data.todo_lista_ativo, agenda: data.agenda_ativo, financeiro: data.financeiro_ativo })
        setCarregado(true)
      })
    return () => { ativo = false }
  }, [usuarioId])

  const definirAcesso = useCallback(async (modulo: ModuleKey, ativo: boolean) => {
    if (!usuarioId) return
    const anterior = acesso
    const proximo = { ...anterior, [modulo]: ativo }
    setAcesso(proximo)
    const { error } = await supabase.from('preferencias_acesso_modulos').upsert({
      usuario_id: usuarioId,
      todo_lista_ativo: proximo.todo,
      agenda_ativo: proximo.agenda,
      financeiro_ativo: proximo.financeiro
    })
    if (error) {
      setAcesso(anterior)
      notify('Não foi possível salvar', 'A preferência de acesso não foi alterada. Tente novamente.')
    }
  }, [acesso, usuarioId])

  const value = useMemo(() => ({ acesso, carregado, definirAcesso }), [acesso, carregado, definirAcesso])
  return <ModuleAccessContext.Provider value={value}>{children}</ModuleAccessContext.Provider>
}

export function useModuleAccess() {
  const contexto = useContext(ModuleAccessContext)
  if (!contexto) throw new Error('useModuleAccess deve ser usado dentro de ModuleAccessProvider')
  return contexto
}
