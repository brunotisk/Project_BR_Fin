import { useCallback, useState } from 'react'
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../services/supabase'
import { Meta, Orcamento } from '../types'
import { colors } from '../theme'
import { formatCurrency } from '../utils/formatCurrency'
import { formatarData } from '../utils/datas'
import { Button } from '../components/Button'

interface OrcamentoComCategoria extends Orcamento {
  categorias?: { nome: string; cor: string | null; icone: string | null } | null
}

export function PlanejamentoScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const [secao, setSecao] = useState<'metas' | 'orcamentos'>('metas')
  const [metas, setMetas] = useState<Meta[]>([])
  const [orcamentos, setOrcamentos] = useState<OrcamentoComCategoria[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const carregarDados = useCallback(async () => {
    try {
      const [resMetas, resOrc] = await Promise.all([
        supabase.from('metas').select('*').order('criado_em', { ascending: false }),
        supabase.from('orcamentos').select('*, categorias (nome, cor, icone)').order('ano', { ascending: false }).order('mes', { ascending: false })
      ])

      if (resMetas.data) setMetas(resMetas.data as Meta[])
      if (resOrc.data) setOrcamentos(resOrc.data as unknown as OrcamentoComCategoria[])
    } catch (err) {
      console.error('Erro ao carregar metas/orçamentos:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      carregarDados()
    }, [carregarDados])
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Planejamento</Text>
          <Text style={styles.subtitle}>Metas de economia e limites de gastos</Text>
        </View>
        <Button
          title={secao === 'metas' ? '+ Nova Meta' : '+ Novo Orçamento'}
          onPress={() => navigation.navigate(secao === 'metas' ? 'NovaMeta' : 'NovoOrcamento')}
        />
      </View>

      {/* Tabs Metas / Orçamentos */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => setSecao('metas')}
          style={[styles.tab, secao === 'metas' && styles.tabAtiva]}
        >
          <Text style={[styles.tabTexto, secao === 'metas' && styles.tabTextoAtivo]}>
            Metas ({metas.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSecao('orcamentos')}
          style={[styles.tab, secao === 'orcamentos' && styles.tabAtiva]}
        >
          <Text style={[styles.tabTexto, secao === 'orcamentos' && styles.tabTextoAtivo]}>
            Orçamentos ({orcamentos.length})
          </Text>
        </TouchableOpacity>
      </View>

      {secao === 'metas' ? (
        <FlatList
          data={metas}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregarDados() }} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="flag-outline" size={40} color={colors.muted} />
                <Text style={styles.emptyTitle}>Nenhuma meta cadastrada</Text>
                <Text style={styles.emptyText}>Crie objetivos como reserva de emergência, viagens ou conquistas!</Text>
                <View style={{ marginTop: 12 }}>
                  <Button
                    title="Definir Primeira Meta"
                    onPress={() => navigation.navigate('NovaMeta')}
                  />
                </View>
              </View>
            ) : undefined
          }
          renderItem={({ item }) => {
            const objetivo = Number(item.valor_objetivo) || 1
            const atual = Number(item.valor_atual) || 0
            const progresso = Math.min(100, Math.round((atual / objetivo) * 100))

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardNome}>{item.nome}</Text>
                  <View style={styles.badgePercent}>
                    <Text style={styles.badgePercentTexto}>{progresso}%</Text>
                  </View>
                </View>

                {/* Barra de Progresso */}
                <View style={styles.barraFundo}>
                  <View style={[styles.barraPreenchida, { width: `${progresso}%` }]} />
                </View>

                <View style={styles.cardValores}>
                  <Text style={styles.valorAtual}>
                    {formatCurrency(atual)} <Text style={styles.valorMeta}>de {formatCurrency(objetivo)}</Text>
                  </Text>
                  {item.data_limite && (
                    <Text style={styles.dataLimite}>Prazo: {formatarData(item.data_limite)}</Text>
                  )}
                </View>
              </View>
            )
          }}
        />
      ) : (
        <FlatList
          data={orcamentos}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregarDados() }} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="pie-chart-outline" size={40} color={colors.muted} />
                <Text style={styles.emptyTitle}>Nenhum orçamento cadastrado</Text>
                <Text style={styles.emptyText}>Defina limites mensais para controlar categorias de despesa.</Text>
                <View style={{ marginTop: 12 }}>
                  <Button
                    title="Definir Orçamento"
                    onPress={() => navigation.navigate('NovoOrcamento')}
                  />
                </View>
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.iconePequeno, { backgroundColor: (item.categorias?.cor || colors.expense) + '20' }]}>
                    <Ionicons
                      name={(item.categorias?.icone as any) || 'pricetag-outline'}
                      size={18}
                      color={item.categorias?.cor || colors.expense}
                    />
                  </View>
                  <Text style={styles.cardNome}>{item.categorias?.nome || 'Despesa'}</Text>
                </View>
                <Text style={styles.periodoBadge}>
                  {String(item.mes).padStart(2, '0')}/{item.ano}
                </Text>
              </View>

              <View style={styles.orcamentoDetalhe}>
                <Text style={styles.orcamentoLabel}>Teto de Gastos Definido:</Text>
                <Text style={styles.orcamentoValor}>{formatCurrency(Number(item.valor_limite))}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  tabAtiva: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary + '30'
  },
  tabTexto: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted
  },
  tabTextoAtivo: {
    color: colors.primary,
    fontWeight: '700'
  },
  list: {
    gap: 12,
    paddingBottom: 24
  },
  card: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardNome: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text
  },
  badgePercent: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgePercentTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary
  },
  barraFundo: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden'
  },
  barraPreenchida: {
    height: '100%',
    backgroundColor: colors.income,
    borderRadius: 4
  },
  cardValores: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  valorAtual: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text
  },
  valorMeta: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.muted
  },
  dataLimite: {
    fontSize: 12,
    color: colors.muted
  },
  iconePequeno: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  periodoBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  orcamentoDetalhe: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  orcamentoLabel: {
    fontSize: 13,
    color: colors.muted
  },
  orcamentoValor: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text
  },
  emptyContainer: {
    backgroundColor: colors.surface,
    padding: 30,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 20,
    gap: 8
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18
  }
})
