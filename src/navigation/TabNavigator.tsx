import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { TransacoesScreen } from '../screens/TransacoesScreen'
import { PlanejamentoFinanceiroScreen } from '../screens/PlanejamentoFinanceiroScreen'
import { CartoesControleScreen } from '../screens/CartoesControleScreen'
import { PokerScreen } from '../screens/PokerScreen'
import { TodoListScreen } from '../screens/TodoListScreen'
import { AgendaScreen } from '../screens/AgendaScreen'
import { ConfiguracoesScreen } from '../screens/ConfiguracoesScreen'
import { colors } from '../theme'
import { ModuleAccessProvider, useModuleAccess } from '../services/ModuleAccessProvider'
import type { ModuleKey } from '../services/ModuleAccessProvider'
import { notify } from '../utils/notify'
import { useLayoutMode } from '../services/LayoutModeProvider'
import { DesktopSidebar } from './DesktopSidebar'


export type BottomTabParamList = {
  TodoTab: undefined
  AgendaTab: undefined
  FinanceiroTab: undefined
  ConfiguracoesTab: undefined
  TransacoesTab: undefined
}

const Tab = createBottomTabNavigator<BottomTabParamList>()

function comSwipe(Screen: React.ComponentType<any>, larguraMaximaDesktop = 1100) {
  return function SwipeableTab(props: any) {
    const { modo } = useLayoutMode()
    if (modo === 'desktop') {
      // No computador não há gesto de deslizar; o conteúdo fica centralizado com largura máxima.
      return <View style={{ flex: 1, backgroundColor: colors.background }}><View style={{ flex: 1, width: '100%', maxWidth: larguraMaximaDesktop, alignSelf: 'center' }}><Screen {...props} /></View></View>
    }
    // Troca de aba por swipe desativada: navegação só pela barra de abas.
    return <View style={{ flex: 1 }}><Screen {...props} /></View>
  }
}

const SwipeTodo = comSwipe(TodoListScreen)
const SwipeAgenda = comSwipe(AgendaScreen)
const SwipeFinanceiro = comSwipe(FinanceiroNavigator, 1600)
const SwipeConfiguracoes = comSwipe(ConfiguracoesScreen, 960)

export function TabNavigator() {
  return <ModuleAccessProvider><TabNavigatorContent /></ModuleAccessProvider>
}

function TabNavigatorContent() {
  const insets = useSafeAreaInsets()
  const { acesso, carregado } = useModuleAccess()
  const { modo } = useLayoutMode()
  const desktop = modo === 'desktop'
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
    <Tab.Navigator initialRouteName={primeiraTelaAtiva} tabBar={desktop ? (props) => <DesktopSidebar {...props} acesso={acesso} /> : undefined} screenOptions={desktop ? { headerShown: false, tabBarPosition: 'left' } : {
      headerShown: false,
      tabBarPosition: 'bottom',
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
      <Tab.Screen name="FinanceiroTab" component={SwipeFinanceiro} listeners={({ navigation }) => ({
        tabPress: (event) => {
          if (!acesso.financeiro) {
            event.preventDefault()
            notify('Tela desativada', 'Habilite este módulo em Configurações para acessá-lo.')
            return
          }
          ;(navigation as any).navigate('FinanceiroTab', { screen: 'PokerTab' })
        }
      })} options={{ tabBarLabel: 'Financeiro', tabBarIcon: ({ color, size, focused }) => <View style={{ width: size + 4, height: size + 4 }}><Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={size} color={acesso.financeiro ? color : '#94A3B8'} />{!acesso.financeiro && <Ionicons name="lock-closed" size={10} color="#94A3B8" style={{ position: 'absolute', right: -4, bottom: -2 }} />}</View> }} />
      <Tab.Screen name="ConfiguracoesTab" component={SwipeConfiguracoes} options={{ tabBarLabel: 'Config.', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} /> }} />
    </Tab.Navigator>
  )
}

type FinanceParamList = {
  CartoesTab: undefined
  PokerTab: undefined
  TransacoesTab: undefined
  PlanejamentoTab: undefined
}
const FinanceStack = createNativeStackNavigator<FinanceParamList>()

function FinanceiroNavigator() {
  // No computador as subabas ficam na barra lateral, então o cabeçalho com abas some.
  const { modo } = useLayoutMode()
  return <FinanceStack.Navigator initialRouteName="PokerTab" screenOptions={{ headerShown: modo !== 'desktop', header: ({ navigation, route }) => <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}><View style={{ flexDirection: 'row', paddingHorizontal: 6 }}>{([
    ['PokerTab', 'Poker'],
    ['CartoesTab', 'Cartões'],
    ['TransacoesTab', 'Transações'],
    ['PlanejamentoTab', 'Planejamento']
  ] as const).map(([name, label]) => <TouchableOpacity key={name} onPress={() => navigation.navigate(name)} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 2, paddingVertical: 13, borderBottomWidth: route.name === name ? 2 : 0, borderBottomColor: colors.primary }}><Text numberOfLines={1} style={{ color: route.name === name ? colors.primary : colors.muted, fontSize: 11.5, fontWeight: '700' }}>{label}</Text></TouchableOpacity>)}</View></View> }}>
    <FinanceStack.Screen name="PokerTab" component={PokerScreen} />
    <FinanceStack.Screen name="CartoesTab" component={CartoesControleScreen} />
    <FinanceStack.Screen name="TransacoesTab" component={TransacoesScreen} />
    <FinanceStack.Screen name="PlanejamentoTab" component={PlanejamentoFinanceiroScreen} />
  </FinanceStack.Navigator>
}
