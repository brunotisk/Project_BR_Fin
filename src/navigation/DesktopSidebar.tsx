import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { colors } from '../theme'
import type { ModuleAccess, ModuleKey } from '../services/ModuleAccessProvider'
import { notify } from '../utils/notify'

type Icone = keyof typeof Ionicons.glyphMap

const MODULOS: { rota: string; rotulo: string; icone: Icone; iconeAtivo: Icone; modulo: ModuleKey | null }[] = [
  { rota: 'TodoTab', rotulo: 'Todo List', icone: 'checkbox-outline', iconeAtivo: 'checkbox', modulo: 'todo' },
  { rota: 'AgendaTab', rotulo: 'Agenda', icone: 'calendar-outline', iconeAtivo: 'calendar', modulo: 'agenda' },
  { rota: 'FinanceiroTab', rotulo: 'Financeiro', icone: 'wallet-outline', iconeAtivo: 'wallet', modulo: 'financeiro' }
]

export const SUBABAS_FINANCEIRO: { rota: string; rotulo: string; icone: Icone }[] = [
  { rota: 'PokerTab', rotulo: 'Poker', icone: 'diamond-outline' },
  { rota: 'CartoesTab', rotulo: 'Cartões', icone: 'card-outline' },
  { rota: 'TransacoesTab', rotulo: 'Transações', icone: 'swap-vertical-outline' },
  { rota: 'PlanejamentoTab', rotulo: 'Planejamento', icone: 'grid-outline' }
]

/** Barra lateral usada no lugar da barra inferior na visão de computador. */
export function DesktopSidebar({ state, navigation, acesso }: BottomTabBarProps & { acesso: ModuleAccess }) {
  const rotaAtiva = state.routes[state.index]?.name
  const rotaFinanceiro = state.routes.find((r) => r.name === 'FinanceiroTab')
  const estadoFinanceiro = rotaFinanceiro?.state
  const subAtiva = estadoFinanceiro?.routes?.[estadoFinanceiro.index ?? 0]?.name ?? 'PokerTab'

  const abrir = (rota: string, modulo: ModuleKey | null, params?: object) => {
    if (modulo && !acesso[modulo]) {
      notify('Tela desativada', 'Habilite este módulo em Configurações para acessá-lo.')
      return
    }
    ;(navigation as any).navigate(rota, params)
  }

  return (
    <View style={styles.sidebar}>
      <View style={styles.marca}>
        <Image source={require('../../assets/plenna/icon-192.png')} style={styles.logo} resizeMode="contain" />
        <View>
          <Text style={styles.marcaNome}>Plenna</Text>
          <Text style={styles.marcaSub}>Finanças · Agenda · Tarefas</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 2 }}>
        {MODULOS.map((item) => {
          const ativo = rotaAtiva === item.rota
          const bloqueado = item.modulo ? !acesso[item.modulo] : false
          return (
            <View key={item.rota}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
                onPress={() => abrir(item.rota, item.modulo, item.rota === 'FinanceiroTab' ? { screen: subAtiva } : undefined)}
                style={[styles.item, ativo && styles.itemAtivo]}
              >
                <Ionicons name={ativo ? item.iconeAtivo : item.icone} size={19} color={bloqueado ? '#94A3B8' : ativo ? colors.primary : colors.textSecondary} />
                <Text style={[styles.itemTexto, ativo && styles.itemTextoAtivo, bloqueado && { color: '#94A3B8' }]}>{item.rotulo}</Text>
                {bloqueado && <Ionicons name="lock-closed" size={12} color="#94A3B8" />}
              </TouchableOpacity>
              {item.rota === 'FinanceiroTab' && !bloqueado && (
                <View style={styles.subLista}>
                  {SUBABAS_FINANCEIRO.map((sub) => {
                    const subSelecionada = ativo && subAtiva === sub.rota
                    return (
                      <TouchableOpacity key={sub.rota} onPress={() => abrir('FinanceiroTab', 'financeiro', { screen: sub.rota })} style={[styles.subItem, subSelecionada && styles.subItemAtivo]}>
                        <Ionicons name={sub.icone} size={15} color={subSelecionada ? colors.primary : colors.muted} />
                        <Text style={[styles.subTexto, subSelecionada && styles.itemTextoAtivo]}>{sub.rotulo}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>

      <TouchableOpacity onPress={() => abrir('ConfiguracoesTab', null)} style={[styles.item, rotaAtiva === 'ConfiguracoesTab' && styles.itemAtivo]}>
        <Ionicons name={rotaAtiva === 'ConfiguracoesTab' ? 'settings' : 'settings-outline'} size={19} color={rotaAtiva === 'ConfiguracoesTab' ? colors.primary : colors.textSecondary} />
        <Text style={[styles.itemTexto, rotaAtiva === 'ConfiguracoesTab' && styles.itemTextoAtivo]}>Configurações</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  sidebar: { width: 236, backgroundColor: '#DCE8DE', borderRightWidth: 1, borderRightColor: '#B5C9B8', paddingHorizontal: 12, paddingVertical: 18, gap: 12 },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, marginBottom: 10 },
  logo: { width: 38, height: 38, borderRadius: 10 },
  marcaNome: { fontSize: 18, fontWeight: '800', color: colors.primary },
  marcaSub: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  itemAtivo: { backgroundColor: '#FFFFFF' },
  itemTexto: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  itemTextoAtivo: { color: colors.primary, fontWeight: '800' },
  subLista: { marginLeft: 22, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: '#B5C9B8', marginTop: 2, marginBottom: 4, gap: 1 },
  subItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  subItemAtivo: { backgroundColor: '#FFFFFFAA' },
  subTexto: { fontSize: 13, fontWeight: '600', color: colors.textSecondary }
})
