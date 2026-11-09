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
import { notify } from '../utils/notify'
import {
  carregarCartoesControle,
  carregarMesFechamentoSelecionado,
  CARTOES_DETALHADOS_INICIAIS,
  CARTOES_VIGENTES_INICIAIS,
  gerarUuidPoker,
  salvarCartoesControle,
  salvarMesFechamentoSelecionado
} from '../services/planilhasService'
import { CartaoControleItem } from '../types'

const NOMES_MESES_CONTROLE = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MESES_ABREVIADOS_CONTROLE = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const NUMERO_MES_CONTROLE: Record<string, number> = Object.fromEntries(NOMES_MESES_CONTROLE.map((nome, indice) => [nome.toLowerCase(), indice + 1]))

function mesReferenciaParaChave(mesReferencia: string) {
  const [nomeMes, anoTexto] = mesReferencia.trim().split(/\s+/)
  const numeroMes = NUMERO_MES_CONTROLE[nomeMes.toLowerCase()]
  return numeroMes && anoTexto ? `${anoTexto}-${String(numeroMes).padStart(2, '0')}` : hojeControleSP().slice(0, 7)
}

function hojeControleSP() {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const parte = (tipo: string) => partes.find((item) => item.type === tipo)?.value || '01'
  return `${parte('year')}-${parte('month')}-${parte('day')}`
}

function formatarDataControle(valor: string) {
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!iso) return valor
  return `${iso[3]}/${MESES_ABREVIADOS_CONTROLE[Number(iso[2]) - 1]}/${iso[1]}`
}

function formatarDiaMesControle(valor: string) {
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return `${iso[3]}/${MESES_ABREVIADOS_CONTROLE[Number(iso[2]) - 1]}`
  const legado = valor.match(/^(\d{1,2})[\/-]([a-zç]+|\d{1,2})(?:[\/-]\d{2,4})?$/i)
  return legado ? `${legado[1].padStart(2, '0')}/${legado[2].slice(0, 3).toLowerCase()}` : valor
}

function formatarMoedaSemCentavos(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(valor) || 0)
}

function dataLegadaParaISO(valor: string, mesPadrao: string) {
  const iso = valor.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const legado = valor.trim().toLowerCase().match(/^(\d{1,2})[\/-]([a-zç]+|\d{1,2})(?:[\/-](\d{2,4}))?$/i)
  if (!legado) return ''
  const numeroMes = /^\d+$/.test(legado[2]) ? Number(legado[2]) : (MESES_ABREVIADOS_CONTROLE.indexOf(legado[2].slice(0, 3)) + 1)
  if (numeroMes < 1 || numeroMes > 12) return ''
  const anoPadrao = mesPadrao.slice(0, 4)
  const ano = legado[3] ? Number(legado[3].length === 2 ? `20${legado[3]}` : legado[3]) : Number(anoPadrao)
  return `${ano}-${String(numeroMes).padStart(2, '0')}-${String(Number(legado[1])).padStart(2, '0')}`
}

function obterOpcoesMesesControle() {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: 'numeric' }).formatToParts(new Date())
  const anoAtual = Number(partes.find((parte) => parte.type === 'year')?.value)
  const numeroMesAtual = Number(partes.find((parte) => parte.type === 'month')?.value)
  return [-1, 0, 1].map((deslocamento) => {
    const indice = anoAtual * 12 + numeroMesAtual - 1 + deslocamento
    const ano = Math.floor(indice / 12)
    const numeroMes = (indice % 12) + 1
    return { valor: `${NOMES_MESES_CONTROLE[numeroMes - 1]} ${ano}`, mes: NOMES_MESES_CONTROLE[numeroMes - 1], titulo: deslocamento === -1 ? 'Mês anterior' : deslocamento === 0 ? 'Mês atual' : 'Mês seguinte' }
  })
}

const OPCOES_MESES_CONTROLE = obterOpcoesMesesControle()

function normalizarMesSelecionado(mesSalvo: string) {
  return OPCOES_MESES_CONTROLE.find((opcao) => opcao.valor.toLowerCase() === mesSalvo.toLowerCase() || opcao.mes.toLowerCase() === mesSalvo.trim().toLowerCase())?.valor || OPCOES_MESES_CONTROLE[1].valor
}

export function CartoesControleScreen() {
  const [mesAtual, setMesAtual] = useState(() => normalizarMesSelecionado(carregarMesFechamentoSelecionado()))
  const [vigentes, setVigentes] = useState<CartaoControleItem[]>(CARTOES_VIGENTES_INICIAIS)
  const [detalhados, setDetalhados] = useState<CartaoControleItem[]>(CARTOES_DETALHADOS_INICIAIS)
  const [atualizadoEm, setAtualizadoEm] = useState('30/out')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [copiandoCartoes, setCopiandoCartoes] = useState(false)

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
  const [formFechamentoEstimado, setFormFechamentoEstimado] = useState(false)
  const [formStatus, setFormStatus] = useState<'aberto' | 'fechado'>('aberto')
  const [campoCalendario, setCampoCalendario] = useState<'fechamento' | 'pagamento' | null>(null)
  const [mesCalendario, setMesCalendario] = useState(() => mesReferenciaParaChave(mesAtual))

  const diasCalendario = useMemo(() => {
    const [ano, mes] = mesCalendario.split('-').map(Number)
    const primeiroDia = new Date(ano, mes - 1, 1).getDay()
    const totalDias = new Date(ano, mes, 0).getDate()
    return [...Array.from({ length: primeiroDia }, () => 0), ...Array.from({ length: totalDias }, (_, indice) => indice + 1)]
  }, [mesCalendario])

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
      const mesValido = normalizarMesSelecionado(mesSalvo)
      setMesAtual(mesValido)
      if (mesValido !== mesSalvo) salvarMesFechamentoSelecionado(mesValido)
      carregar(mesValido)
    }, [carregar])
  )

  const mudarMes = (novoMes: string) => {
    setMesAtual(novoMes)
    salvarMesFechamentoSelecionado(novoMes)
    carregar(novoMes)
  }

  const copiarCartoesDoMesAtual = async () => {
    const mesAtualReferencia = OPCOES_MESES_CONTROLE[1].valor
    if (mesAtual !== OPCOES_MESES_CONTROLE[2].valor || copiandoCartoes) return
    setCopiandoCartoes(true)
    try {
      const [origem, destino] = await Promise.all([
        carregarCartoesControle(mesAtualReferencia),
        carregarCartoesControle(mesAtual)
      ])
      const cartoesOrigem = [...origem.vigentes, ...origem.detalhados]
      const cartoesDestino = [...destino.vigentes, ...destino.detalhados]
      if (!cartoesOrigem.length) {
        notify('Nenhum cartão para copiar', `Não há cartões cadastrados em ${mesAtualReferencia}.`)
        return
      }
      const existentes = new Set(cartoesDestino.map((item) => `${item.tabela_tipo}|${item.cartao_nome.trim().toLowerCase()}`))
      const novos = cartoesOrigem.filter((item) => !existentes.has(`${item.tabela_tipo}|${item.cartao_nome.trim().toLowerCase()}`)).map((item) => ({
        ...item,
        id: gerarUuidPoker(),
        mes_referencia: mesAtual,
        status: 'aberto' as const
      }))
      if (!novos.length) {
        notify('Cartões já copiados', 'O mês seguinte já possui todos os cartões do mês atual.')
        return
      }
      const novosVigentes = [...destino.vigentes, ...novos.filter((item) => item.tabela_tipo === 'vigente')]
      const novosDetalhados = [...destino.detalhados, ...novos.filter((item) => item.tabela_tipo === 'detalhado_ma')]
      await salvarCartoesControle([...novosVigentes, ...novosDetalhados], mesAtual)
      setVigentes(novosVigentes)
      setDetalhados(novosDetalhados)
      notify('Cartões copiados', `${novos.length} cartão(ões) copiado(s) para ${mesAtual} com status Aberto.`)
    } catch (erro: any) {
      notify('Não foi possível copiar os cartões', erro?.message || 'Tente novamente.')
    } finally {
      setCopiandoCartoes(false)
    }
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
    setFormFechamentoEstimado(false)
    setFormStatus('aberto')
    setCampoCalendario(null)
    setMesCalendario(mesReferenciaParaChave(mesAtual))
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
    setFormFechamentoEstimado(item.fechamento_estimado || false)
    setFormStatus(item.status === 'fechado' ? 'fechado' : 'aberto')
    setCampoCalendario(null)
    setMesCalendario(mesReferenciaParaChave(item.fechamento || item.pagamento || mesAtual))
    setModalVisible(true)
  }

  const abrirCalendario = (campo: 'fechamento' | 'pagamento') => {
    const valor = campo === 'fechamento' ? formFechamento : formPagamento
    setMesCalendario(dataLegadaParaISO(valor, mesReferenciaParaChave(mesAtual)).slice(0, 7) || mesReferenciaParaChave(mesAtual))
    setCampoCalendario((atual) => atual === campo ? null : campo)
  }

  const selecionarData = (dia: number) => {
    const [ano, mes] = mesCalendario.split('-')
    const valor = `${ano}-${mes}-${String(dia).padStart(2, '0')}`
    if (campoCalendario === 'fechamento') setFormFechamento(valor)
    if (campoCalendario === 'pagamento') setFormPagamento(valor)
    setCampoCalendario(null)
  }

  const deslocarMesCalendario = (passo: number) => {
    const [ano, mes] = mesCalendario.split('-').map(Number)
    const novoIndice = ano * 12 + mes - 1 + passo
    setMesCalendario(`${Math.floor(novoIndice / 12)}-${String((novoIndice % 12) + 1).padStart(2, '0')}`)
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
      valor_ma: itemEditando?.valor_ma ?? valorMANum,
      valor_sem_ma: itemEditando?.valor_sem_ma ?? valorSemMANum,
      fechamento: formFechamento.trim(),
      pagamento: formPagamento.trim(),
      fechamento_estimado: formFechamentoEstimado,
      status: formStatus,
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

  const mesesDisponiveis = OPCOES_MESES_CONTROLE
  const itensDoMes = [...vigentes, ...detalhados].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  const totalAPagar = itensDoMes.reduce((total, item) => total + (Number(item.valor) || 0), 0)

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
            <Text style={styles.subtitle}>Controle de faturas · {mesAtual}</Text>
          </View>
        </View>

        {/* Seletor de mêsFechamento */}
        <View style={styles.mesSelectorRow}>
          <Text style={styles.mesSelectorLabel}>Período</Text>
          <View style={styles.monthChoiceRow}>
            {mesesDisponiveis.map((m) => (
              <TouchableOpacity
                key={m.valor}
                style={[styles.mesChip, mesAtual === m.valor && styles.mesChipActive]}
                onPress={() => mudarMes(m.valor)}
              >
                <Text style={[styles.mesChipText, mesAtual === m.valor && styles.mesChipTextActive]}>{m.titulo}</Text>
                <Text style={[styles.monthChoiceMonth, mesAtual === m.valor && styles.mesChipTextActive]}>{m.mes}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleBadge}>
            <Ionicons name="card-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>Faturas · {mesAtual}</Text>
          </View>
        </View>

        <View style={styles.tableCard}>
          <View style={styles.tableHeaderSky}>
            <Text style={[styles.colHeader, { flex: 1.25 }]}>Cartão</Text>
            <Text style={[styles.colHeader, styles.colCenter, { flex: 1.05 }]}>Valor{'\n'}Fechamento</Text>
            <Text style={[styles.colHeader, styles.colCenter, { flex: 1 }]}>Data{'\n'}Fechamento</Text>
            <Text style={[styles.colHeader, styles.colCenter, { flex: 1 }]}>Data{'\n'}Pagamento</Text>
            <Text style={[styles.colHeader, styles.colCenter, { flex: 0.85 }]}>Status</Text>
          </View>

          {itensDoMes.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.tableRow}
              onPress={() => abrirModalEditar(item)}
            >
              <Text numberOfLines={1} style={[styles.cellTextBold, { flex: 1.25 }]}>{item.cartao_nome}</Text>
              <Text numberOfLines={1} style={[styles.cellText, styles.colRight, { flex: 1.05 }]}>{item.valor > 0 ? formatarMoedaSemCentavos(item.valor) : '-'}</Text>
              <Text style={[styles.cellMuted, styles.colCenter, { flex: 1, fontStyle: item.fechamento_estimado ? 'italic' : 'normal' }]}>
                {item.fechamento ? <>{formatarDiaMesControle(item.fechamento)}{item.fechamento_estimado && <Text style={styles.estimatedAsterisk}>*</Text>}</> : '-'}
              </Text>
              <Text numberOfLines={1} style={[styles.cellMuted, styles.colCenter, { flex: 1 }]}>{item.pagamento ? formatarDiaMesControle(item.pagamento) : '-'}</Text>
              <View style={[styles.statusCell, { flex: 0.85 }]}><Text style={[styles.statusBadge, item.status === 'fechado' ? styles.statusClosed : styles.statusOpen]}>{item.status === 'fechado' ? 'Fechado' : 'Aberto'}</Text></View>
            </TouchableOpacity>
          ))}

          {itensDoMes.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhum cartão cadastrado para {mesAtual}.</Text>
            </View>
          )}
          <View style={styles.totalPagarRow}>
            <Text style={styles.totalPagarLabel}>Total a pagar</Text>
            <Text style={styles.totalPagarValor}>{formatarMoedaSemCentavos(totalAPagar)}</Text>
          </View>
        </View>

        {mesAtual === OPCOES_MESES_CONTROLE[2].valor && <TouchableOpacity accessibilityRole="button" disabled={copiandoCartoes} style={styles.copyCurrentButton} onPress={() => void copiarCartoesDoMesAtual()}>
          <Ionicons name="copy-outline" size={17} color={colors.primary} />
          <Text style={styles.copyCurrentButtonText}>{copiandoCartoes ? 'Copiando cartões…' : `Copiar cartões de ${OPCOES_MESES_CONTROLE[1].mes}`}</Text>
        </TouchableOpacity>}

        <TouchableOpacity
          style={styles.btnAdicionarLinha}
          onPress={() => abrirModalNovo('vigente')}
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.btnAdicionarLinhaTexto}>Adicionar cartão</Text>
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
              <Text style={styles.inputLabel}>Cartão</Text>
              <TextInput
                style={styles.input}
                placeholder="Nome do cartão"
                value={formNome}
                onChangeText={setFormNome}
              />

              <Text style={styles.inputLabel}>Valor</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={formValor}
                onChangeText={setFormValor}
              />

              <View style={styles.datasRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Fechamento</Text>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Selecionar data de fechamento" style={styles.dateInput} onPress={() => abrirCalendario('fechamento')}>
                    <Text style={[styles.dateInputText, !formFechamento && { color: colors.muted }]}>{formFechamento ? formatarDataControle(formFechamento) : 'Selecionar data'}</Text>
                    <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: formFechamentoEstimado }} style={styles.estimatedCheckbox} onPress={() => setFormFechamentoEstimado((marcado) => !marcado)}>
                    <Ionicons name={formFechamentoEstimado ? 'checkbox' : 'square-outline'} size={17} color={formFechamentoEstimado ? colors.primary : colors.muted} />
                    <Text style={styles.estimatedCheckboxText}>Data estimada</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Pagamento</Text>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Selecionar data de pagamento" style={styles.dateInput} onPress={() => abrirCalendario('pagamento')}>
                    <Text style={[styles.dateInputText, !formPagamento && { color: colors.muted }]}>{formPagamento ? formatarDataControle(formPagamento) : 'Selecionar data'}</Text>
                    <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {campoCalendario && <View style={styles.calendarPanel}>
                <View style={styles.calendarHeader}>
                  <TouchableOpacity accessibilityLabel="Mês anterior" style={styles.calendarNavButton} onPress={() => deslocarMesCalendario(-1)}><Ionicons name="chevron-back" size={18} color={colors.primary} /></TouchableOpacity>
                  <Text style={styles.calendarMonthTitle}>{NOMES_MESES_CONTROLE[Number(mesCalendario.slice(5, 7)) - 1]} {mesCalendario.slice(0, 4)}</Text>
                  <TouchableOpacity accessibilityLabel="Próximo mês" style={styles.calendarNavButton} onPress={() => deslocarMesCalendario(1)}><Ionicons name="chevron-forward" size={18} color={colors.primary} /></TouchableOpacity>
                </View>
                <View style={styles.calendarGrid}>
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dia, indice) => <Text key={`semana-${indice}`} style={styles.calendarWeekday}>{dia}</Text>)}
                  {diasCalendario.map((dia, indice) => {
                    if (!dia) return <View key={`vazio-${indice}`} style={styles.calendarDayEmpty} />
                    const [ano, mes] = mesCalendario.split('-')
                    const data = `${ano}-${mes}-${String(dia).padStart(2, '0')}`
                    const campoValor = campoCalendario === 'fechamento' ? formFechamento : formPagamento
                    const selecionado = dataLegadaParaISO(campoValor, mesReferenciaParaChave(mesAtual)) === data
                    return <TouchableOpacity key={data} accessibilityRole="button" accessibilityState={{ selected: selecionado }} style={[styles.calendarDayButton, selecionado && styles.calendarDayButtonSelected]} onPress={() => selecionarData(dia)}><Text style={[styles.calendarDayText, selecionado && styles.calendarDayTextSelected]}>{dia}</Text></TouchableOpacity>
                  })}
                </View>
                <View style={styles.calendarFooter}>
                  <TouchableOpacity onPress={() => { const hoje = hojeControleSP(); setMesCalendario(hoje.slice(0, 7)); if (campoCalendario === 'fechamento') setFormFechamento(hoje); if (campoCalendario === 'pagamento') setFormPagamento(hoje); setCampoCalendario(null) }}><Text style={styles.calendarTodayText}>Selecionar hoje</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setCampoCalendario(null)}><Text style={styles.calendarCloseText}>Fechar calendário</Text></TouchableOpacity>
                </View>
              </View>}

              <View style={styles.statusFormGroup}>
                <Text style={styles.inputLabel}>Status</Text>
                <View style={styles.statusChoices}>
                  {([['aberto', 'Aberto'], ['fechado', 'Fechado']] as const).map(([valor, rotulo]) => <TouchableOpacity key={valor} accessibilityRole="radio" accessibilityState={{ checked: formStatus === valor }} style={[styles.statusChoice, formStatus === valor && (valor === 'aberto' ? styles.statusChoiceOpenActive : styles.statusChoiceClosedActive)]} onPress={() => setFormStatus(valor)}><Text style={[styles.statusChoiceText, formStatus === valor && styles.statusChoiceTextActive]}>{rotulo}</Text></TouchableOpacity>)}
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
  monthChoiceRow: {
    flexDirection: 'row',
    gap: 8
  },
  mesChip: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3
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
  monthChoiceMonth: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600'
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
    alignItems: 'center',
    backgroundColor: '#38BDF8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 48
  },
  colHeader: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 11,
    lineHeight: 14
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
  estimatedAsterisk: {
    fontSize: 8,
    lineHeight: 9,
    fontWeight: '900',
    color: colors.text
  },
  statusCell: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusBadge: {
    overflow: 'hidden',
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderRadius: 7,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center'
  },
  statusOpen: {
    color: '#166534',
    backgroundColor: '#DCFCE7'
  },
  statusClosed: {
    color: '#475569',
    backgroundColor: '#E2E8F0'
  },
  totalPagarRow: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: colors.surfaceHover,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  totalPagarLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text
  },
  totalPagarValor: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.primary
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
  copyCurrentButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderFocus,
    borderRadius: 10,
    backgroundColor: colors.primaryLight
  },
  copyCurrentButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800'
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
    gap: 8,
    marginTop: 4
  },
  estimatedCheckbox: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4
  },
  estimatedCheckboxText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600'
  },
  statusFormGroup: {
    marginTop: 6
  },
  statusChoices: {
    flexDirection: 'row',
    gap: 8
  },
  statusChoice: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background
  },
  statusChoiceOpenActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC'
  },
  statusChoiceClosedActive: {
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1'
  },
  statusChoiceText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700'
  },
  statusChoiceTextActive: {
    color: colors.text
  },
  dateInput: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background
  },
  dateInputText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text
  },
  calendarPanel: {
    marginTop: 12,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHover
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  calendarNavButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  calendarMonthTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800'
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  calendarWeekday: {
    width: '14.2857%',
    height: 28,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800'
  },
  calendarDayEmpty: {
    width: '14.2857%',
    height: 34
  },
  calendarDayButton: {
    width: '14.2857%',
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9
  },
  calendarDayButtonSelected: {
    backgroundColor: colors.primary
  },
  calendarDayText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600'
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontWeight: '800'
  },
  calendarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  calendarTodayText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800'
  },
  calendarCloseText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700'
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
