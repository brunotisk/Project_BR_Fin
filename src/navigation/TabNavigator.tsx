import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { PanResponder, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useMemo } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { HomeScreen } from '../screens/HomeScreen'
import { CartoesScreen } from '../screens/CartoesScreen'
import { ProjecaoParcelasScreen } from '../screens/ProjecaoParcelasScreen'
import { TransacoesScreen } from '../screens/TransacoesScreen'
import { CategoriasScreen } from '../screens/CategoriasScreen'
import { FechamentoScreen } from '../screens/FechamentoScreen'
import { CartoesControleScreen } from '../screens/CartoesControleScreen'
import { PokerScreen } from '../screens/PokerScreen'
import { TodoListScreen } from '../screens/TodoListScreen'
import { AgendaScreen } from '../screens/AgendaScreen'
import { ConfiguracoesScreen } from '../screens/ConfiguracoesScreen'
import { colors } from '../theme'


export type BottomTabParamList = {
  TodoTab: undefined
  AgendaTab: undefined
  FinanceiroTab: undefined
  ConfiguracoesTab: undefined
  TransacoesTab: undefined
  CartoesTab: undefined
  ProjecaoTab: undefined
  CategoriasTab: undefined
}

const Tab = createBottomTabNavigator<BottomTabParamList>()

function comSwipe(Screen: React.ComponentType<any>) {
  return function SwipeableTab(props: any) {
    const navigation = useNavigation<any>()
    const route = useRoute()
    const ordem = ['TodoTab', 'AgendaTab', 'FinanceiroTab', 'ConfiguracoesTab']
    const pan = useMemo(() => PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => gesture.y0 < 72 && Math.abs(gesture.dx) > 70 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
      onPanResponderRelease: (_event, gesture) => {
        const atual = ordem.indexOf(route.name)
        const proximo = gesture.dx < 0 ? ordem[Math.min(atual + 1, ordem.length - 1)] : ordem[Math.max(atual - 1, 0)]
        if (proximo !== route.name) navigation.navigate(proximo)
      }
    }), [navigation, route.name])
    return <View style={{ flex: 1 }} {...pan.panHandlers}><Screen {...props} /></View>
  }
}

const SwipeTodo = comSwipe(TodoListScreen)
const SwipeAgenda = comSwipe(AgendaScreen)
const SwipeFinanceiro = comSwipe(FinanceiroNavigator)
const SwipeConfiguracoes = comSwipe(ConfiguracoesScreen)

export function TabNavigator() {
  const insets = useSafeAreaInsets()
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 8)

  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        height: 54 + bottomInset,
        paddingBottom: bottomInset,
        paddingTop: 6
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }
    }}>
      <Tab.Screen name="TodoTab" component={SwipeTodo} options={{ tabBarLabel: 'Todo List', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'checkbox' : 'checkbox-outline'} size={size} color={color} /> }} />
      <Tab.Screen name="AgendaTab" component={SwipeAgenda} options={{ tabBarLabel: 'Agenda', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={color} /> }} />
      <Tab.Screen name="FinanceiroTab" component={SwipeFinanceiro} options={{ tabBarLabel: 'Financeiro', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={size} color={color} /> }} />
      <Tab.Screen name="ConfiguracoesTab" component={SwipeConfiguracoes} options={{ tabBarLabel: 'Config.', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} /> }} />
    </Tab.Navigator>
  )
}

type FinanceParamList = {
  FechamentoTab: undefined
  CartoesTab: undefined
  PokerTab: undefined
  HomeTab: undefined
  TransacoesTab: undefined
  ProjecaoTab: undefined
  CategoriasTab: undefined
  CartoesLimitesTab: undefined
}
const FinanceStack = createNativeStackNavigator<FinanceParamList>()

function FinanceiroNavigator() {
  return <FinanceStack.Navigator initialRouteName="FechamentoTab" screenOptions={{ header: ({ navigation, route }) => <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, gap: 4 }}>{([
    ['FechamentoTab', 'Fechamentos'],
    ['CartoesTab', 'Cartões'],
    ['PokerTab', 'Poker'],
    ['HomeTab', 'Resumo'],
    ['TransacoesTab', 'Transações'],
    ['ProjecaoTab', 'Projeção'],
    ['CategoriasTab', 'Categorias'],
    ['CartoesLimitesTab', 'Limites Cartões']
  ] as const).map(([name, label]) => <TouchableOpacity key={name} onPress={() => navigation.navigate(name)} style={{ paddingHorizontal: 12, paddingVertical: 13, borderBottomWidth: route.name === name ? 2 : 0, borderBottomColor: colors.primary }}><Text style={{ color: route.name === name ? colors.primary : colors.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text></TouchableOpacity>)}</ScrollView></View> }}>
    <FinanceStack.Screen name="FechamentoTab" component={FechamentoScreen} />
    <FinanceStack.Screen name="CartoesTab" component={CartoesControleScreen} />
    <FinanceStack.Screen name="PokerTab" component={PokerScreen} />
    <FinanceStack.Screen name="HomeTab" component={HomeScreen} />
    <FinanceStack.Screen name="TransacoesTab" component={TransacoesScreen} />
    <FinanceStack.Screen name="ProjecaoTab" component={ProjecaoParcelasScreen} />
    <FinanceStack.Screen name="CategoriasTab" component={CategoriasScreen} />
    <FinanceStack.Screen name="CartoesLimitesTab" component={CartoesScreen} />
  </FinanceStack.Navigator>
}
