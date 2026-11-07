import { APP_DEPLOYED_AT_ISO } from './buildInfo.generated'

export const APP_VERSION = '0.2.0'
export const APP_BUILD_ID = '20261102.1'
export const APP_ENV = 'Produção (PWA)'

const dataHoraDeploy = APP_DEPLOYED_AT_ISO
  ? new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(new Date(APP_DEPLOYED_AT_ISO)).replace(',', ' às ')
  : 'Disponível após o próximo deploy'

export const APP_INFO = {
  name: 'App Financeiro',
  version: APP_VERSION,
  buildDate: dataHoraDeploy,
  buildId: APP_BUILD_ID,
  env: APP_ENV
}

