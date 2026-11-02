import { useCallback, useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../theme'
import { formatCurrency } from '../utils/formatCurrency'
import { notify } from '../utils/notify'
import {
  carregarLancamentosMA,
  LANCAMENTOS_INICIAIS,
  salvarLancamentosMA
} from '../services/planilhasService'
import { LancamentoMA } from '../types'

export function LancamentosMAScreen() {
  const [lancamentos, setLancamentos] = useState<LancamentoMA[]>(LANCAMENTOS_INICIAIS)
  const [mesFiltro, setMesFiltro] = useState<string>('Novembro')
  const [cartaoFiltro, setCartaoFiltro] = useState<string>('Todos')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modal para Nova Entrada / Edição
  const [modalVisible, setModalVisible] = useState(false)
  const [itemEditando, setItemEditando] = useState<LancamentoMA | null>(null)

  // Formulário
  const [formMesBase, setFormMesBase] = useState('Novembro')
  const [formDataCartao, setFormDataCartao] = useState('30/out')
  const [formCartao, setFormCartao] = useState('Nubank')
  const [formLocal, setFormLocal] = useState('H2')
  const [formValor, setFormValor] = useState('')
  const [formTaxa, setFormTaxa] = useState('')
  const [manterAbertoAposSalvar, setManterAbertoAposSalvar] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const data = await carregarLancamentosMA()
      setLancamentos(data)
    } catch (err) {
      console.warn('Erro ao carregar lançamentos MA:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      carregar()
    }, [carregar])
  )

  // Filtragem
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter((item) => {
      const bateuMes = mesFiltro === 'Todos' || item.mes_base.toLowerCase() === mesFiltro.toLowerCase()
      const bateuCartao = cartaoFiltro === 'Todos' || item.cartao_nome.toLowerCase() === cartaoFiltro.toLowerCase()
      return bateuMes && bateuCartao
    })
  }, [lancamentos, mesFiltro, cartaoFiltro])

  // Totais Gerais dos lançamentos exibidos
  const totalSacado = useMemo(() => {
    return lancamentosFiltrados.reduce((acc, it) => acc + (Number(it.valor) || 0), 0)
  }, [lancamentosFiltrados])

  const totalTaxa = useMemo(() => {
    return lancamentosFiltrados.reduce((acc, it) => acc + (Number(it.taxa) || 0), 0)
  }, [lancamentosFiltrados])

  const abrirModalNovo = () => {
    setItemEditando(null)
    setFormMesBase(mesFiltro === 'Todos' ? 'Novembro' : mesFiltro)
    setFormDataCartao('30/out')
    setFormCartao('Nubank')
    setFormLocal('H2')
    setFormValor('')
    setFormTaxa('')
    setModalVisible(true)
  }

  const abrirModalEditar = (item: LancamentoMA) => {
    setItemEditando(item)
    setFormMesBase(item.mes_base)
    setFormDataCartao(item.data_cartao)
    setFormCartao(item.cartao_nome)
    setFormLocal(item.local)
    setFormValor(item.valor > 0 ? item.valor.toString() : '')
    setFormTaxa(item.taxa > 0 ? item.taxa.toString() : '')
    setModalVisible(true)
  }

  const duplicarItem = async (item: LancamentoMA) => {
    const novo: LancamentoMA = {
      ...item,
      id: `l-${Date.now()}`
    }
    const listaAtualizada = [novo, ...lancamentos]
    setLancamentos(listaAtualizada)
    await salvarLancamentosMA(listaAtualizada)
    notify('Duplicado', `Entrada de ${formatCurrency(novo.valor)} duplicada!`)
  }

  const salvarItem = async () => {
    const valorNum = parseFloat(formValor.replace(',', '.')) || 0
    const taxaNum = parseFloat(formTaxa.replace(',', '.')) || 0

    if (valorNum <= 0) {
      notify('Atenção', 'Informe um valor válido.')
      return
    }

    const itemSalvo: LancamentoMA = {
      id: itemEditando ? itemEditando.id : `l-${Date.now()}`,
      mes_base: formMesBase.trim() || 'Novembro',
      data_cartao: formDataCartao.trim() || '30/out',
      cartao_nome: formCartao.trim() || 'Nubank',
      local: formLocal.trim() || 'H2',
      valor: valorNum,
      taxa: taxaNum
    }

    let listaAtualizada: LancamentoMA[]
    if (itemEditando) {
      listaAtualizada = lancamentos.map((it) => (it.id === itemEditando.id ? itemSalvo : it))
    } else {
      listaAtualizada = [...lancamentos, itemSalvo]
    }

    setLancamentos(listaAtualizada)
    await salvarLancamentosMA(listaAtualizada)

    if (manterAbertoAposSalvar) {
      // Limpa os valores para próxima entrada rápida
      setFormValor('')
      setFormTaxa('')
      notify('Adicionado', 'Entrada salva! Pode adicionar a próxima.')
    } else {
      setModalVisible(false)
      notify('Sucesso', 'Entrada salva com sucesso!')
    }
  }

  const excluirItem = async (id: string) => {
    const listaAtualizada = lancamentos.filter((it) => it.id !== id)
    setLancamentos(listaAtualizada)
    setModalVisible(false)
    await salvarLancamentosMA(listaAtualizada)
    notify('Excluído', 'Entrada removida com sucesso.')
  }

  // Agrupamento por Cartão para mostrar os subtotais exatamente como na planilha
  const grupos = useMemo(() => {
    const map = new Map<string, LancamentoMA[]>()
    lancamentosFiltrados.forEach((item) => {
      const key = `${item.cartao_nome} - ${item.data_cartao}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    })
    return Array.from(map.entries())
  }, [lancamentosFiltrados])

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar() }} />}
      >
        {/* Cabeçalho */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Lançamentos MA</Text>
            <Text style={styles.subtitle}>Registro de saques e taxas por cartão e local</Text>
          </View>
          <TouchableOpacity style={styles.btnNovoTopo} onPress={abrirModalNovo}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.btnNovoTopoTexto}>Nova Entrada</Text>
          </TouchableOpacity>
        </View>

        {/* CARDS DE DESTAQUE: VALORSACADO E VALORTAXA (Exatamente como o topo da Imagem 2) */}
        <View style={styles.totaisGrid}>
          <View style={[styles.totalBox, { borderLeftColor: '#0284C7' }]}>
            <View style={styles.totalBoxHeader}>
              <Ionicons name="cash-outline" size={18} color="#0284C7" />
              <Text style={styles.totalBoxLabel}>ValorSacado</Text>
            </View>
            <Text style={[styles.totalBoxValor, { color: '#0369A1' }]}>
              {formatCurrency(totalSacado)}
            </Text>
            <Text style={styles.totalBoxSub}>{lancamentosFiltrados.length} lançamentos</Text>
          </View>

          <View style={[styles.totalBox, { borderLeftColor: '#D97706' }]}>
            <View style={styles.totalBoxHeader}>
              <Ionicons name="receipt-outline" size={18} color="#D97706" />
              <Text style={styles.totalBoxLabel}>ValorTaxa</Text>
            </View>
            <Text style={[styles.totalBoxValor, { color: '#B45309' }]}>
              {formatCurrency(totalTaxa)}
            </Text>
            <Text style={styles.totalBoxSub}>
              Líquido: {formatCurrency(Math.max(0, totalSacado - totalTaxa))}
            </Text>
          </View>
        </View>

        {/* Filtros rápidos: Mês e Cartão */}
        <View style={styles.filtrosRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {['Todos', 'Novembro', 'Outubro'].map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.filtroChip, mesFiltro === m && styles.filtroChipActive]}
                onPress={() => setMesFiltro(m)}
              >
                <Text style={[styles.filtroChipText, mesFiltro === m && styles.filtroChipTextActive]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* TABELA COM ROLAGEM HORIZONTAL E SUBTOTAIS (Fiel à imagem 2) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
          <View style={[styles.tableContainer, { minWidth: 680 }]}>
            {/* Header da Tabela */}
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: 90 }]}>MesBase</Text>
              <Text style={[styles.th, { width: 90 }]}>DataCartão</Text>
              <Text style={[styles.th, { width: 90 }]}>Cartão</Text>
              <Text style={[styles.th, { width: 110 }]}>Local</Text>
              <Text style={[styles.th, styles.thRight, { width: 100 }]}>Valor</Text>
              <Text style={[styles.th, styles.thRight, { width: 90 }]}>Taxa</Text>
              <Text style={[styles.th, styles.thRight, { width: 110 }]}>Subtotais</Text>
            </View>

            {/* Linhas Agrupadas por Cartão / Data com Subtotais */}
            {grupos.map(([grupoKey, itens]) => {
              const subtotalValor = itens.reduce((s, it) => s + (Number(it.valor) || 0), 0)
              const subtotalTaxa = itens.reduce((s, it) => s + (Number(it.taxa) || 0), 0)

              return (
                <View key={grupoKey} style={styles.grupoContainer}>
                  {itens.map((item, idx) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.tr, idx % 2 === 1 && styles.trAlt]}
                      onPress={() => abrirModalEditar(item)}
                    >
                      <Text style={[styles.td, { width: 90 }]}>{item.mes_base}</Text>
                      <Text style={[styles.tdMuted, { width: 90 }]}>{item.data_cartao}</Text>
                      <Text style={[styles.tdBold, { width: 90 }]}>{item.cartao_nome}</Text>
                      <Text style={[styles.tdLocal, { width: 110 }]}>{item.local}</Text>
                      <Text style={[styles.tdValor, styles.thRight, { width: 100 }]}>
                        {formatCurrency(item.valor)}
                      </Text>
                      <Text style={[styles.tdTaxa, styles.thRight, { width: 90 }]}>
                        {item.taxa > 0 ? formatCurrency(item.taxa) : '-'}
                      </Text>

                      {/* Exibe o subtotal na primeira linha do grupo como na planilha */}
                      <View style={{ width: 110, alignItems: 'flex-end' }}>
                        {idx === 0 ? (
                          <View style={styles.subtotalBadge}>
                            <Text style={styles.subtotalTexto}>{formatCurrency(subtotalValor)}</Text>
                            {subtotalTaxa > 0 && (
                              <Text style={styles.subtotalTaxaTexto}>Tx: {formatCurrency(subtotalTaxa)}</Text>
                            )}
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            })}

            {lancamentosFiltrados.length === 0 && (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyRowText}>Nenhum lançamento encontrado para este filtro.</Text>
              </View>
            )}

            {/* Rodapé da Tabela: Soma Geral */}
            <View style={styles.tableFooter}>
              <Text style={[styles.footerLabel, { width: 380 }]}>Total Geral dos Lançamentos:</Text>
              <Text style={[styles.footerValor, styles.thRight, { width: 100 }]}>
                {formatCurrency(totalSacado)}
              </Text>
              <Text style={[styles.footerTaxa, styles.thRight, { width: 90 }]}>
                {formatCurrency(totalTaxa)}
              </Text>
              <Text style={{ width: 110 }} />
            </View>
          </View>
        </ScrollView>

        {/* Botão de Adição Rápida */}
        <TouchableOpacity style={styles.btnAdicionarRapido} onPress={abrirModalNovo}>
          <Ionicons name="add-circle" size={20} color={colors.primary} />
          <Text style={styles.btnAdicionarRapidoTexto}>Adicionar Nova Entrada à Planilha</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL ADICIONAR / EDITAR ENTRADA */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>
                {itemEditando ? 'Editar Entrada MA' : 'Nova Entrada MA'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Mês Base:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ex: Novembro"
                    value={formMesBase}
                    onChangeText={setFormMesBase}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Data Cartão:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ex: 30/out"
                    value={formDataCartao}
                    onChangeText={setFormDataCartao}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Cartão:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ex: Nubank, PicPay"
                    value={formCartao}
                    onChangeText={setFormCartao}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Local / Estabelecimento:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ex: H2, MonteCarlo"
                    value={formLocal}
                    onChangeText={setFormLocal}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Valor Sacado (R$):</Text>
                  <TextInput
                    style={[styles.input, styles.inputDestaque]}
                    placeholder="0,00"
                    keyboardType="numeric"
                    value={formValor}
                    onChangeText={setFormValor}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Taxa (R$):</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0,00"
                    keyboardType="numeric"
                    value={formTaxa}
                    onChangeText={setFormTaxa}
                  />
                </View>
              </View>

              {!itemEditando && (
                <TouchableOpacity
                  style={styles.checkContinuar}
                  onPress={() => setManterAbertoAposSalvar(!manterAbertoAposSalvar)}
                >
                  <Ionicons
                    name={manterAbertoAposSalvar ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.checkContinuarTexto}>
                    Continuar adicionando outras entradas sem fechar
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.modalBotoes}>
                {itemEditando && (
                  <>
                    <TouchableOpacity
                      style={styles.btnDuplicar}
                      onPress={() => duplicarItem(itemEditando)}
                    >
                      <Ionicons name="copy-outline" size={16} color={colors.primary} />
                      <Text style={styles.btnDuplicarTexto}>Duplicar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnExcluir}
                      onPress={() => excluirItem(itemEditando.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      <Text style={styles.btnExcluirTexto}>Excluir</Text>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity
                  style={styles.btnCancelar}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.btnCancelarTexto}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnSalvar} onPress={salvarItem}>
                  <Text style={styles.btnSalvarTexto}>Salvar Entrada</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2
  },
  btnNovoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4
  },
  btnNovoTopoTexto: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12
  },
  totaisGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  totalBox: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2
  },
  totalBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  totalBoxLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text
  },
  totalBoxValor: {
    fontSize: 20,
    fontWeight: '900',
    marginVertical: 4
  },
  totalBoxSub: {
    fontSize: 11,
    color: colors.muted
  },
  filtrosRow: {
    marginBottom: 12
  },
  filtroChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  filtroChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filtroChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted
  },
  filtroChipTextActive: {
    color: '#fff'
  },
  tableScroll: {
    marginBottom: 12
  },
  tableContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  th: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary
  },
  thRight: {
    textAlign: 'right'
  },
  grupoContainer: {
    borderBottomWidth: 2,
    borderBottomColor: '#CBD5E1'
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  trAlt: {
    backgroundColor: '#FAFAFA'
  },
  td: {
    fontSize: 12,
    color: colors.text
  },
  tdMuted: {
    fontSize: 12,
    color: colors.muted
  },
  tdBold: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text
  },
  tdLocal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569'
  },
  tdValor: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text
  },
  tdTaxa: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706'
  },
  subtotalBadge: {
    alignItems: 'flex-end',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  subtotalTexto: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0369A1'
  },
  subtotalTaxaTexto: {
    fontSize: 9,
    color: '#0284C7'
  },
  emptyRow: {
    padding: 24,
    alignItems: 'center'
  },
  emptyRowText: {
    fontSize: 13,
    color: colors.muted
  },
  tableFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  footerLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text
  },
  footerValor: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0369A1'
  },
  footerTaxa: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309'
  },
  btnAdicionarRapido: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10
  },
  btnAdicionarRapidoTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  inputDestaque: {
    fontWeight: '800',
    color: '#0369A1'
  },
  checkContinuar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 16
  },
  checkContinuarTexto: {
    fontSize: 12,
    color: colors.textSecondary
  },
  modalBotoes: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    alignItems: 'center',
    marginTop: 10
  },
  btnDuplicar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primaryLight
  },
  btnDuplicarTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary
  },
  btnExcluir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    marginRight: 'auto'
  },
  btnExcluirTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626'
  },
  btnCancelar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  btnCancelarTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted
  },
  btnSalvar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary
  },
  btnSalvarTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff'
  }
})
