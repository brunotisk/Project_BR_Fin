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
  carregarFechamento,
  carregarMesFechamentoSelecionado,
  FECHAMENTO_INICIAL,
  salvarFechamento,
  salvarMesFechamentoSelecionado
} from '../services/planilhasService'
import { FechamentoMensal } from '../types'

export function FechamentoScreen() {
  const [mesAtual, setMesAtual] = useState(carregarMesFechamentoSelecionado())
  const [fechamento, setFechamento] = useState<FechamentoMensal>(FECHAMENTO_INICIAL)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modal para editar um campo específico
  const [modalVisible, setModalVisible] = useState(false)
  const [campoEditando, setCampoEditando] = useState<{
    chave: keyof FechamentoMensal
    label: string
    valorAtual: number
  } | null>(null)
  const [valorInput, setValorInput] = useState('')

  const carregar = useCallback(async (mes: string) => {
    try {
      const data = await carregarFechamento(mes)
      setFechamento(data)
    } catch (err) {
      console.warn('Erro ao carregar fechamento:', err)
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

  // Cálculo da necessidade:
  // Saídas: Cartões + Contas
  // Entradas/Disponível: Dinheiro + PIX (Cair) + Conta Corrente + Salário
  // Necessário = Saídas - Disponível
  const totalSaidas = Number(fechamento.valor_cartoes || 0) + Number(fechamento.valor_contas || 0)
  const totalDisponivel =
    Number(fechamento.valor_dinheiro || 0) +
    Number(fechamento.valor_pix || 0) +
    Number(fechamento.valor_conta_corrente || 0) +
    Number(fechamento.valor_salario || 0)

  const valorNecessarioCalculado = Math.max(0, totalSaidas - totalDisponivel)

  const abrirEdicao = (chave: keyof FechamentoMensal, label: string, valorAtual: number) => {
    setCampoEditando({ chave, label, valorAtual })
    setValorInput(valorAtual > 0 ? valorAtual.toString() : '')
    setModalVisible(true)
  }

  const salvarEdicaoCampo = async () => {
    if (!campoEditando) return
    const novoNum = parseFloat(valorInput.replace(',', '.')) || 0

    const atualizado: FechamentoMensal = {
      ...fechamento,
      mes_ano: mesAtual,
      [campoEditando.chave]: novoNum
    }

    const saidas =
      (campoEditando.chave === 'valor_cartoes' ? novoNum : fechamento.valor_cartoes) +
      (campoEditando.chave === 'valor_contas' ? novoNum : fechamento.valor_contas)

    const disponivel =
      (campoEditando.chave === 'valor_dinheiro' ? novoNum : fechamento.valor_dinheiro) +
      (campoEditando.chave === 'valor_pix' ? novoNum : fechamento.valor_pix) +
      (campoEditando.chave === 'valor_conta_corrente' ? novoNum : fechamento.valor_conta_corrente) +
      (campoEditando.chave === 'valor_salario' ? novoNum : fechamento.valor_salario)

    atualizado.valor_necessario = Math.max(0, saidas - disponivel)

    setFechamento(atualizado)
    setModalVisible(false)
    setCampoEditando(null)

    await salvarFechamento(atualizado)
    notify('Atualizado', `${campoEditando.label} atualizado com sucesso!`)
  }

  const mesesDisponiveis = ['Outubro', 'Novembro', 'Dezembro', 'Janeiro']

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(mesAtual) }} />}
      >
        {/* Topo / Título com Mês Selecionado */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{mesAtual} Fechamento</Text>
            <Text style={styles.headerSubtitle}>
              Apuração Mensal de Contas vs Disponibilidades ({mesAtual})
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

        {/* Cartões KPI Resumo */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { borderLeftColor: colors.expense }]}>
            <Text style={styles.kpiLabel}>Total a Pagar</Text>
            <Text style={[styles.kpiValue, { color: colors.expense }]}>
              {formatCurrency(totalSaidas)}
            </Text>
            <Text style={styles.kpiHint}>Cartões + Contas</Text>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: colors.income }]}>
            <Text style={styles.kpiLabel}>Disponibilidades</Text>
            <Text style={[styles.kpiValue, { color: colors.income }]}>
              {formatCurrency(totalDisponivel)}
            </Text>
            <Text style={styles.kpiHint}>Dinheiro, PIX, CC e Salário</Text>
          </View>
        </View>

        {/* TABELA IDÊNTICA À PLANILHA */}
        <View style={styles.tableCard}>
          {/* Cabeçalho da Tabela */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colHeader, { flex: 1.4 }]}>Contas</Text>
            <Text style={[styles.colHeader, styles.colHeaderRight, { flex: 1 }]}>Valor</Text>
          </View>

          {/* Linha 1: Cartões */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={() => abrirEdicao('valor_cartoes', 'Valor Cartões', fechamento.valor_cartoes)}
          >
            <View style={styles.cellWithIcon}>
              <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="card" size={16} color="#0284C7" />
              </View>
              <Text style={styles.rowLabel}>Valor Cartões</Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={styles.rowValue}>
                {fechamento.valor_cartoes > 0 ? formatCurrency(fechamento.valor_cartoes) : '-'}
              </Text>
              <Ionicons name="pencil" size={14} color={colors.muted} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          {/* Linha 2: Contas */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={() => abrirEdicao('valor_contas', 'Valor Contas', fechamento.valor_contas)}
          >
            <View style={styles.cellWithIcon}>
              <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="receipt-outline" size={16} color={colors.expense} />
              </View>
              <Text style={styles.rowLabel}>Valor Contas</Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={styles.rowValue}>
                {fechamento.valor_contas > 0 ? formatCurrency(fechamento.valor_contas) : '-'}
              </Text>
              <Ionicons name="pencil" size={14} color={colors.muted} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          {/* Linha 3: Dinheiro */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={() => abrirEdicao('valor_dinheiro', 'Valor Dinheiro', fechamento.valor_dinheiro)}
          >
            <View style={styles.cellWithIcon}>
              <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="cash-outline" size={16} color={colors.income} />
              </View>
              <Text style={styles.rowLabel}>Valor Dinheiro</Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={styles.rowValue}>
                {fechamento.valor_dinheiro > 0 ? formatCurrency(fechamento.valor_dinheiro) : '-'}
              </Text>
              <Ionicons name="pencil" size={14} color={colors.muted} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          {/* Linha 4: PIX (Cair) */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={() => abrirEdicao('valor_pix', 'Valor PIX (Cair)', fechamento.valor_pix)}
          >
            <View style={styles.cellWithIcon}>
              <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="flash-outline" size={16} color="#D97706" />
              </View>
              <Text style={styles.rowLabel}>Valor PIX (Cair)</Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={styles.rowValue}>
                {fechamento.valor_pix > 0 ? formatCurrency(fechamento.valor_pix) : '-'}
              </Text>
              <Ionicons name="pencil" size={14} color={colors.muted} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          {/* Linha 5: Conta Corrente */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={() => abrirEdicao('valor_conta_corrente', 'Valor Conta Corrente', fechamento.valor_conta_corrente)}
          >
            <View style={styles.cellWithIcon}>
              <View style={[styles.iconCircle, { backgroundColor: '#E0E7FF' }]}>
                <Ionicons name="business-outline" size={16} color="#4F46E5" />
              </View>
              <Text style={styles.rowLabel}>Valor Conta Corrente</Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={styles.rowValue}>
                {fechamento.valor_conta_corrente > 0 ? formatCurrency(fechamento.valor_conta_corrente) : '-'}
              </Text>
              <Ionicons name="pencil" size={14} color={colors.muted} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          {/* Linha 6: Salário */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={() => abrirEdicao('valor_salario', 'Valor Salário', fechamento.valor_salario)}
          >
            <View style={styles.cellWithIcon}>
              <View style={[styles.iconCircle, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="wallet-outline" size={16} color="#9333EA" />
              </View>
              <Text style={styles.rowLabel}>Valor Salário</Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={styles.rowValue}>
                {fechamento.valor_salario > 0 ? formatCurrency(fechamento.valor_salario) : '-'}
              </Text>
              <Ionicons name="pencil" size={14} color={colors.muted} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          {/* LINHA DE DESTAQUE: VALOR NECESSÁRIO (Destaque Coral como na Imagem) */}
          <View style={styles.necessarioRow}>
            <View style={styles.cellWithIcon}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={styles.necessarioLabel}>Valor Necessário</Text>
            </View>
            <Text style={styles.necessarioValor}>
              {formatCurrency(valorNecessarioCalculado)}
            </Text>
          </View>
        </View>

        {/* Card Informativo */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Dados relativos ao mês de <Text style={{ fontWeight: '700' }}>{mesAtual}</Text>. Toque em qualquer linha da tabela para alterar o valor.
          </Text>
        </View>
      </ScrollView>

      {/* Modal de Edição de Campo */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Editar {campoEditando?.label}</Text>
            <Text style={styles.modalSub}>Informe o valor para {mesAtual} em reais (R$):</Text>

            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              placeholder="0,00"
              value={valorInput}
              onChangeText={setValorInput}
              autoFocus
            />

            <View style={styles.modalBotoes}>
              <TouchableOpacity
                style={styles.modalBotaoCancelar}
                onPress={() => { setModalVisible(false); setCampoEditando(null) }}
              >
                <Text style={styles.modalBotaoCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalBotaoSalvar}
                onPress={salvarEdicaoCampo}
              >
                <Text style={styles.modalBotaoSalvarTexto}>Confirmar</Text>
              </TouchableOpacity>
            </View>
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
    paddingBottom: 32
  },
  header: {
    marginBottom: 10
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2
  },
  mesSelectorRow: {
    marginBottom: 16
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
  kpiGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4
  },
  kpiLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600'
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 4
  },
  kpiHint: {
    fontSize: 10,
    color: colors.muted
  },
  tableCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  colHeader: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14
  },
  colHeaderRight: {
    textAlign: 'right'
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  cellWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  necessarioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 2,
    borderTopColor: '#FDBA74'
  },
  necessarioLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#DC2626',
    marginLeft: 4
  },
  necessarioValor: {
    fontSize: 18,
    fontWeight: '900',
    color: '#DC2626'
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: 12,
    borderRadius: 10,
    gap: 10
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18
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
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6
  },
  modalTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text
  },
  modalSub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 16
  },
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20
  },
  modalBotoes: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end'
  },
  modalBotaoCancelar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  modalBotaoCancelarTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted
  },
  modalBotaoSalvar: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary
  },
  modalBotaoSalvarTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff'
  }
})
