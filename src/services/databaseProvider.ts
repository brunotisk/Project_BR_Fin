export type DatabaseProvider = 'supabase' | 'nhost'

const configuredProvider = process.env.EXPO_PUBLIC_DATABASE_PROVIDER?.trim().toLowerCase() || 'supabase'

if (configuredProvider !== 'supabase' && configuredProvider !== 'nhost') {
  throw new Error(
    `EXPO_PUBLIC_DATABASE_PROVIDER inválido: "${configuredProvider}". ` +
      'Use "supabase" ou "nhost".'
  )
}

export const databaseProvider = configuredProvider as DatabaseProvider
