import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../services/supabase'
import { Categoria, CartaoCredito } from '../types'
import { colors } from '../theme'
import { formatarData, hojeISO } from '../utils/datas'
import { Input } from '../components/Input'
import { OptionSelector } from '../components/OptionSelector'
import { Button } from '../components/Button'
import { notify } from '../utils/notify'

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export function NovaTransacaoScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const hoje = hojeISO()
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [dataTransacao, setDataTransacao] = useState(hoje)
  const [mesCalendario, setMesCalendario] = useState(hoje.slice(0, 7))
  const [calendarioAberto, setCalendarioAberto] = useState(false)
  const [cartaoId, setCartaoId] = useState('')
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [observacao, setObservacao] = useState('')
  const [status, setStatus] = useState<'confirmado' | 'pendente'>('confirmado')

  const [isParcelado, setIsParcelado] = useState(false)
  const [totalParcelas, setTotalParcelas] = useState('2')
  const [primeiroVencimento, setPrimeiroVencimento] = useState(hoje)

  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(false)
  const [erros, setErros] = useState<{ [key: string]: string }>({})

  const diasCalendario = useMemo(() => {
    const [ano, mes] = mesCalendario.split('-').map(Number)
    const primeiroDia = new Date(ano, mes - 1, 1).getDay()
    const totalDias = new Date(ano, mes, 0).getDate()
    return [...Array.from({ length: primeiroDia }, () => 0), ...Array.from({ length: totalDias }, (_, indice) => indice + 1)]
  }, [mesCalendario])

  useEffect(() => {
    async function carregarDados() {
      const [resCartoes, resCategorias] = await Promise.all([
        supabase.from('cartoes_credito').select('*').eq('ativo', true).order('criado_em', { ascending: true }),
        supabase.from('categorias').select('*').eq('tipo', 'despesa').order('nome')
      ])
      if (resCartoes.error) console.warn('Não foi possível carregar cartões:', resCartoes.error.message)
      if (resCategorias.error) console.warn('Não foi possível carregar categorias:', resCategorias.error.message)
      if (resCartoes.data) {
        const lista = resCartoes.data as CartaoCredito[]
        setCartoes(lista)
        if (lista.length) setCartaoId(lista[0].id)
      }
      if (resCategorias.data) setCategorias(resCategorias.data as Categoria[])
    }
    void carregarDados()
  }, [])

  const deslocarMesCalendario = (passo: number) => {
    const [ano, mes] = mesCalendario.split('-').map(Number)
    const indice = ano * 12 + mes - 1 + passo
    const novoAno = Math.floor(indice / 12)
    const novoMes = (indice % 12) + 1
    setMesCalendario(`${novoAno}-${String(novoMes).padStart(2, '0')}`)
  }

  const selecionarDia = (dia: number) => {
    const [ano, mes] = mesCalendario.split('-')
    setDataTransacao(`${ano}-${mes}-${String(dia).padStart(2, '0')}`)
    setCalendarioAberto(false)
  }

  async function handleSalvar() {
    const novosErros: { [key: string]: string } = {}
    if (!descricao.trim()) novosErros.descricao = 'Informe uma descrição'

    const valorNum = Number(valor.replace(',', '.'))
    if (isNaN(valorNum) || valorNum <= 0) novosErros.valor = 'Informe um valor maior que zero'
    if (!cartaoId) novosErros.cartaoId = 'Selecione um cartão'
    if (!dataTransacao.trim()) novosErros.data = 'Selecione a data do lançamento'

    if (isParcelado) {
      const numParcelas = parseInt(totalParcelas, 10)
      if (isNaN(numParcelas) || numParcelas < 2) novosErros.parcelas = 'Informe no mínimo 2 parcelas'
      if (!primeiroVencimento.trim()) novosErros.vencimento = 'Informe a data do 1º vencimento'
    }

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros)
      return
    }

    setLoading(true)
    setErros({})

    try {
      if (isParcelado) {
        const { data: transacaoId, error } = await supabase.rpc('criar_transacao_parcelada_cartao', {
          p_cartao_id: cartaoId,
          p_categoria_id: categoriaId,
          p_descricao: descricao.trim(),
          p_valor_total: valorNum,
          p_total_parcelas: parseInt(totalParcelas, 10),
          p_primeiro_vencimento: primeiroVencimento,
          p_data: dataTransacao,
          p_observacao: observacao.trim() || null
        })
        if (error) throw error
        if (!transacaoId) throw new Error('A compra foi criada sem retornar o identificador para as parcelas.')
        notify('Sucesso!', 'Compra parcelada no cartão criada com todas as parcelas calculadas!')
      } else {
        const { error } = await supabase.from('transacoes').insert({
          conta_id: null,
          cartao_id: cartaoId,
          categoria_id: categoriaId,
          tipo: 'despesa',
          descricao: descricao.trim(),
          valor: valorNum,
          data: dataTransacao,
          status,
          observacao: observacao.trim() || null
        })
        if (error) throw error
        notify('Sucesso!', 'Despesa registrada com sucesso!')
      }
      navigation.goBack()
    } catch (err: any) {
      notify('Erro ao salvar', err?.message || 'Falha ao registrar a transação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nova Despesa</Text>
      <Text style={styles.subtitle}>Registre uma despesa no cartão ou parcele a compra.</Text>

      <View style={styles.form}>
        <Input
          label="Descrição *"
          placeholder="Ex: Supermercado, aluguel, combustível"
          value={descricao}
          onChangeText={setDescricao}
          error={erros.descricao}
        />

        <Input
          label="Valor (R$) *"
          placeholder="0,00"
          keyboardType="numeric"
          prefix="R$"
          value={valor}
          onChangeText={setValor}
          error={erros.valor}
        />

        <View style={styles.section}>
          <Text style={styles.label}>Data da despesa *</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Escolher data da despesa" style={styles.dateButton} onPress={() => setCalendarioAberto((aberto) => !aberto)}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={styles.dateButtonText}>{formatarData(dataTransacao)}</Text>
            <Ionicons name={calendarioAberto ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
          </TouchableOpacity>
          {erros.data ? <Text style={styles.errorText}>{erros.data}</Text> : null}
          {calendarioAberto && <View style={styles.calendarPanel}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity accessibilityLabel="Mês anterior" style={styles.calendarNav} onPress={() => deslocarMesCalendario(-1)}><Ionicons name="chevron-back" size={18} color={colors.primary} /></TouchableOpacity>
              <Text style={styles.calendarTitle}>{MESES[Number(mesCalendario.slice(5, 7)) - 1]} {mesCalendario.slice(0, 4)}</Text>
              <TouchableOpacity accessibilityLabel="Próximo mês" style={styles.calendarNav} onPress={() => deslocarMesCalendario(1)}><Ionicons name="chevron-forward" size={18} color={colors.primary} /></TouchableOpacity>
            </View>
            <View style={styles.calendarGrid}>
              {DIAS_SEMANA.map((dia, indice) => <Text key={`semana-${indice}`} style={styles.calendarWeekday}>{dia}</Text>)}
              {diasCalendario.map((dia, indice) => {
                if (!dia) return <View key={`vazio-${indice}`} style={styles.calendarDayEmpty} />
                const selecionado = dataTransacao === `${mesCalendario}-${String(dia).padStart(2, '0')}`
                return <TouchableOpacity key={dia} accessibilityRole="button" accessibilityState={{ selected: selecionado }} style={[styles.calendarDay, selecionado && styles.calendarDaySelected]} onPress={() => selecionarDia(dia)}><Text style={[styles.calendarDayText, selecionado && styles.calendarDayTextSelected]}>{dia}</Text></TouchableOpacity>
              })}
            </View>
            <TouchableOpacity style={styles.todayButton} onPress={() => { const dataHoje = hojeISO(); setDataTransacao(dataHoje); setMesCalendario(dataHoje.slice(0, 7)); setCalendarioAberto(false) }}>
              <Text style={styles.todayButtonText}>Usar hoje</Text>
            </TouchableOpacity>
          </View>}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Cartão *</Text>
          {cartoes.length === 0 ? (
            <View style={styles.alerta}>
              <Text style={styles.alertaTexto}>Nenhum cartão ativo cadastrado.</Text>
              <TouchableOpacity onPress={() => navigation.navigate('LimitesCartoes')}><Text style={styles.linkTexto}>+ Cadastrar Cartão</Text></TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsScroll}>
              {cartoes.map((cartao) => {
                const selecionado = cartao.id === cartaoId
                const cor = cartao.cor || colors.primary
                return <TouchableOpacity key={cartao.id} accessibilityRole="button" accessibilityState={{ selected: selecionado }} accessibilityLabel={`Selecionar cartão ${cartao.nome}`} onPress={() => setCartaoId(cartao.id)} style={[styles.cardOption, { backgroundColor: cor }, selecionado && styles.cardOptionSelected]}>
                  <View style={styles.cardOrb} />
                  <View style={styles.cardTop}><Ionicons name="hardware-chip-outline" size={25} color="#fff" /><Text style={styles.cardBrand}>{cartao.bandeira.toUpperCase()}</Text></View>
                  <View style={styles.cardBottom}>
                    <View style={{ flex: 1 }}><Text style={styles.cardEyebrow}>CARTÃO DE CRÉDITO</Text><Text numberOfLines={1} style={styles.cardName}>{cartao.nome}</Text></View>
                    {selecionado && <Ionicons name="checkmark-circle" size={21} color="#fff" />}
                  </View>
                </TouchableOpacity>
              })}
            </ScrollView>
          )}
          {erros.cartaoId ? <Text style={styles.errorText}>{erros.cartaoId}</Text> : null}
        </View>

        <View style={styles.section}>
          <View style={styles.rowJustify}>
            <Text style={styles.label}>Categoria da despesa</Text>
            <TouchableOpacity onPress={() => navigation.navigate('NovaCategoria')}><Text style={styles.linkTexto}>+ Nova Categoria</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            <TouchableOpacity onPress={() => setCategoriaId(null)} style={[styles.chip, !categoriaId && styles.chipAtivo]}><Text style={[styles.chipTexto, !categoriaId && styles.chipTextoAtivo]}>Sem categoria</Text></TouchableOpacity>
            {categorias.map((cat) => {
              const selecionada = cat.id === categoriaId
              return <TouchableOpacity key={cat.id} onPress={() => setCategoriaId(cat.id)} style={[styles.chip, selecionada && { borderColor: cat.cor || colors.primary, backgroundColor: (cat.cor || colors.primary) + '20' }]}><Text style={[styles.chipTexto, selecionada && { fontWeight: '700', color: colors.text }]}>{cat.nome}</Text></TouchableOpacity>
            })}
          </ScrollView>
        </View>

        <OptionSelector
          label="Situação do Lançamento"
          options={[{ label: 'Confirmado / Pago', value: 'confirmado' }, { label: 'Pendente / Agendado', value: 'pendente' }]}
          selectedValue={status}
          onSelect={(situacao) => setStatus(situacao as 'confirmado' | 'pendente')}
        />

        <View style={styles.parcelamentoCard}>
          <View style={styles.rowBetween}>
            <View><Text style={styles.parcelamentoTitulo}>Parcelar esta compra?</Text><Text style={styles.parcelamentoDesc}>Gera as parcelas mensais automaticamente</Text></View>
            <Switch value={isParcelado} onValueChange={setIsParcelado} trackColor={{ false: colors.border, true: colors.primary }} />
          </View>
          {isParcelado && <View style={styles.parcelasCampos}>
            <Input label="Quantidade de Parcelas" placeholder="Ex: 3" keyboardType="numeric" value={totalParcelas} onChangeText={setTotalParcelas} error={erros.parcelas} />
            <Input label="Data do 1º Vencimento (AAAA-MM-DD)" placeholder="2026-10-03" value={primeiroVencimento} onChangeText={setPrimeiroVencimento} error={erros.vencimento} />
          </View>}
        </View>

        <Input label="Observações / Anotações" placeholder="Detalhes adicionais (opcional)" value={observacao} onChangeText={setObservacao} multiline numberOfLines={2} />

        <View style={styles.actions}>
          <Button title="Salvar Despesa" onPress={handleSalvar} loading={loading} />
          <Button title="Cancelar" onPress={() => navigation.goBack()} variant="secondary" />
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.background, minHeight: '100%' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 20 },
  form: { backgroundColor: colors.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.border, gap: 16 },
  section: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowJustify: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkTexto: { fontSize: 13, fontWeight: '600', color: colors.primary },
  dateButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  dateButtonText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  calendarPanel: { padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 5 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarNav: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.primaryLight },
  calendarTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarWeekday: { width: '14.2857%', paddingVertical: 5, textAlign: 'center', color: colors.muted, fontSize: 11, fontWeight: '700' },
  calendarDayEmpty: { width: '14.2857%', height: 36 },
  calendarDay: { width: '14.2857%', height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  calendarDaySelected: { backgroundColor: colors.primary },
  calendarDayText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  calendarDayTextSelected: { color: '#fff', fontWeight: '800' },
  todayButton: { alignSelf: 'center', padding: 7 },
  todayButtonText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  cardsScroll: { gap: 10, paddingVertical: 3 },
  cardOption: { width: 210, minHeight: 112, padding: 13, borderRadius: 13, justifyContent: 'space-between', overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  cardOptionSelected: { borderColor: '#fff', elevation: 4 },
  cardOrb: { position: 'absolute', width: 120, height: 120, borderRadius: 60, right: -42, top: -25, backgroundColor: 'rgba(255,255,255,0.12)' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBrand: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  cardBottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 9 },
  cardEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  cardName: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 3 },
  chipsScroll: { gap: 8, paddingVertical: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipAtivo: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipTexto: { fontSize: 13, color: colors.muted },
  chipTextoAtivo: { color: colors.primary, fontWeight: '700' },
  alerta: { padding: 12, backgroundColor: colors.warningLight, borderRadius: 8, borderWidth: 1, borderColor: colors.warning, gap: 6 },
  alertaTexto: { fontSize: 13, color: colors.text },
  parcelamentoCard: { backgroundColor: colors.background, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  parcelamentoTitulo: { fontSize: 14, fontWeight: '600', color: colors.text },
  parcelamentoDesc: { fontSize: 12, color: colors.muted },
  parcelasCampos: { gap: 10, marginTop: 6 },
  errorText: { fontSize: 12, color: colors.expense },
  actions: { marginTop: 10, gap: 10 }
})
