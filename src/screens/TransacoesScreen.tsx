import { useCallback, useState } from 'react'
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../services/supabase'
import { Transacao } from '../types'
import { colors } from '../theme'
import { formatCurrency } from '../utils/formatCurrency'
import { formatarData } from '../utils/datas'

interface TransacaoComRelacoes extends Transacao {
  contas?: { nome: string; cor: string | null } | null
  categorias?: { nome: string; cor: string | null; icone: string | null } | null
  cartoes_credito?: { nome: string; cor: string | null } | null
}

interface CategoriaAnalise {
  id: string
  nome: string
  cor: string
  icone: string
  total: number
  percentual: number
  quantidade: number
}

interface CartaoAnalise {
  id: string
  nome: string
  cor: string
  total: number
  percentual: number
  quantidade: number
}

export function TransacoesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const [abaVisualizacao, setAbaVisualizacao] = useState<'lancamentos' | 'analise'>('lancamentos')
  const [transacoes, setTransacoes] = useState<TransacaoComRelacoes[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const carregarTransacoes = useCallback(async () => {
    try {
      const resTransacoes = await supabase
        .from('transacoes')
        .select('*, contas (nome, cor), categorias (nome, cor, icone), cartoes_credito (nome, cor)')
        .order('data', { ascending: false })
        .order('criado_em', { ascending: false })
      setTransacoes((resTransacoes.data as unknown as TransacaoComRelacoes[]) || [])
    } catch (err) {
      console.error('Erro ao carregar transações:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      carregarTransacoes()
    }, [carregarTransacoes])
  )

  const transacoesFiltradas = transacoes

  // Cálculo de despesas para a análise.
  const totalDespesas = transacoesFiltradas
    .filter((t) => t.tipo === 'despesa')
    .reduce((acc, t) => acc + Number(t.valor), 0)

  // Cálculo da Análise de Gastos por Categoria
  const despesasParaAnalise = transacoesFiltradas.filter((t) => t.tipo === 'despesa')
  const mapaCategorias = new Map<string, { nome: string; cor: string; icone: string; total: number; qtd: number }>()

  despesasParaAnalise.forEach((t) => {
    const catId = t.categoria_id || 'sem_categoria'
    const catNome = t.categorias?.nome || 'Sem Categoria'
    const catCor = t.categorias?.cor || colors.muted
    const catIcone = t.categorias?.icone || 'pricetag-outline'
    const val = Number(t.valor) || 0

    const item = mapaCategorias.get(catId) || { nome: catNome, cor: catCor, icone: catIcone, total: 0, qtd: 0 }
    item.total += val
    item.qtd += 1
    mapaCategorias.set(catId, item)
  })

  const categoriasAnalise: CategoriaAnalise[] = []
  mapaCategorias.forEach((dados, id) => {
    const percentual = totalDespesas > 0 ? Math.round((dados.total / totalDespesas) * 100) : 0
    categoriasAnalise.push({
      id,
      nome: dados.nome,
      cor: dados.cor,
      icone: dados.icone,
      total: dados.total,
      percentual,
      quantidade: dados.qtd
    })
  })
  categoriasAnalise.sort((a, b) => b.total - a.total)

  // Cálculo da Análise de Gastos por Cartão
  const mapaCartoes = new Map<string, { nome: string; cor: string; total: number; qtd: number }>()
  despesasParaAnalise.forEach((t) => {
    if (t.cartao_id) {
      const cNome = t.cartoes_credito?.nome || 'Cartão'
      const cCor = t.cartoes_credito?.cor || colors.primary
      const val = Number(t.valor) || 0
      const item = mapaCartoes.get(t.cartao_id) || { nome: cNome, cor: cCor, total: 0, qtd: 0 }
      item.total += val
      item.qtd += 1
      mapaCartoes.set(t.cartao_id, item)
    }
  })

  const cartoesAnalise: CartaoAnalise[] = []
  mapaCartoes.forEach((dados, id) => {
    const percentual = totalDespesas > 0 ? Math.round((dados.total / totalDespesas) * 100) : 0
    cartoesAnalise.push({
      id,
      nome: dados.nome,
      cor: dados.cor,
      total: dados.total,
      percentual,
      quantidade: dados.qtd
    })
  })
  cartoesAnalise.sort((a, b) => b.total - a.total)

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Transações & Análise</Text>
          <Text style={styles.subtitle}>Histórico e distribuição de gastos</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Adicionar transação" onPress={() => navigation.navigate('NovaTransacao')} style={styles.addButton}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.addButtonText}>Nova</Text>
        </TouchableOpacity>
      </View>

      {/* Alternância: Lançamentos vs Análise */}
      <View style={styles.modoTabs}>
        <TouchableOpacity
          onPress={() => setAbaVisualizacao('lancamentos')}
          style={[styles.modoTab, abaVisualizacao === 'lancamentos' && styles.modoTabAtivo]}
        >
          <Ionicons name="list" size={16} color={abaVisualizacao === 'lancamentos' ? colors.primary : colors.muted} />
          <Text style={[styles.modoTexto, abaVisualizacao === 'lancamentos' && styles.modoTextoAtivo]}>
            Lançamentos ({transacoesFiltradas.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setAbaVisualizacao('analise')}
          style={[styles.modoTab, abaVisualizacao === 'analise' && styles.modoTabAtivo]}
        >
          <Ionicons name="pie-chart" size={16} color={abaVisualizacao === 'analise' ? colors.primary : colors.muted} />
          <Text style={[styles.modoTexto, abaVisualizacao === 'analise' && styles.modoTextoAtivo]}>
            Análise de Gastos 📊
          </Text>
        </TouchableOpacity>
      </View>

      {abaVisualizacao === 'lancamentos' ? (
        <>
          {/* Lista de Transações */}
          <FlatList
            data={transacoesFiltradas}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregarTransacoes() }} />}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>Nenhuma transação encontrada</Text>
                  <Text style={styles.emptyText}>Suba sua fatura ou lance compras para visualizar aqui.</Text>
                </View>
              ) : undefined
            }
            renderItem={({ item }) => {
              const isReceita = item.tipo === 'receita'
              const iconeNome = (item.categorias?.icone as any) || (isReceita ? 'trending-up' : 'card-outline')
              const corBadge = item.categorias?.cor || (isReceita ? colors.income : colors.expense)
              const cartaoNome = item.cartoes_credito?.nome

              return (
                <View style={styles.transacaoCard}>
                  <View style={[styles.iconeBox, { backgroundColor: corBadge + '18' }]}>
                    <Ionicons name={iconeNome} size={20} color={corBadge} />
                  </View>
                  <View style={styles.transacaoInfo}>
                    <Text style={styles.descricao} numberOfLines={1}>{item.descricao}</Text>
                    <View style={styles.subInfo}>
                      <Text style={styles.detalhe}>{formatarData(item.data)}</Text>
                      {cartaoNome && (
                        <View style={styles.badgeCartao}>
                          <Text style={styles.badgeCartaoTexto}>💳 {cartaoNome}</Text>
                        </View>
                      )}
                      {item.categorias?.nome && (
                        <Text style={styles.detalhe}> • {item.categorias.nome}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.valor, { color: isReceita ? colors.income : colors.expense }]}>
                    {isReceita ? '+' : '-'} {formatCurrency(Number(item.valor))}
                  </Text>
                </View>
              )
            }}
          />
        </>
      ) : (
        /* MODO ANÁLISE DE GASTOS */
        <ScrollView contentContainerStyle={styles.analiseScroll}>
          {/* Card Resumo da Análise */}
          <View style={styles.analiseTotalCard}>
            <Text style={styles.analiseTotalLabel}>Total em Despesas Analisadas</Text>
            <Text style={styles.analiseTotalValor}>{formatCurrency(totalDespesas)}</Text>
            <Text style={styles.analiseTotalSub}>{despesasParaAnalise.length} despesas registradas</Text>
          </View>

          {/* Distribuição por Categoria */}
          <View style={styles.analiseSecao}>
            <Text style={styles.analiseSecaoTitulo}>Gastos por Categoria</Text>
            <Text style={styles.analiseSecaoSub}>Descubra onde seu dinheiro está sendo concentrado</Text>

            {categoriasAnalise.length === 0 ? (
              <Text style={styles.avisoVazio}>Nenhuma despesa para exibir na análise.</Text>
            ) : (
              <View style={styles.categoriasLista}>
                {categoriasAnalise.map((cat) => (
                  <View key={cat.id} style={styles.categoriaAnaliseItem}>
                    <View style={styles.catHeader}>
                      <View style={styles.catIdent}>
                        <View style={[styles.catIcone, { backgroundColor: cat.cor + '20' }]}>
                          <Ionicons name={cat.icone as any} size={16} color={cat.cor} />
                        </View>
                        <Text style={styles.catNome}>{cat.nome}</Text>
                        <Text style={styles.catQtd}>({cat.quantidade} compras)</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.catValor}>{formatCurrency(cat.total)}</Text>
                        <Text style={styles.catPercent}>{cat.percentual}%</Text>
                      </View>
                    </View>

                    {/* Barra de Progresso da Categoria */}
                    <View style={styles.barraFundo}>
                      <View
                        style={[
                          styles.barraPreenchida,
                          { width: `${Math.max(4, cat.percentual)}%`, backgroundColor: cat.cor }
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Distribuição por Cartão de Crédito */}
          {cartoesAnalise.length > 0 && (
            <View style={styles.analiseSecao}>
              <Text style={styles.analiseSecaoTitulo}>Gastos por Cartão de Crédito</Text>
              <View style={styles.categoriasLista}>
                {cartoesAnalise.map((cartao) => (
                  <View key={cartao.id} style={styles.categoriaAnaliseItem}>
                    <View style={styles.catHeader}>
                      <View style={styles.catIdent}>
                        <Ionicons name="card" size={18} color={cartao.cor} />
                        <Text style={styles.catNome}>{cartao.nome}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.catValor}>{formatCurrency(cartao.total)}</Text>
                        <Text style={styles.catPercent}>{cartao.percentual}% dos gastos</Text>
                      </View>
                    </View>
                    <View style={styles.barraFundo}>
                      <View
                        style={[
                          styles.barraPreenchida,
                          { width: `${Math.max(4, cartao.percentual)}%`, backgroundColor: cartao.cor }
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
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
    marginBottom: 12
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
  addButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.primary
  },
  addButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700'
  },
  modoTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10
  },
  modoTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6
  },
  modoTabAtivo: {
    backgroundColor: colors.primaryLight
  },
  modoTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted
  },
  modoTextoAtivo: {
    color: colors.primary,
    fontWeight: '700'
  },
  list: {
    gap: 8,
    paddingBottom: 24
  },
  transacaoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  iconeBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  transacaoInfo: {
    flex: 1
  },
  descricao: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  subInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2
  },
  detalhe: {
    fontSize: 12,
    color: colors.muted
  },
  badgeCartao: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4
  },
  badgeCartaoTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary
  },
  valor: {
    fontSize: 14,
    fontWeight: '700'
  },
  emptyContainer: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 10
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text
  },
  emptyText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4
  },
  analiseScroll: {
    gap: 14,
    paddingBottom: 30
  },
  analiseTotalCard: {
    backgroundColor: colors.surface,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border
  },
  analiseTotalLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500'
  },
  analiseTotalValor: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.expense,
    marginVertical: 4
  },
  analiseTotalSub: {
    fontSize: 12,
    color: colors.muted
  },
  analiseSecao: {
    backgroundColor: colors.surface,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12
  },
  analiseSecaoTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text
  },
  analiseSecaoSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: -8
  },
  categoriasLista: {
    gap: 14,
    marginTop: 4
  },
  categoriaAnaliseItem: {
    gap: 6
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  catIdent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  catIcone: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center'
  },
  catNome: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  catQtd: {
    fontSize: 11,
    color: colors.muted
  },
  catValor: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  catPercent: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600'
  },
  barraFundo: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden'
  },
  barraPreenchida: {
    height: '100%',
    borderRadius: 3
  },
  avisoVazio: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 14
  }
})
