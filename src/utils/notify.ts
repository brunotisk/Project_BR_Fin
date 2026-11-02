import { Alert, Platform } from 'react-native'

/**
 * Mostra um aviso ao usuário em qualquer plataforma.
 * No Web, `Alert.alert` do React Native não faz nada, então usamos `window.alert`.
 */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title
    globalThis.alert(text)
    return
  }
  Alert.alert(title, message)
}
