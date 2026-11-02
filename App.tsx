import 'react-native-url-polyfill/auto'
import 'expo-sqlite/localStorage/install'

import { NavigationContainer } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'

import { AuthProvider } from './src/services/AuthProvider'
import { AppNavigator } from './src/navigation/AppNavigator'

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  )
}
