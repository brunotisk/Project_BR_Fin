/// <reference types="expo/types" />

import { AppState } from 'react-native'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

// As variáveis EXPO_PUBLIC_* precisam ser referenciadas de forma estática
// (process.env.NOME) para o Expo conseguir embuti-las no bundle.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Variáveis do Supabase ausentes. Copie .env.example para .env, preencha ' +
      'EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY e reinicie com `npx expo start -c`.'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
})

// Evita refresh de token com o app em segundo plano: só renova quando está ativo.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})
