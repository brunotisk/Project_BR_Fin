import { useCallback, useState } from 'react'
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
  carregarCartoesControle,
  carregarMesFechamentoSelecionado,
  CARTOES_DETALHADOS_INICIAIS,
  CARTOES_VIGENTES_INICIAIS,
  salvarCartoesControle,
  salvarMesFechamentoSelecionado
} from '../services/planilhasService'
import { CartaoControleItem } from '../types'

export function CartoesControleScreen() {
  const [mesAtual, setMesAtual] = useState(carregarMesFechamentoSelecionado())
  const [vigentes, setVigentes] = useState<CartaoControleItem[]>(CARTOES_VIGENTES_INICIAIS)
  const [detalhados, setDetalhados] = useState<CartaoControleItem[]>(CARTOES_DETALHADOS_INICIAIS)
  const [atualizadoEm, setAtualizadoEm] = useState('30/out')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modal para adicionar/editar cartão
  const [modalVisible, setModalVisible] = useState(false)
  const [tabelaAlvo, setTabelaAlvo] = useState<'vigente' | 'detalhado_ma'>('vigente')
  const [itemEditando, setItemEditando] = useState<CartaoControleItem | null>(null)

  // Campos do formulário do modal
  const [formNome, setFormNome] = useState('')
  const [formValor, setFormValor] = useState('')
  const [formValorMA, setFormValorMA] = useState('')
  const [formValorSemMA, setFormValorSemMA] = useState('')
  const [formFechamento, setFormFechamento] = useState('')
  const [formPagamento, setFormPagamento] = useState('')

  const carregar = useCallback(async (mes: string) => {
    try {
      const { vigentes: v, detalhados: d } = await carregarCartoesControle(mes)
      setVigentes(v)
      setDetalhados(d)
      if (v[0]?.atualizado_em_texto) {
        setAtualizadoEm(v[0].atualizado_em_texto)
      }
    } catch (err) {
      console.warn('Erro ao carregar cartões:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      const mesSalvo = carregarMesFechamentoSelecionado()
      setMesAtual(mesSalvo)
      carregar(mesSalvo)
    }, [carregar])
  )

  const mudarMes = (novoMes: string) => {
    setMesAtual(novoMes)
    salvarMesFechamentoSelecionado(novoMes)
    carregar(novoMes)
  }

  const abrirModalNovo = (tipo: 'vigente' | 'detalhado_ma') => {
    setTabelaAlvo(tipo)
    setItemEditando(null)
    setFormNome('')
    setFormValor('')
    setFormValorMA('')
    setFormValorSemMA('')
    setFormFechamento('')
    setFormPagamento('')
    setModalVisible(true)
  }

  const abrirModalEditar = (item: CartaoControleItem) => {
    setTabelaAlvo(item.tabela_tipo)
    setItemEditando(item)
    setFormNome(item.cartao_nome)
    setFormValor(item.valor > 0 ? item.valor.toString() : '')
    setFormValorMA(item.valor_ma && item.valor_ma > 0 ? item.valor_ma.toString() : '')
    setFormValorSemMA(item.valor_sem_ma && item.valor_sem_ma > 0 ? item.valor_sem_ma.toString() : '')
    setFormFechamento(item.fechamento || '')
    setFormPagamento(item.pagamento || '')
    setModalVisible(true)
  }

  // Ao preencher Valor Total e Valor MA, calcula automaticamente o Valor Sem MA
  const atualizarValoresCompletos = (totalStr: string, maStr: string) => {
    setFormValor(totalStr)
    setFormValorMA(maStr)
    const t = parseFloat(totalStr.replace(',', '.')) || 0
    const m = parseFloat(maStr.replace(',', '.')) || 0
    const sem = Math.max(0, t - m)
    setFormValorSemMA(sem > 0 ? sem.toString() : '')
  }

  const salvarItem = async () => {
    if (!formNome.trim()) {
      notify('Atenção', 'Informe o nome do cartão.')
      return
    }

    const valorNum = parseFloat(formValor.replace(',', '.')) || 0
    const valorMANum = parseFloat(formValorMA.replace(',', '.')) || 0
    let valorSemMANum = parseFloat(formValorSemMA.replace(',', '.')) || 0

    if (tabelaAlvo === 'detalhado_ma' && !valorSemMANum && valorNum > 0) {
      valorSemMANum = Math.max(0, valorNum - valorMANum)
    }

    const novoItem: CartaoControleItem = {
      id: itemEditando ? itemEditando.id : `cartao-${Date.now()}`,
      mes_referencia: mesAtual,
      tabela_tipo: tabelaAlvo,
      cartao_nome: formNome.trim(),
      valor: valorNum,
      valor_ma: valorMANum,
      valor_sem_ma: valorSemMANum,
      fechamento: formFechamento.trim(),
      pagamento: formPagamento.trim(),
      atualizado_em_texto: atualizadoEm
    }

    let novosVigentes = [...vigentes]
    let novosDetalhados = [...detalhados]

    if (tabelaAlvo === 'vigente') {
      if (itemEditando) {
        novosVigentes = novosVigentes.map((it) => (it.id === itemEditando.id ? novoItem : it))
      } else {
        novosVigentes.push(novoItem)
      }
      setVigentes(novosVigentes)
    } else {
      if (itemEditando) {
        novosDetalhados = novosDetalhados.map((it) => (it.id === itemEditando.id ? novoItem : it))
      } else {
        novosDetalhados.push(novoItem)
      }
      setDetalhados(novosDetalhados)
    }

    setModalVisible(false)
    await salvarCartoesControle([...novosVigentes, ...novosDetalhados], mesAtual)
    notify('Sucesso', 'Cartão salvo com sucesso!')
  }

  const excluirItem = async (id: string, tipo: 'vigente' | 'detalhado_ma') => {
    let novosVigentes = [...vigentes]
    let novosDetalhados = [...detalhados]

    if (tipo === 'vigente') {
      novosVigentes = novosVigentes.filter((c) => c.id !== id)
      setVigentes(novosVigentes)
    } else {
      novosDetalhados = novosDetalhados.filter((c) => c.id !== id)
      setDetalhados(novosDetalhados)
    }

    setModalVisible(false)
    await salvarCartoesControle([...novosVigentes, ...novosDetalhados], mesAtual)
    notify('Removido', 'Item excluído com sucesso.')
  }

  // Cálculos de Totais
  const totalVigentes = vigentes.reduce((acc, c) => acc + (Number(c.valor) || 0), 0)
  const totalDetalhados = detalhados.reduce((acc, c) => acc + (Number(c.valor) || 0), 0)
  const totalMA = detalhados.reduce((acc, c) => acc + (Number(c.valor_ma) || 0), 0)
  const totalSemMA = detalhados.reduce((acc, c) => acc + (Number(c.valor_sem_ma) || 0), 0)

  const mesesDisponiveis = ['Outubro', 'Novembro', 'Dezembro', 'Janeiro']

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(mesAtual) }} />}
      >
        {/* Cabeçalho */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Cartões</Text>
            <Text style={styles.subtitle}>
              Faturas abertas e detalhamento MA ({mesAtual})
            </Text>
          </View>
        </View>

        {/* Seletor de mêsFechamento */}
        <View style={styles.mesSelectorRow}>
          <Text style={styles.mesSelectorLabel}>Mês Fechamento:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {mesesDisponiveis.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.mesChip, mesAtual === m && styles.mesChipActive]}
                onPress={() => mudarMes(m)}
              >
                <Text style={[styles.mesChipText, mesAtual === m && styles.mesChipTextActive]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ========================================================= */}
        {/* TABELA 1: FATURAS VIGENTES (Tabela superior da Imagem 1) */}
        {/* ========================================================= */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleBadge}>
            <Ionicons name="card-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>Faturas do Fechamento ({mesAtual})</Text>
          </View>
          <View style={styles.atualizadoBadge}>
            <Text style={styles.atualizadoLabel}>Atualizado Em:</Text>
            <Text style={styles.atualizadoData}>{atualizadoEm}</Text>
          </View>
        </View>

        <View style={styles.tableCard}>
          <View style={styles.tableHeaderSky}>
            <Text style={[styles.colHeader, { flex: 1.2 }]}>Cartão</Text>
            <Text style={[styles.colHeader, styles.colRight, { flex: 1.1 }]}>Valor</Text>
            <Text style={[styles.colHeader, styles.colCenter, { flex: 1 }]}>Fechamento</Text>
            <Text style={[styles.colHeader, styles.colCenter, { flex: 1 }]}>Pagamento</Text>
          </View>

          {vigentes.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.tableRow}
              onPress={() => abrirModalEditar(item)}
            >
              <Text style={[styles.cellTextBold, { flex: 1.2 }]}>{item.cartao_nome}</Text>
              <Text style={[styles.cellText, styles.colRight, { flex: 1.1 }]}>
                {item.valor > 0 ? formatCurrency(item.valor) : '-'}
              </Text>
              <Text style={[styles.cellMuted, styles.colCenter, { flex: 1 }]}>
                {item.fechamento || '-'}
              </Text>
              <Text style={[styles.cellMuted, styles.colCenter, { flex: 1 }]}>
                {item.pagamento || '-'}
              </Text>
            </TouchableOpacity>
          ))}

          {vigentes.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhuma fatura cadastrada para {mesAtual}.</Text>
            </View>
          )}

          {/* Rodapé da Tabela 1: Total das Faturas */}
          <View style={styles.tableFooter}>
            <Text style={styles.footerLabel}>Total Faturas:</Text>
            <Text style={styles.footerValue}>{formatCurrency(totalVigentes)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.btnAdicionarLinha}
          onPress={() => abrirModalNovo('vigente')}
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.btnAdicionarLinhaTexto}>+ Adicionar Cartão na Fatura de {mesAtual}</Text>
        </TouchableOpacity>

        {/* ============================================================== */}
        {/* TABELA 2: FATURAS DETALHAMENTO MA (Tabela inferior da Imagem 1) */}
        {/* ============================================================== */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <View style={styles.sectionTitleBadge}>
            <Ionicons name="swap-horizontal" size={16} color="#0D9488" />
            <Text style={styles.sectionTitle}>Faturas com Detalhamento MA ({mesAtual})</Text>
          </View>
        </View>

        {/* Destaque dos Totais MA */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiPill, { backgroundColor: '#F0FDFA', borderColor: '#CCFBF1' }]}>
            <Text style={styles.kpiPillLabel}>Total MA:</Text>
            <Text style={[styles.kpiPillValor, { color: '#0F766E' }]}>{formatCurrency(totalMA)}</Text>
          </View>
          <View style={[styles.kpiPill, { backgroundColor: '#EDF4E9', borderColor: '#D6E6D7' }]}>
            <Text style={styles.kpiPillLabel}>Sem MA:</Text>
            <Text style={[styles.kpiPillValor, { color: '#173F35' }]}>{formatCurrency(totalSemMA)}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.horizontalScroll}>
          <View style={[styles.tableCard, { minWidth: 620 }]}>
            <View style={styles.tableHeaderSky}>
              <Text style={[styles.colHeader, { width: 100 }]}>Cartão</Text>
              <Text style={[styles.colHeader, styles.colRight, { width: 110 }]}>Valor</Text>
              <Text style={[styles.colHeader, styles.colRight, { width: 110 }]}>ValorMA</Text>
              <Text style={[styles.colHeader, styles.colRight, { width: 110 }]}>ValorSemMA</Text>
              <Text style={[styles.colHeader, styles.colCenter, { width: 95 }]}>Fechamento</Text>
              <Text style={[styles.colHeader, styles.colCenter, { width: 95 }]}>Pagamento</Text>
            </View>

            {detalhados.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.tableRow}
                onPress={() => abrirModalEditar(item)}
              >
                <Text style={[styles.cellTextBold, { width: 100 }]}>{item.cartao_nome}</Text>
                <Text style={[styles.cellText, styles.colRight, { width: 110 }]}>
                  {item.valor > 0 ? formatCurrency(item.valor) : '-'}
                </Text>
                <Text style={[styles.cellTextMA, styles.colRight, { width: 110 }]}>
                  {item.valor_ma && item.valor_ma > 0 ? formatCurrency(item.valor_ma) : '-'}
                </Text>
                <Text style={[styles.cellTextSemMA, styles.colRight, { width: 110 }]}>
                  {item.valor_sem_ma && item.valor_sem_ma > 0 ? formatCurrency(item.valor_sem_ma) : '-'}
                </Text>
                <Text style={[styles.cellMuted, styles.colCenter, { width: 95 }]}>
                  {item.fechamento || '-'}
                </Text>
                <Text style={[styles.cellMuted, styles.colCenter, { width: 95 }]}>
                  {item.pagamento || '-'}
                </Text>
              </TouchableOpacity>
            ))}

            {detalhados.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Nenhum detalhamento cadastrado para {mesAtual}.</Text>
              </View>
            )}

            {/* Linha de Totais da Tabela MA */}
            <View style={styles.tableFooterMA}>
              <Text style={[styles.footerLabel, { width: 100 }]}>Totais:</Text>
              <Text style={[styles.footerValue, styles.colRight, { width: 110 }]}>
                {formatCurrency(totalDetalhados)}
              </Text>
              <Text style={[styles.footerValueMA, styles.colRight, { width: 110 }]}>
                {formatCurrency(totalMA)}
              </Text>
              <Text style={[styles.footerValueSemMA, styles.colRight, { width: 110 }]}>
                {formatCurrency(totalSemMA)}
              </Text>
              <Text style={{ width: 190 }} />
            </View>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.btnAdicionarLinha}
          onPress={() => abrirModalNovo('detalhado_ma')}
        >
          <Ionicons name="add-circle-outline" size={18} color="#0D9488" />
          <Text style={[styles.btnAdicionarLinhaTexto, { color: '#0D9488' }]}>
            + Adicionar Cartão no Detalhamento MA ({mesAtual})
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Adicionar / Editar */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>
                {itemEditando ? 'Editar Cartão' : 'Novo Cartão no Controle'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Nome do Cartão (ex: Nubank, BTG):</Text>
              <TextInput
                style={styles.input}
                placeholder="Nome do cartão"
                value={formNome}
                onChangeText={setFormNome}
              />

              <Text style={styles.inputLabel}>Valor Total (R$):</Text>
              <TextInput
                style={styles.input}
                placeholder="0,00"
                keyboardType="numeric"
                value={formValor}
                onChangeText={(val) => atualizarValoresCompletos(val, formValorMA)}
              />

              {tabelaAlvo === 'detalhado_ma' && (
                <>
                  <Text style={styles.inputLabel}>Valor MA (R$):</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0,00"
                    keyboardType="numeric"
                    value={formValorMA}
                    onChangeText={(ma) => atualizarValoresCompletos(formValor, ma)}
                  />

                  <Text style={styles.inputLabel}>Valor Sem MA (R$):</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0,00"
                    keyboardType="numeric"
                    value={formValorSemMA}
                    onChangeText={setFormValorSemMA}
                  />
                </>
              )}

              <View style={styles.datasRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Fechamento:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ex: 29/out"
                    value={formFechamento}
                    onChangeText={setFormFechamento}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Pagamento:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ex: 05/nov"
                    value={formPagamento}
                    onChangeText={setFormPagamento}
                  />
                </View>
              </View>

              <View style={styles.modalBotoes}>
                {itemEditando && (
                  <TouchableOpacity
                    style={styles.btnExcluir}
                    onPress={() => excluirItem(itemEditando.id, tabelaAlvo)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <Text style={styles.btnExcluirTexto}>Excluir</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.btnCancelar}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.btnCancelarTexto}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnSalvar} onPress={salvarItem}>
                  <Text style={styles.btnSalvarTexto}>Salvar</Text>
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
    marginBottom: 10
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
  mesSelectorRow: {
    marginBottom: 14
  },
  mesSelectorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  mesChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  mesChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  mesChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted
  },
  mesChipTextActive: {
    color: '#fff'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  sectionTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text
  },
  atualizadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4
  },
  atualizadoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D'
  },
  atualizadoData: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534'
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10
  },
  kpiPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1
  },
  kpiPillLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary
  },
  kpiPillValor: {
    fontSize: 14,
    fontWeight: '800'
  },
  horizontalScroll: {
    marginBottom: 6
  },
  tableCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
    marginBottom: 8
  },
  tableHeaderSky: {
    flexDirection: 'row',
    backgroundColor: '#38BDF8',
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  colHeader: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13
  },
  colRight: {
    textAlign: 'right'
  },
  colCenter: {
    textAlign: 'center'
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  cellTextBold: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text
  },
  cellText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text
  },
  cellTextMA: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E'
  },
  cellTextSemMA: {
    fontSize: 13,
    fontWeight: '600',
    color: '#173F35'
  },
  cellMuted: {
    fontSize: 12,
    color: colors.muted
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 12,
    color: colors.muted
  },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceHover,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  footerLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text
  },
  footerValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text
  },
  tableFooterMA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHover,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  footerValueMA: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F766E'
  },
  footerValueSemMA: {
    fontSize: 14,
    fontWeight: '800',
    color: '#173F35'
  },
  btnAdicionarLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6
  },
  btnAdicionarLinhaTexto: {
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
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: 8
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
  datasRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4
  },
  modalBotoes: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
    alignItems: 'center'
  },
  btnExcluir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
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
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  btnCancelarTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted
  },
  btnSalvar: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: colors.primary
  },
  btnSalvarTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff'
  }
})
