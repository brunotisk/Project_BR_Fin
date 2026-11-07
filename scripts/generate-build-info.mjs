import { writeFileSync } from 'node:fs'

const deployedAt = new Date().toISOString()
writeFileSync(
  new URL('../src/constants/buildInfo.generated.ts', import.meta.url),
  `// Gerado automaticamente antes do build de produção.\nexport const APP_DEPLOYED_AT_ISO: string | null = '${deployedAt}'\n`
)
