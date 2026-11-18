/// <reference types="expo/types" />

import { AppState } from 'react-native'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import type { SupabaseClient } from '@supabase/supabase-js'
import { databaseProvider } from './databaseProvider'
import { nhostCompat } from './nhostCompat'

let client: any

if (databaseProvider === 'supabase') {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
  const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Variáveis do Supabase ausentes. Configure EXPO_PUBLIC_SUPABASE_URL e ' +
        'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY e reinicie com `npx expo start -c`.'
    )
  }

  client = createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
      storage: typeof localStorage === 'undefined' ? undefined : localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  })

  // No Supabase, refresca tokens apenas quando o app está em primeiro plano.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client.auth.startAutoRefresh()
    else client.auth.stopAutoRefresh()
  })
} else {
  client = nhostCompat
}

export const supabase = client as SupabaseClient<Database>
