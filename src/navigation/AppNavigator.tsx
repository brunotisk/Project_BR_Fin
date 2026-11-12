import { ActivityIndicator, View } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '../services/AuthProvider'
import { LoginScreen } from '../screens/LoginScreen'
import { TabNavigator } from './TabNavigator'
import { NovaTransacaoScreen } from '../screens/NovaTransacaoScreen'
import { NovaContaScreen } from '../screens/NovaContaScreen'
import { ContasScreen } from '../screens/ContasScreen'
import { NovaCategoriaScreen } from '../screens/NovaCategoriaScreen'
import { CategoriasScreen } from '../screens/CategoriasScreen'
import { NovaMetaScreen } from '../screens/NovaMetaScreen'
import { NovoOrcamentoScreen } from '../screens/NovoOrcamentoScreen'
import { NovoCartaoScreen } from '../screens/NovoCartaoScreen'
import { ImportarFaturaScreen } from '../screens/ImportarFaturaScreen'
import { ProjecaoParcelasScreen } from '../screens/ProjecaoParcelasScreen'
import { NovoItemScreen } from '../screens/NovoItemScreen'
import { FechamentoScreen } from '../screens/FechamentoScreen'
import { CartoesControleScreen } from '../screens/CartoesControleScreen'
import { CartoesScreen } from '../screens/CartoesScreen'
import { PokerScreen } from '../screens/PokerScreen'
import { colors } from '../theme'

export type RootStackParamList = {
  Login: undefined
  Main: undefined
  NovaTransacao: undefined
  NovaConta: undefined
  Contas: undefined
  NovaCategoria: undefined
  Categorias: undefined
  NovaMeta: undefined
  NovoOrcamento: undefined
  NovoCartao: undefined
  ImportarFatura: undefined
  ProjecaoParcelas: undefined
  Fechamento: undefined
  CartoesControle: undefined
  LimitesCartoes: undefined
  Poker: undefined
  NovoItem: { tipo: 'tarefa' | 'compromisso'; data?: string; horario?: string; horarioFim?: string; agendaId?: string; mostrarNaAgenda?: boolean } | undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export function AppNavigator() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '700'
        },
        headerShadowVisible: false
      }}
    >
      {session ? (
        <>
          <Stack.Screen
            name="Main"
            component={TabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ImportarFatura"
            component={ImportarFaturaScreen}
            options={{ title: 'Subir Fatura' }}
          />
          <Stack.Screen
            name="NovoItem"
            component={NovoItemScreen}
            options={({ route }) => ({ title: route.params?.tipo === 'compromisso' ? 'Novo compromisso' : 'Nova tarefa' })}
          />
          <Stack.Screen
            name="ProjecaoParcelas"
            component={ProjecaoParcelasScreen}
            options={{ title: 'Projeção de Parcelas' }}
          />
          <Stack.Screen
            name="Fechamento"
            component={FechamentoScreen}
            options={{ title: 'Fechamento' }}
          />
          <Stack.Screen
            name="CartoesControle"
            component={CartoesControleScreen}
            options={{ title: 'Cartões' }}
          />
          <Stack.Screen
            name="LimitesCartoes"
            component={CartoesScreen}
            options={{ title: 'Limite de cartões' }}
          />
          <Stack.Screen
            name="Poker"
            component={PokerScreen}
            options={{ title: 'Poker' }}
          />
          <Stack.Screen
            name="NovoCartao"
            component={NovoCartaoScreen}
            options={{ title: 'Novo Cartão de Crédito' }}
          />
          <Stack.Screen
            name="NovaTransacao"
            component={NovaTransacaoScreen}
            options={{ title: 'Lançar Transação' }}
          />
          <Stack.Screen
            name="NovaConta"
            component={NovaContaScreen}
            options={{ title: 'Adicionar Conta' }}
          />
          <Stack.Screen
            name="Contas"
            component={ContasScreen}
            options={{ title: 'Minhas Contas' }}
          />
          <Stack.Screen
            name="NovaCategoria"
            component={NovaCategoriaScreen}
            options={{ title: 'Adicionar Categoria' }}
          />
          <Stack.Screen
            name="Categorias"
            component={CategoriasScreen}
            options={{ title: 'Categorias' }}
          />
          <Stack.Screen
            name="NovaMeta"
            component={NovaMetaScreen}
            options={{ title: 'Criar Meta' }}
          />
          <Stack.Screen
            name="NovoOrcamento"
            component={NovoOrcamentoScreen}
            options={{ title: 'Definir Orçamento' }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: 'Entrar', headerShown: false }}
        />
      )}
    </Stack.Navigator>
  )
}
