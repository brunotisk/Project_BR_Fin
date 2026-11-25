import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../theme'
import { notify } from '../utils/notify'
import {
  carregarPlanejamento,
  gerarUuidPoker,
  salvarPlanejamento,
  type DadosPlanejamento,
  type LinhaPlanejamento,
  type SecaoPlanejamento
} from '../services/planilhasService'
import { useLayoutMode } from '../services/LayoutModeProvider'

const ROW_H = 38
const COL_NOME = 168
const COL_MES = 104
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const numeroFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function rotuloMes(mes: string) {
  const [ano, m] = mes.split('-')
  return `${MESES_ABREV[Number(m) - 1]}/${ano.slice(2)}`
}

function deslocarMes(mes: string, delta: number) {
  const [ano, m] = mes.split('-').map(Number)
  const d = new Date(ano, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Aceita "1.234,56", "1234.56", "-500", "(500)" e "R$ 10". Retorna null se vazio. */
function parseValor(texto: string): number | null {
  let t = texto.replace(/R\$|\s/g, '').trim()
  if (!t || t === '-') return null
  let negativo = false
  if (/^\(.*\)$/.test(t)) { negativo = true; t = t.slice(1, -1) }
  if (t.startsWith('-')) { negativo = !negativo; t = t.slice(1) }
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return negativo ? -n : n
}

function formatarCelula(valor: number, secao: SecaoPlanejamento | 'saldo') {
  if (!valor) return '-'
  if (secao === 'gasto') return valor > 0 ? `(${numeroFmt.format(valor)})` : numeroFmt.format(-valor)
  return valor < 0 ? `-${numeroFmt.format(-valor)}` : numeroFmt.format(valor)
}

function CelulaValor({ valor, secao, largura, onChange }: { valor: number | undefined; secao: SecaoPlanejamento; largura: number; onChange: (v: number | null) => void }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const v = valor || 0
  const negativo = v < 0
  return (
    <TextInput
      style={[styles.celula, { width: largura }, styles.celulaInput, editando && styles.celulaEditando, !editando && negativo && { color: colors.expense }]}
      value={editando ? texto : formatarCelula(v, secao)}
      onFocus={() => { setEditando(true); setTexto(v ? String(v).replace('.', ',') : '') }}
      onChangeText={setTexto}
      onBlur={() => { setEditando(false); onChange(parseValor(texto)) }}
      onSubmitEditing={() => { setEditando(false); onChange(parseValor(texto)) }}
      keyboardType="numbers-and-punctuation"
      selectTextOnFocus
      textAlign="right"
    />
  )
}

type EstadoSalvamento = 'ocioso' | 'salvando' | 'salvo' | 'erro'

export function PlanejamentoFinanceiroScreen() {
  const [plano, setPlano] = useState<DadosPlanejamento | null>(null)
  const [estado, setEstado] = useState<EstadoSalvamento>('ocioso')
  const [linhaEditando, setLinhaEditando] = useState<LinhaPlanejamento | null>(null)
  const [mesEditando, setMesEditando] = useState<string | null>(null)
  const [seletorMeses, setSeletorMeses] = useState(false)
  const { modo } = useLayoutMode()
  // No computador há espaço para colunas mais largas.
  const colMes = modo === 'desktop' ? 132 : COL_MES
  const colNome = modo === 'desktop' ? 240 : COL_NOME
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendente = useRef<DadosPlanejamento | null>(null)

  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

  useFocusEffect(useCallback(() => {
    let ativo = true
    setErroCarregamento(null)
    // Sem resposta em 20s, mostra erro em vez de deixar a tela girando para sempre.
    const limite = new Promise<never>((_, rejeitar) => setTimeout(() => rejeitar(new Error('O banco demorou demais para responder.')), 20000))
    Promise.race([carregarPlanejamento(), limite])
      .then((p) => { if (ativo && !pendente.current) setPlano(p) })
      .catch((err) => {
        console.warn('Erro ao carregar planejamento:', err)
        // Não cai para um plano vazio: o salvamento automático poderia sobrescrever o plano do banco.
        if (ativo) setErroCarregamento(err?.message || String(err))
      })
    return () => { ativo = false }
  }, [tentativa]))

  const salvarAgora = useCallback(async () => {
    const alvo = pendente.current
    if (!alvo) return
    pendente.current = null
    setEstado('salvando')
    try {
      await salvarPlanejamento(alvo)
      setEstado(pendente.current ? 'salvando' : 'salvo')
    } catch (err) {
      console.warn('Erro ao salvar planejamento:', err)
      setEstado('erro')
    }
  }, [])

  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); void salvarAgora() } }, [salvarAgora])

  const atualizar = useCallback((fn: (p: DadosPlanejamento) => DadosPlanejamento) => {
    setPlano((atual) => {
      if (!atual) return atual
      const novo = fn(atual)
      pendente.current = novo
      setEstado('salvando')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => { timer.current = null; void salvarAgora() }, 700)
      return novo
    })
  }, [salvarAgora])

  const entradas = useMemo(() => plano?.linhas.filter((l) => l.secao === 'entrada') ?? [], [plano])
  const gastos = useMemo(() => plano?.linhas.filter((l) => l.secao === 'gasto') ?? [], [plano])

  const totais = useMemo(() => {
    const meses = plano?.meses ?? []
    const soma = (linhas: LinhaPlanejamento[], mes: string) => linhas.reduce((acc, l) => acc + (l.valores[mes] || 0), 0)
    let acumulado = 0
    return meses.map((mes) => {
      const ent = soma(entradas, mes)
      const gas = soma(gastos, mes)
      const saldo = ent - gas
      acumulado += saldo
      return { mes, ent, gas, saldo, acumulado }
    })
  }, [plano, entradas, gastos])

  if (!plano) {
    return <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }]}>
      {erroCarregamento ? <>
        <Ionicons name="cloud-offline-outline" size={32} color={colors.expense} />
        <Text style={[styles.title, { fontSize: 16, textAlign: 'center' }]}>Não foi possível carregar o planejamento</Text>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>{erroCarregamento}</Text>
        <TouchableOpacity style={styles.botaoPrimario} onPress={() => { setErroCarregamento(null); setTentativa((t) => t + 1) }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Tentar novamente</Text>
        </TouchableOpacity>
      </> : <ActivityIndicator color={colors.primary} />}
    </View>
  }

  const setValor = (id: string, mes: string, v: number | null) => atualizar((p) => ({
    ...p,
    linhas: p.linhas.map((l) => {
      if (l.id !== id) return l
      const valores = { ...l.valores }
      if (v === null || v === 0) delete valores[mes]
      else valores[mes] = v
      return { ...l, valores }
    })
  }))

  const adicionarLinha = (secao: SecaoPlanejamento) => {
    const nova: LinhaPlanejamento = { id: gerarUuidPoker(), secao, nome: secao === 'entrada' ? 'Nova entrada' : 'Novo gasto', valores: {} }
    atualizar((p) => {
      // Insere após a última linha da mesma seção para manter o agrupamento.
      const ultimo = p.linhas.map((l) => l.secao).lastIndexOf(secao)
      const linhas = [...p.linhas]
      linhas.splice(ultimo + 1, 0, nova)
      return { ...p, linhas }
    })
    setLinhaEditando(nova)
  }

  const moverLinha = (id: string, direcao: -1 | 1) => atualizar((p) => {
    const linhas = [...p.linhas]
    const i = linhas.findIndex((l) => l.id === id)
    if (i < 0) return p
    // Procura a linha vizinha da mesma seção.
    let j = i + direcao
    while (j >= 0 && j < linhas.length && linhas[j].secao !== linhas[i].secao) j += direcao
    if (j < 0 || j >= linhas.length) return p
    ;[linhas[i], linhas[j]] = [linhas[j], linhas[i]]
    return { ...p, linhas }
  })

  const adicionarMes = (posicao: 'inicio' | 'fim') => atualizar((p) => {
    const base = p.meses.length ? (posicao === 'inicio' ? p.meses[0] : p.meses[p.meses.length - 1]) : mesAtual()
    if (!p.meses.length) return { ...p, meses: [base] }
    return { ...p, meses: posicao === 'inicio' ? [deslocarMes(base, -1), ...p.meses] : [...p.meses, deslocarMes(base, 1)] }
  })

  const removerMes = (mes: string) => {
    atualizar((p) => ({ ...p, meses: p.meses.filter((m) => m !== mes), mesesOcultos: (p.mesesOcultos ?? []).filter((m) => m !== mes) }))
    setMesEditando(null)
  }

  const copiarMesParaSeguintes = (mes: string) => {
    atualizar((p) => {
      const idx = p.meses.indexOf(mes)
      const seguintes = p.meses.slice(idx + 1)
      return {
        ...p,
        linhas: p.linhas.map((l) => {
          const valores = { ...l.valores }
          seguintes.forEach((m) => { if (l.valores[mes]) valores[m] = l.valores[mes]; else delete valores[m] })
          return { ...l, valores }
        })
      }
    })
    setMesEditando(null)
  }

  // Meses ocultos continuam no plano (e no saldo acumulado), só não aparecem na grade.
  const ocultos = new Set(plano.mesesOcultos ?? [])
  const visiveis = plano.meses.filter((m) => !ocultos.has(m))
  const totaisVisiveis = totais.filter((t) => !ocultos.has(t.mes))

  const definirOcultos = (fn: (meses: string[]) => string[]) => atualizar((p) => ({ ...p, mesesOcultos: fn(p.meses) }))
  const alternarMes = (mes: string) => atualizar((p) => {
    const atuais = new Set(p.mesesOcultos ?? [])
    if (atuais.has(mes)) atuais.delete(mes); else atuais.add(mes)
    return { ...p, mesesOcultos: p.meses.filter((m) => atuais.has(m)) }
  })
  const ocultarMes = (mes: string) => { alternarMes(mes); setMesEditando(null) }

  const textoEstado = estado === 'salvando' ? 'Salvando…' : estado === 'salvo' ? 'Salvo' : estado === 'erro' ? 'Erro ao salvar (mantido no aparelho)' : ''

  const renderNome = (l: LinhaPlanejamento, idx: number, total: number) => (
    <View key={l.id} style={[styles.nomeLinha]}>
      <TouchableOpacity style={{ flex: 1 }} onPress={() => setLinhaEditando(l)}>
        <Text style={styles.nomeTexto} numberOfLines={1}>{l.nome || '(sem nome)'}</Text>
      </TouchableOpacity>
      <TouchableOpacity disabled={idx === 0} onPress={() => moverLinha(l.id, -1)} hitSlop={6} style={styles.seta}>
        <Ionicons name="chevron-up" size={15} color={idx === 0 ? colors.border : colors.muted} />
      </TouchableOpacity>
      <TouchableOpacity disabled={idx === total - 1} onPress={() => moverLinha(l.id, 1)} hitSlop={6} style={styles.seta}>
        <Ionicons name="chevron-down" size={15} color={idx === total - 1 ? colors.border : colors.muted} />
      </TouchableOpacity>
    </View>
  )

  const linhaTotal = (valor: (t: typeof totais[number]) => number, secao: SecaoPlanejamento | 'saldo', destaque = false) => (
    <View style={styles.linhaMeses}>
      {totaisVisiveis.map((t) => {
        const v = valor(t)
        return <Text key={t.mes} style={[styles.celula, { width: colMes }, styles.celulaTotal, destaque && v < 0 && { color: colors.expense }, destaque && v > 0 && { color: colors.income }]}>{formatarCelula(v, secao)}</Text>
      })}
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* Largura mínima: no celular o título fica numa linha e os botões quebram para baixo,
            em vez de espremer o título até uma letra por linha. */}
        <View style={styles.headerTitulo}>
          <Text style={styles.title}>Planejamento</Text>
          <Text style={styles.subtitle}>Projeção mensal de entradas e gastos{textoEstado ? ` · ${textoEstado}` : ''}</Text>
        </View>
        <TouchableOpacity style={styles.botaoMes} onPress={() => setSeletorMeses(true)}>
          <Ionicons name="calendar-outline" size={14} color={colors.primary} /><Text style={styles.botaoMesTexto}> Meses ({visiveis.length}/{plano.meses.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.botaoMes} onPress={() => adicionarMes('inicio')}>
          <Ionicons name="add" size={14} color={colors.primary} /><Text style={styles.botaoMesTexto}>Mês antes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.botaoMes} onPress={() => adicionarMes('fim')}>
          <Ionicons name="add" size={14} color={colors.primary} /><Text style={styles.botaoMesTexto}>Mês depois</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.tabela}>
          {/* Coluna fixa com os nomes */}
          <View style={{ width: colNome }}>
            <View style={[styles.cabecalho, { width: colNome }]} />
            <View style={styles.secaoTitulo}><Text style={styles.secaoTexto}>Total Entradas</Text>
              <TouchableOpacity onPress={() => adicionarLinha('entrada')} hitSlop={6}><Ionicons name="add-circle-outline" size={20} color={colors.primary} /></TouchableOpacity>
            </View>
            {entradas.map((l, i) => renderNome(l, i, entradas.length))}
            <View style={styles.nomeLinha}><Text style={styles.nomeTotal}>Entradas</Text></View>
            <View style={styles.espaco} />
            <View style={styles.secaoTitulo}><Text style={styles.secaoTexto}>Total Gastos</Text>
              <TouchableOpacity onPress={() => adicionarLinha('gasto')} hitSlop={6}><Ionicons name="add-circle-outline" size={20} color={colors.primary} /></TouchableOpacity>
            </View>
            {gastos.map((l, i) => renderNome(l, i, gastos.length))}
            <View style={styles.nomeLinha}><Text style={styles.nomeTotal}>Gastos</Text></View>
            <View style={styles.espaco} />
            <View style={styles.nomeLinha}><Text style={styles.nomeTotal}>Saldo do mês</Text></View>
            <View style={styles.nomeLinha}><Text style={styles.nomeTotal}>Saldo acumulado</Text></View>
          </View>

          {/* Colunas de meses com rolagem horizontal */}
          <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}>
            <View>
              <View style={[styles.linhaMeses, styles.cabecalho]}>
                {visiveis.map((m) => (
                  <TouchableOpacity key={m} style={[styles.celula, { width: colMes, justifyContent: 'center' }]} onPress={() => setMesEditando(m)}>
                    <Text style={[styles.mesTexto, m === mesAtual() && { color: colors.primary }]}>{rotuloMes(m)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.secaoTitulo} />
              {entradas.map((l) => (
                <View key={l.id} style={styles.linhaMeses}>
                  {visiveis.map((m) => <CelulaValor key={m} valor={l.valores[m]} secao="entrada" largura={colMes} onChange={(v) => setValor(l.id, m, v)} />)}
                </View>
              ))}
              {linhaTotal((t) => t.ent, 'entrada')}
              <View style={styles.espaco} />
              <View style={styles.secaoTitulo} />
              {gastos.map((l) => (
                <View key={l.id} style={styles.linhaMeses}>
                  {visiveis.map((m) => <CelulaValor key={m} valor={l.valores[m]} secao="gasto" largura={colMes} onChange={(v) => setValor(l.id, m, v)} />)}
                </View>
              ))}
              {linhaTotal((t) => t.gas, 'gasto')}
              <View style={styles.espaco} />
              {linhaTotal((t) => t.saldo, 'saldo', true)}
              {linhaTotal((t) => t.acumulado, 'saldo', true)}
            </View>
          </ScrollView>
        </View>
        {visiveis.length === 0 && <Text style={[styles.dica, { color: colors.expense }]}>Nenhum mês selecionado. Toque em "Meses" para escolher quais aparecem.</Text>}
        <Text style={styles.dica}>Toque no nome para renomear, mudar de grupo ou excluir. Use as setas para reordenar. Gastos são digitados como valores positivos; em entradas, use "-" para descontos. Toque no mês para copiá-lo, ocultá-lo ou removê-lo. Em "Meses" você escolhe quais meses aparecem; o saldo acumulado considera também os ocultos.</Text>
      </ScrollView>

      <ModalLinha
        linha={linhaEditando}
        onFechar={() => setLinhaEditando(null)}
        onSalvar={(nova) => { atualizar((p) => ({ ...p, linhas: moverParaSecao(p.linhas, nova) })); setLinhaEditando(null) }}
        onExcluir={(id) => { atualizar((p) => ({ ...p, linhas: p.linhas.filter((l) => l.id !== id) })); setLinhaEditando(null) }}
        onReplicar={(id, valor) => atualizar((p) => ({
          ...p,
          linhas: p.linhas.map((l) => l.id !== id ? l : { ...l, valores: Object.fromEntries(p.meses.map((m) => [m, valor]).filter(([, v]) => v)) })
        }))}
      />

      <Modal visible={!!mesEditando} transparent animationType="fade" onRequestClose={() => setMesEditando(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMesEditando(null)}>
          <View style={styles.modal}>
            <Text style={styles.modalTitulo}>{mesEditando ? rotuloMes(mesEditando) : ''}</Text>
            <TouchableOpacity style={styles.acao} onPress={() => mesEditando && copiarMesParaSeguintes(mesEditando)}>
              <Ionicons name="copy-outline" size={18} color={colors.primary} /><Text style={styles.acaoTexto}>Copiar valores para os meses seguintes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acao} onPress={() => mesEditando && ocultarMes(mesEditando)}>
              <Ionicons name="eye-off-outline" size={18} color={colors.primary} /><Text style={styles.acaoTexto}>Ocultar da tela (mantém os valores)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acao} onPress={() => mesEditando && removerMes(mesEditando)}>
              <Ionicons name="trash-outline" size={18} color={colors.expense} /><Text style={[styles.acaoTexto, { color: colors.expense }]}>Remover coluna do mês</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={seletorMeses} transparent animationType="fade" onRequestClose={() => setSeletorMeses(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSeletorMeses(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modal}>
            <Text style={styles.modalTitulo}>Meses exibidos</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <TouchableOpacity style={styles.chip} onPress={() => definirOcultos(() => [])}><Text style={styles.chipTexto}>Todos</Text></TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={() => definirOcultos((meses) => meses.filter((m) => m < mesAtual()))}><Text style={styles.chipTexto}>A partir deste mês</Text></TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={() => definirOcultos((meses) => { const futuros = meses.filter((m) => m >= mesAtual()).slice(0, 3); return meses.filter((m) => !futuros.includes(m)) })}><Text style={styles.chipTexto}>Próximos 3</Text></TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={() => definirOcultos((meses) => { const futuros = meses.filter((m) => m >= mesAtual()).slice(0, 6); return meses.filter((m) => !futuros.includes(m)) })}><Text style={styles.chipTexto}>Próximos 6</Text></TouchableOpacity>
            </View>
            <Text style={styles.label}>Toque para mostrar ou ocultar</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {plano.meses.map((m) => {
                const ativo = !ocultos.has(m)
                return (
                  <TouchableOpacity key={m} onPress={() => alternarMes(m)} style={[styles.chip, styles.chipMes, ativo && styles.chipAtivo]}>
                    <Ionicons name={ativo ? 'checkmark' : 'eye-off-outline'} size={13} color={ativo ? '#fff' : colors.muted} />
                    <Text style={[styles.chipTexto, ativo ? { color: '#fff' } : { color: colors.muted }]}>{rotuloMes(m)}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <View style={[styles.modalRodape, { justifyContent: 'flex-end' }]}>
              <TouchableOpacity style={styles.botaoPrimario} onPress={() => setSeletorMeses(false)}><Text style={{ color: '#fff', fontWeight: '700' }}>Pronto</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

/**
 * Atualiza só nome e grupo da linha, preservando os valores atuais do estado
 * (o modal guarda uma cópia antiga da linha, que não inclui o "Aplicar").
 * Se mudou de grupo, move para o fim do novo grupo.
 */
function moverParaSecao(linhas: LinhaPlanejamento[], alteracao: Pick<LinhaPlanejamento, 'id' | 'nome' | 'secao'>) {
  const antiga = linhas.find((l) => l.id === alteracao.id)
  if (!antiga) return linhas
  const nova: LinhaPlanejamento = { ...antiga, nome: alteracao.nome, secao: alteracao.secao }
  if (antiga.secao === nova.secao) return linhas.map((l) => (l.id === nova.id ? nova : l))
  const sem = linhas.filter((l) => l.id !== nova.id)
  const ultimo = sem.map((l) => l.secao).lastIndexOf(nova.secao)
  sem.splice(ultimo + 1, 0, nova)
  return sem
}

function ModalLinha({ linha, onFechar, onSalvar, onExcluir, onReplicar }: {
  linha: LinhaPlanejamento | null
  onFechar: () => void
  onSalvar: (l: Pick<LinhaPlanejamento, 'id' | 'nome' | 'secao'>) => void
  onExcluir: (id: string) => void
  onReplicar: (id: string, valor: number) => void
}) {
  const [nome, setNome] = useState('')
  const [secao, setSecao] = useState<SecaoPlanejamento>('gasto')
  const [replicar, setReplicar] = useState('')
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  useEffect(() => {
    if (linha) { setNome(linha.nome); setSecao(linha.secao); setReplicar(''); setConfirmarExclusao(false) }
  }, [linha])

  if (!linha) return null
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFechar}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onFechar}>
        <TouchableOpacity activeOpacity={1} style={styles.modal}>
          <Text style={styles.modalTitulo}>Editar linha</Text>
          <Text style={styles.label}>Nome</Text>
          <TextInput style={styles.input} value={nome} onChangeText={setNome} autoFocus selectTextOnFocus />
          <Text style={styles.label}>Grupo</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['entrada', 'gasto'] as const).map((s) => (
              <TouchableOpacity key={s} onPress={() => setSecao(s)} style={[styles.chip, secao === s && styles.chipAtivo]}>
                <Text style={[styles.chipTexto, secao === s && { color: '#fff' }]}>{s === 'entrada' ? 'Entrada' : 'Gasto'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Mesmo valor em todos os meses</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[styles.input, { flex: 1 }]} value={replicar} onChangeText={setReplicar} placeholder="Ex.: 1.915,00" keyboardType="numbers-and-punctuation" />
            <TouchableOpacity style={styles.botaoSecundario} onPress={() => {
              const v = parseValor(replicar)
              if (v === null) { notify('Valor inválido', 'Digite um número, por exemplo 1.915,00.'); return }
              onReplicar(linha.id, v)
              notify('Pronto', 'Valor aplicado em todos os meses.')
            }}><Text style={styles.botaoSecundarioTexto}>Aplicar</Text></TouchableOpacity>
          </View>
          <View style={styles.modalRodape}>
            <TouchableOpacity onPress={() => confirmarExclusao ? onExcluir(linha.id) : setConfirmarExclusao(true)}>
              <Text style={{ color: colors.expense, fontWeight: '700' }}>{confirmarExclusao ? 'Confirmar exclusão' : 'Excluir linha'}</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.botaoSecundario} onPress={onFechar}><Text style={styles.botaoSecundarioTexto}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.botaoPrimario} onPress={() => onSalvar({ id: linha.id, nome: nome.trim() || linha.nome, secao })}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, paddingBottom: 10, flexWrap: 'wrap' },
  headerTitulo: { flexGrow: 1, flexShrink: 0, flexBasis: 260, minWidth: 0 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  botaoMes: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  botaoMesTexto: { fontSize: 12, fontWeight: '700', color: colors.primary },
  tabela: { flexDirection: 'row', marginHorizontal: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cabecalho: { height: ROW_H, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.primaryLight },
  linhaMeses: { flexDirection: 'row', height: ROW_H },
  celula: { width: COL_MES, height: ROW_H, paddingHorizontal: 8, fontSize: 13, color: colors.text, textAlign: 'right', textAlignVertical: 'center', lineHeight: ROW_H },
  celulaInput: { borderWidth: 0, outlineStyle: 'none' } as any,
  celulaEditando: { backgroundColor: '#FFF8E1', lineHeight: undefined },
  celulaTotal: { fontWeight: '800', borderTopWidth: 1, borderTopColor: colors.text },
  mesTexto: { fontSize: 13, fontWeight: '800', color: colors.text, textAlign: 'right', textDecorationLine: 'underline' },
  secaoTitulo: { height: ROW_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  secaoTexto: { fontSize: 13, fontWeight: '800', color: colors.text, textDecorationLine: 'underline' },
  nomeLinha: { height: ROW_H, flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 4, borderRightWidth: 1, borderRightColor: colors.border },
  nomeTexto: { fontSize: 13, color: colors.text },
  nomeTotal: { fontSize: 13, fontWeight: '800', color: colors.text },
  seta: { paddingHorizontal: 2 },
  espaco: { height: ROW_H / 2 },
  dica: { fontSize: 11, color: colors.muted, marginHorizontal: 16, marginTop: 10, lineHeight: 16 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: 14, padding: 18, gap: 6 },
  modalTitulo: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: colors.text, backgroundColor: colors.background },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  chipAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipMes: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10 },
  chipTexto: { fontSize: 13, fontWeight: '700', color: colors.text },
  acao: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  acaoTexto: { fontSize: 14, fontWeight: '600', color: colors.text },
  modalRodape: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  botaoPrimario: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  botaoSecundario: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, justifyContent: 'center' },
  botaoSecundarioTexto: { fontWeight: '700', color: colors.text }
})
