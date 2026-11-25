import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useWindowDimensions } from 'react-native'

/** Preferência escolhida pelo usuário em Configurações. */
export type PreferenciaLayout = 'auto' | 'mobile' | 'desktop'
/** Visão efetivamente aplicada na tela. */
export type ModoLayout = 'mobile' | 'desktop'

/** A partir desta largura (px) o modo automático usa a visão de computador. */
export const LARGURA_MINIMA_DESKTOP = 1024

const CHAVE = '@fin_layout_preferencia'

function lerPreferencia(): PreferenciaLayout {
  try {
    const valor = typeof localStorage !== 'undefined' ? localStorage.getItem(CHAVE) : null
    if (valor === 'mobile' || valor === 'desktop' || valor === 'auto') return valor
  } catch { /* sem armazenamento local disponível */ }
  return 'auto'
}

type LayoutModeContextValue = {
  preferencia: PreferenciaLayout
  modo: ModoLayout
  largura: number
  definirPreferencia: (preferencia: PreferenciaLayout) => void
}

const LayoutModeContext = createContext<LayoutModeContextValue | null>(null)

export function LayoutModeProvider({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions()
  const [preferencia, setPreferencia] = useState<PreferenciaLayout>(lerPreferencia)

  const definirPreferencia = useCallback((nova: PreferenciaLayout) => {
    setPreferencia(nova)
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(CHAVE, nova) } catch { /* ignora */ }
  }, [])

  const modo: ModoLayout = preferencia === 'auto' ? (width >= LARGURA_MINIMA_DESKTOP ? 'desktop' : 'mobile') : preferencia
  const valor = useMemo(() => ({ preferencia, modo, largura: width, definirPreferencia }), [preferencia, modo, width, definirPreferencia])
  return <LayoutModeContext.Provider value={valor}>{children}</LayoutModeContext.Provider>
}

export function useLayoutMode() {
  const ctx = useContext(LayoutModeContext)
  if (!ctx) throw new Error('useLayoutMode precisa estar dentro de LayoutModeProvider.')
  return ctx
}
