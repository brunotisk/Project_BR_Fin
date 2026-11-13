import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ActivityIndicator, PanResponder, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useMemo } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { TransacoesScreen } from '../screens/TransacoesScreen'
import { CartoesControleScreen } from '../screens/CartoesControleScreen'
import { PokerScreen } from '../screens/PokerScreen'
import { TodoListScreen } from '../screens/TodoListScreen'
import { AgendaScreen } from '../screens/AgendaScreen'
import { ConfiguracoesScreen } from '../screens/ConfiguracoesScreen'
import { colors } from '../theme'
import { ModuleAccessProvider, useModuleAccess } from '../services/ModuleAccessProvider'
import type { ModuleKey } from '../services/ModuleAccessProvider'
import { notify } from '../utils/notify'


export type BottomTabParamList = {
  TodoTab: undefined
  AgendaTab: undefined
  FinanceiroTab: undefined
  ConfiguracoesTab: undefined
  TransacoesTab: undefined
}

const Tab = createBottomTabNavigator<BottomTabParamList>()

function comSwipe(Screen: React.ComponentType<any>) {
  return function SwipeableTab(props: any) {
    const navigation = useNavigation<any>()
    const route = useRoute()
    const { acesso, carregado } = useModuleAccess()
    const ordem = ['TodoTab', 'AgendaTab', 'FinanceiroTab', 'ConfiguracoesTab']
    const pan = useMemo(() => PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => gesture.y0 < 72 && Math.abs(gesture.dx) > 70 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
      onPanResponderRelease: (_event, gesture) => {
        if (!carregado) return
        const atual = ordem.indexOf(route.name)
        const direcao = gesture.dx < 0 ? 1 : -1
        let indice = atual + direcao
        while (indice >= 0 && indice < ordem.length) {
          const proximo = ordem[indice]
          const modulo: ModuleKey | null = proximo === 'TodoTab' ? 'todo' : proximo === 'AgendaTab' ? 'agenda' : proximo === 'FinanceiroTab' ? 'financeiro' : null
          if (!modulo || acesso[modulo]) { navigation.navigate(proximo); return }
          indice += direcao
        }
      }
    }), [navigation, route.name, acesso, carregado])
    return <View style={{ flex: 1 }} {...pan.panHandlers}><Screen {...props} /></View>
  }
}

const SwipeTodo = comSwipe(TodoListScreen)
const SwipeAgenda = comSwipe(AgendaScreen)
const SwipeFinanceiro = comSwipe(FinanceiroNavigator)
const SwipeConfiguracoes = comSwipe(ConfiguracoesScreen)

export function TabNavigator() {
  return <ModuleAccessProvider><TabNavigatorContent /></ModuleAccessProvider>
}

function TabNavigatorContent() {
  const insets = useSafeAreaInsets()
  const { acesso, carregado } = useModuleAccess()
  // Use only the real safe-area inset. Adding a minimum on web created an
  // extra strip below the tab bar, making its bottom edge look clipped.
  const bottomInset = insets.bottom
  if (!carregado) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>
  const primeiraTelaAtiva = acesso.todo ? 'TodoTab' : acesso.agenda ? 'AgendaTab' : acesso.financeiro ? 'FinanceiroTab' : 'ConfiguracoesTab'
  const listeners = (modulo: ModuleKey) => ({ tabPress: (event: { preventDefault: () => void }) => {
    if (acesso[modulo]) return
    event.preventDefault()
    notify('Tela desativada', 'Habilite este módulo em Configurações para acessá-lo.')
  } })

  return (
    <Tab.Navigator initialRouteName={primeiraTelaAtiva} screenOptions={{
      headerShown: false,
      tabBarShowLabel: true,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textSecondary,
      tabBarActiveBackgroundColor: '#7FA487',
      tabBarStyle: {
        position: 'absolute',
        left: 24,
        right: 24,
        bottom: bottomInset + 8,
        height: 62,
        paddingTop: 4,
        paddingBottom: 4,
        paddingHorizontal: 4,
        backgroundColor: '#DCE8DE',
        borderWidth: 1,
        borderColor: '#B5C9B8',
        borderTopWidth: 1,
        borderRadius: 32,
        elevation: 8,
        shadowColor: '#52615A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.14,
        shadowRadius: 6
      },
      tabBarItemStyle: { marginHorizontal: 2, borderRadius: 25, overflow: 'hidden' },
      tabBarLabelStyle: { fontSize: 9, fontWeight: '600' }
    }}>
      <Tab.Screen name="TodoTab" component={SwipeTodo} listeners={listeners('todo')} options={{ tabBarLabel: 'Todo List', tabBarIcon: ({ color, size, focused }) => <View style={{ width: size + 4, height: size + 4 }}><Ionicons name={focused ? 'checkbox' : 'checkbox-outline'} size={size} color={acesso.todo ? color : '#94A3B8'} />{!acesso.todo && <Ionicons name="lock-closed" size={10} color="#94A3B8" style={{ position: 'absolute', right: -4, bottom: -2 }} />}</View> }} />
      <Tab.Screen name="AgendaTab" component={SwipeAgenda} listeners={listeners('agenda')} options={{ tabBarLabel: 'Agenda', tabBarIcon: ({ color, size, focused }) => <View style={{ width: size + 4, height: size + 4 }}><Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={acesso.agenda ? color : '#94A3B8'} />{!acesso.agenda && <Ionicons name="lock-closed" size={10} color="#94A3B8" style={{ position: 'absolute', right: -4, bottom: -2 }} />}</View> }} />
      <Tab.Screen name="FinanceiroTab" component={SwipeFinanceiro} listeners={listeners('financeiro')} options={{ tabBarLabel: 'Financeiro', tabBarIcon: ({ color, size, focused }) => <View style={{ width: size + 4, height: size + 4 }}><Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={size} color={acesso.financeiro ? color : '#94A3B8'} />{!acesso.financeiro && <Ionicons name="lock-closed" size={10} color="#94A3B8" style={{ position: 'absolute', right: -4, bottom: -2 }} />}</View> }} />
      <Tab.Screen name="ConfiguracoesTab" component={SwipeConfiguracoes} options={{ tabBarLabel: 'Config.', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} /> }} />
    </Tab.Navigator>
  )
}

type FinanceParamList = {
  CartoesTab: undefined
  PokerTab: undefined
  TransacoesTab: undefined
}
const FinanceStack = createNativeStackNavigator<FinanceParamList>()

function FinanceiroNavigator() {
  return <FinanceStack.Navigator initialRouteName="PokerTab" screenOptions={{ header: ({ navigation, route }) => <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, gap: 4 }}>{([
    ['PokerTab', 'Poker'],
    ['CartoesTab', 'Cartões'],
    ['TransacoesTab', 'Transações']
  ] as const).map(([name, label]) => <TouchableOpacity key={name} onPress={() => navigation.navigate(name)} style={{ paddingHorizontal: 12, paddingVertical: 13, borderBottomWidth: route.name === name ? 2 : 0, borderBottomColor: colors.primary }}><Text style={{ color: route.name === name ? colors.primary : colors.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text></TouchableOpacity>)}</ScrollView></View> }}>
    <FinanceStack.Screen name="PokerTab" component={PokerScreen} />
    <FinanceStack.Screen name="CartoesTab" component={CartoesControleScreen} />
    <FinanceStack.Screen name="TransacoesTab" component={TransacoesScreen} />
  </FinanceStack.Navigator>
}
