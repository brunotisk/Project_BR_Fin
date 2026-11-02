import { useCallback, useState } from 'react'
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../services/supabase'
import { CartaoCredito, Parcela } from '../types'
import { colors } from '../theme'
import { formatCurrency } from '../utils/formatCurrency'
import { formatarData } from '../utils/datas'
import { Button } from '../components/Button'

interface ParcelaComTransacao extends Parcela {
  transacoes?: {
    descricao: string
    valor: number
    cartao_id: string | null
    categoria_id: string | null
    categorias?: { nome: string; cor: string | null; icone: string | null } | null
    cartoes_credito?: { nome: string; cor: string | null } | null
  } | null
}

interface GrupoMesProjetado {
  chave: string // "2026-11"
  mesNome: string // "Novembro/2026"
  total: number
  parcelas: ParcelaComTransacao[]
}

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export function ProjecaoParcelasScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const [parcelas, setParcelas] = useState<ParcelaComTransacao[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [cartaoFiltro, setCartaoFiltro] = useState<string>('todos')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null)

  const carregarParcelas = useCallback(async () => {
    try {
      const hoje = new Date().toISOString().split('T')[0]
      const [resParcelas, resCartoes] = await Promise.all([
        supabase
          .from('parcelas')
          .select('*, transacoes (descricao, valor, cartao_id, categoria_id, categorias (nome, cor, icone), cartoes_credito (nome, cor))')
          .gte('data_vencimento', hoje)
          .order('data_vencimento', { ascending: true }),
        supabase.from('cartoes_credito').select('*').order('nome')
      ])

      if (resCartoes.data) setCartoes(resCartoes.data as CartaoCredito[])

      const lista = (resParcelas.data as unknown as ParcelaComTransacao[]) || []
      setParcelas(lista)

      if (lista.length > 0 && !mesSelecionado) {
        setMesSelecionado(lista[0].data_vencimento.substring(0, 7))
      }
    } catch (err) {
      console.error('Erro ao carregar projeção de parcelas:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [mesSelecionado])

  useFocusEffect(
    useCallback(() => {
      carregarParcelas()
    }, [carregarParcelas])
  )

  // Filtra por cartão se selecionado
  const parcelasFiltradas = parcelas.filter((p) => {
    if (cartaoFiltro === 'todos') return true
    return p.transacoes?.cartao_id === cartaoFiltro
  })

  // Agrupa parcelas por mês (ex: "2026-11")
  const mapaMeses = new Map<string, ParcelaComTransacao[]>()
  parcelasFiltradas.forEach((p) => {
    const chave = p.data_vencimento.substring(0, 7)
    const grupo = mapaMeses.get(chave) || []
    grupo.push(p)
    mapaMeses.set(chave, grupo)
  })

  const gruposPorMes: GrupoMesProjetado[] = []
  mapaMeses.forEach((itens, chave) => {
    const [anoStr, mesStr] = chave.split('-')
    const mesNum = parseInt(mesStr, 10)
    const mesNome = `${NOMES_MESES[mesNum - 1]} / ${anoStr}`
    const total = itens.reduce((acc, i) => acc + Number(i.valor), 0)

    gruposPorMes.push({ chave, mesNome, total, parcelas: itens })
  })

  gruposPorMes.sort((a, b) => a.chave.localeCompare(b.chave))

  const grupoAtivo = gruposPorMes.find((g) => g.chave === mesSelecionado) || gruposPorMes[0]
  const totalComprometido = parcelasFiltradas.reduce((acc, p) => acc + Number(p.valor), 0)
  const maxMesTotal = Math.max(...gruposPorMes.map((g) => g.total), 1)

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Fluxo de Pagamento</Text>
          <Text style={styles.subtitle}>Projeção das faturas e parcelas futuras</Text>
        </View>
        <Button
          title="+ Subir Fatura"
          onPress={() => navigation.navigate('ImportarFatura')}
        />
      </View>

      {/* Filtro por Cartão */}
      {cartoes.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtroCartoesScroll}>
          <TouchableOpacity
            onPress={() => setCartaoFiltro('todos')}
            style={[styles.filtroChip, cartaoFiltro === 'todos' && styles.filtroChipAtivo]}
          >
            <Text style={[styles.filtroChipTexto, cartaoFiltro === 'todos' && styles.filtroChipTextoAtivo]}>
              Todos os Cartões
            </Text>
          </TouchableOpacity>

          {cartoes.map((c) => {
            const isSelected = cartaoFiltro === c.id
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => setCartaoFiltro(c.id)}
                style={[
                  styles.filtroChip,
                  isSelected && { borderColor: c.cor, backgroundColor: c.cor + '20' }
                ]}
              >
                <View style={[styles.pontoCor, { backgroundColor: c.cor }]} />
                <Text style={[styles.filtroChipTexto, isSelected && { color: colors.text, fontWeight: '700' }]}>
                  {c.nome}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {/* Resumo Geral do Fluxo */}
      <View style={styles.resumoFluxoCard}>
        <View style={styles.resumoColuna}>
          <Text style={styles.resumoLabel}>Comprometimento Total</Text>
          <Text style={styles.resumoValor}>{formatCurrency(totalComprometido)}</Text>
        </View>
        <View style={styles.divisorVertical} />
        <View style={styles.resumoColuna}>
          <Text style={styles.resumoLabel}>Meses com Fatura</Text>
          <Text style={styles.resumoSub}>{gruposPorMes.length} meses futuros</Text>
        </View>
      </View>

      {/* Timeline Visual de Saída de Caixa Mês a Mês */}
      {gruposPorMes.length > 0 && (
        <View style={styles.timelineSecao}>
          <Text style={styles.timelineTitulo}>Fluxo Mês a Mês (Toque em um mês para detalhar)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.timelineScroll}
          >
            {gruposPorMes.map((g) => {
              const isSelected = g.chave === (mesSelecionado || grupoAtivo?.chave)
              const percentualAltura = Math.max(18, Math.round((g.total / maxMesTotal) * 75))

              return (
                <TouchableOpacity
                  key={g.chave}
                  onPress={() => setMesSelecionado(g.chave)}
                  style={[styles.mesColuna, isSelected && styles.mesColunaAtiva]}
                >
                  <Text style={styles.colunaValor}>{formatCurrency(g.total)}</Text>
                  <View style={styles.barraContainer}>
                    <View
                      style={[
                        styles.barraMes,
                        { height: percentualAltura },
                        isSelected && styles.barraMesAtiva
                      ]}
                    />
                  </View>
                  <Text style={[styles.colunaNome, isSelected && styles.colunaNomeAtivo]}>
                    {g.mesNome.split(' / ')[0].substring(0, 3)}/{g.chave.substring(2, 4)}
                  </Text>
                  <Text style={styles.colunaQtd}>{g.parcelas.length} {g.parcelas.length === 1 ? 'parc.' : 'parcs.'}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )}

      {/* Lista de Parcelas que Vencem no Mês Selecionado */}
      <View style={styles.detalhesContainer}>
        <View style={styles.detalhesHeader}>
          <Text style={styles.detalhesTitulo}>
            {grupoAtivo ? `Fatura Prevista: ${grupoAtivo.mesNome}` : 'Sem parcelas futuras'}
          </Text>
          {grupoAtivo && (
            <Text style={styles.detalhesTotalMes}>{formatCurrency(grupoAtivo.total)}</Text>
          )}
        </View>

        <FlatList
          data={grupoAtivo?.parcelas || []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregarParcelas() }} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={40} color={colors.muted} />
                <Text style={styles.emptyTitle}>Nenhuma parcela futura encontrada</Text>
                <Text style={styles.emptyText}>
                  Suba sua fatura ou lance compras parceladas para visualizar o fluxo das próximas faturas!
                </Text>
                <View style={{ marginTop: 12 }}>
                  <Button
                    title="Subir Fatura de Cartão"
                    onPress={() => navigation.navigate('ImportarFatura')}
                  />
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isUltimaParcela = item.numero === item.total_parcelas
            const cartaoNome = item.transacoes?.cartoes_credito?.nome
            const categoriaNome = item.transacoes?.categorias?.nome
            const categoriaCor = item.transacoes?.categorias?.cor || colors.primary

            return (
              <View style={styles.parcelaCard}>
                <View style={[styles.parcelaIcone, { backgroundColor: categoriaCor + '18' }]}>
                  <Ionicons
                    name={(item.transacoes?.categorias?.icone as any) || 'card-outline'}
                    size={20}
                    color={categoriaCor}
                  />
                </View>
                <View style={styles.parcelaInfo}>
                  <Text style={styles.parcelaDescricao} numberOfLines={1}>
                    {item.transacoes?.descricao || 'Compra'}
                  </Text>
                  <View style={styles.parcelaSub}>
                    <View style={[styles.badgeNum, isUltimaParcela && styles.badgeUltima]}>
                      <Text style={[styles.badgeNumTexto, isUltimaParcela && styles.badgeUltimaTexto]}>
                        Parcela {item.numero} de {item.total_parcelas}
                        {isUltimaParcela ? ' (Última! 🎉)' : ''}
                      </Text>
                    </View>
                    {cartaoNome && (
                      <Text style={styles.cartaoTag}>• {cartaoNome}</Text>
                    )}
                    {categoriaNome && (
                      <Text style={styles.categoriaTag}>• {categoriaNome}</Text>
                    )}
                  </View>
                  <Text style={styles.dataVencimento}>
                    Previsão de vencimento: {formatarData(item.data_vencimento)}
                  </Text>
                </View>
                <Text style={styles.parcelaValor}>{formatCurrency(Number(item.valor))}</Text>
              </View>
            )
          }}
        />
      </View>
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
  filtroCartoesScroll: {
    gap: 8,
    paddingVertical: 4,
    marginBottom: 10
  },
  filtroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  filtroChipAtivo: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  filtroChipTexto: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '500'
  },
  filtroChipTextoAtivo: {
    color: colors.primary,
    fontWeight: '700'
  },
  pontoCor: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6
  },
  resumoFluxoCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  resumoColuna: {
    flex: 1
  },
  resumoLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '500'
  },
  resumoValor: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.expense,
    marginTop: 4
  },
  resumoSub: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4
  },
  divisorVertical: {
    width: 1,
    height: 38,
    backgroundColor: colors.border,
    marginHorizontal: 14
  },
  timelineSecao: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12
  },
  timelineTitulo: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 8
  },
  timelineScroll: {
    gap: 10,
    alignItems: 'flex-end',
    paddingVertical: 4
  },
  mesColuna: {
    alignItems: 'center',
    minWidth: 74,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  mesColunaAtiva: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + '50'
  },
  colunaValor: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: 4
  },
  barraContainer: {
    height: 75,
    width: 20,
    backgroundColor: colors.border + '60',
    borderRadius: 10,
    justifyContent: 'flex-end',
    overflow: 'hidden'
  },
  barraMes: {
    width: '100%',
    backgroundColor: colors.muted,
    borderRadius: 10
  },
  barraMesAtiva: {
    backgroundColor: colors.primary
  },
  colunaNome: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 6
  },
  colunaNomeAtivo: {
    color: colors.primary,
    fontWeight: '800'
  },
  colunaQtd: {
    fontSize: 10,
    color: colors.muted
  },
  detalhesContainer: {
    flex: 1
  },
  detalhesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  detalhesTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text
  },
  detalhesTotalMes: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.expense
  },
  list: {
    gap: 8,
    paddingBottom: 24
  },
  parcelaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  parcelaIcone: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  parcelaInfo: {
    flex: 1,
    gap: 2
  },
  parcelaDescricao: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  parcelaSub: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4
  },
  badgeNum: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  badgeNumTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary
  },
  badgeUltima: {
    backgroundColor: colors.incomeLight
  },
  badgeUltimaTexto: {
    color: colors.income
  },
  cartaoTag: {
    fontSize: 11,
    color: colors.muted
  },
  categoriaTag: {
    fontSize: 11,
    color: colors.muted
  },
  dataVencimento: {
    fontSize: 11,
    color: colors.muted
  },
  parcelaValor: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text
  },
  emptyContainer: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 10,
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
