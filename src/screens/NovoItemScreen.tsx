import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { supabase } from '../services/supabase'
import { colors } from '../theme'
import { Input } from '../components/Input'
import { Button } from '../components/Button'
import { notify } from '../utils/notify'
import { hojeISO } from '../utils/datas'
import { useAuth } from '../services/AuthProvider'
import type { RootStackParamList } from '../navigation/AppNavigator'

type Props = RouteProp<RootStackParamList, 'NovoItem'>
function deslocarDia(dataISO: string, dias: number) {
  const [a, m, d] = dataISO.split('-').map(Number)
  const data = new Date(a, m - 1, d + dias)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

export function NovoItemScreen() {
  const route = useRoute<Props>()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { session } = useAuth()
  const tipo = route.params?.tipo ?? 'tarefa'
  const dataInicial = route.params?.data ?? hojeISO()
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(dataInicial)
  const [horario, setHorario] = useState(route.params?.horario ?? '')
  const [horarioFim, setHorarioFim] = useState(route.params?.horarioFim ?? '')
  const [diaTodo, setDiaTodo] = useState(!route.params?.horario)
  const [inicioDia, setInicioDia] = useState(7)
  const [fimDia, setFimDia] = useState(20)
  const [mostrarNaAgenda, setMostrarNaAgenda] = useState(tipo === 'compromisso' || route.params?.mostrarNaAgenda === true)
  const [mostrarNaTodo, setMostrarNaTodo] = useState(true)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [agendas, setAgendas] = useState<{ id: string; nome: string; proprietario_id: string; principal: boolean }[]>([])
  const [agendaId, setAgendaId] = useState(route.params?.agendaId ?? '')
  const [membros, setMembros] = useState<{ usuario_id: string; nome: string; email: string | null; cor: string }[]>([])
  const [responsavelId, setResponsavelId] = useState(session?.user.id ?? '')
  const [prioridade, setPrioridade] = useState<'baixa' | 'media' | 'alta'>('media')

  useEffect(() => {
    let ativo = true
    supabase.from('agendas').select('id, nome, proprietario_id, principal').order('principal', { ascending: false }).then(({ data }) => {
      if (!ativo || !data) return
      const lista = data as typeof agendas
      setAgendas(lista)
      if (!route.params?.agendaId) {
        const padrao = lista.find((a) => a.principal && a.proprietario_id === session?.user.id) || lista[0]
        if (padrao) setAgendaId(padrao.id)
      }
    })
    return () => { ativo = false }
  }, [route.params?.agendaId, session?.user.id])

  useEffect(() => {
    if (!session?.user.id) return
    supabase.from('agenda_preferencias').select('inicio_dia, fim_dia').eq('usuario_id', session.user.id).maybeSingle().then(({ data: pref }) => {
      if (!pref) return
      setInicioDia(Number(pref.inicio_dia.slice(0, 2)))
      setFimDia(Number(pref.fim_dia.slice(0, 2)))
    })
  }, [session?.user.id])

  useEffect(() => {
    if (!agendaId) return
    let ativo = true
    supabase.rpc('listar_membros_agenda', { p_agenda_id: agendaId }).then(({ data }) => {
      if (!ativo || !data) return
      const lista = data as typeof membros
      setMembros(lista)
      setResponsavelId((atual) => lista.some((m) => m.usuario_id === atual) ? atual : (lista.find((m) => m.usuario_id === session?.user.id)?.usuario_id || lista[0]?.usuario_id || ''))
    })
    return () => { ativo = false }
  }, [agendaId, session?.user.id])

  async function salvar() {
    if (!titulo.trim()) { setErro('Informe um título'); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) { setErro('Use a data no formato AAAA-MM-DD'); return }
    if (!diaTodo && (!horario || !horarioFim)) { setErro('Escolha o horário de início e de fim, ou marque Dia todo.'); return }
    if (!diaTodo && horarioFim <= horario) { setErro('O horário de fim precisa ser depois do início.'); return }
    setLoading(true)
    try {
      const { error } = await supabase.from('organizacao_itens').insert({
        tipo, titulo: titulo.trim(), descricao: descricao.trim() || null, data,
        horario: diaTodo ? null : horario, horario_fim: diaTodo ? null : horarioFim, mostrar_na_agenda: mostrarNaAgenda, mostrar_na_todo: mostrarNaTodo,
        ...(agendaId ? { agenda_id: agendaId } : {}),
        ...(tipo === 'tarefa' ? { responsavel_id: responsavelId || session?.user.id, prioridade } : {})
      })
      if (error) throw error
      navigation.goBack()
    } catch (e: any) {
      notify('Não foi possível salvar', e?.message || 'Tente novamente.')
    } finally { setLoading(false) }
  }

  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>{tipo === 'compromisso' ? 'Novo compromisso' : 'Nova tarefa'}</Text>
    <Text style={styles.subtitle}>Organize sua rotina em um só lugar.</Text>
    <View style={styles.form}>
      <Input label="Título *" value={titulo} onChangeText={(v) => { setTitulo(v); setErro('') }} placeholder={tipo === 'compromisso' ? 'Ex.: Reunião com equipe' : 'Ex.: Revisar orçamento'} error={erro} />
      <Input label="Descrição" value={descricao} onChangeText={setDescricao} placeholder="Detalhes (opcional)" multiline />
      <Input label="Data (AAAA-MM-DD)" value={data} onChangeText={setData} placeholder="2026-10-14" />
      {agendas.length > 1 && <View style={styles.quickDates}><Text style={styles.label}>Adicionar à agenda</Text><View style={styles.dateButtons}>{agendas.map((agenda) => <TouchableOpacity key={agenda.id} onPress={() => setAgendaId(agenda.id)} style={[styles.dateButton, agendaId === agenda.id && styles.timeSelected]}><Text style={[styles.timeOptionText, agendaId === agenda.id && styles.timeSelectedText]}>{agenda.nome}</Text></TouchableOpacity>)}</View></View>}
      {tipo === 'tarefa' && <View style={styles.quickDates}><Text style={styles.label}>Responsável</Text><View style={styles.memberList}>{membros.map((membro) => { const selecionado = responsavelId === membro.usuario_id; return <TouchableOpacity key={membro.usuario_id} onPress={() => setResponsavelId(membro.usuario_id)} style={[styles.memberOption, selecionado && { borderColor: membro.cor, backgroundColor: membro.cor + '12' }]}><View style={[styles.memberDot, { backgroundColor: membro.cor }]} /><Text style={[styles.memberText, selecionado && { color: membro.cor }]}>{membro.usuario_id === session?.user.id ? 'Você' : membro.nome}</Text></TouchableOpacity> })}</View></View>}
      {tipo === 'tarefa' && <View style={styles.quickDates}><Text style={styles.label}>Prioridade</Text><View style={styles.dateButtons}>{([['baixa','Baixa'],['media','Média'],['alta','Alta']] as const).map(([valor, label]) => { const ativo = prioridade === valor; const corPrioridade = valor === 'alta' ? colors.expense : valor === 'media' ? colors.warning : colors.income; return <TouchableOpacity key={valor} onPress={() => setPrioridade(valor)} style={[styles.priorityOption, ativo && { borderColor: corPrioridade, backgroundColor: corPrioridade + '15' }]}><Text style={[styles.timeOptionText, ativo && { color: corPrioridade }]}>{label}</Text></TouchableOpacity> })}</View></View>}
      <View style={styles.quickDates}><Text style={styles.label}>Escolha rápida</Text><View style={styles.dateButtons}>{[0, 1, 2].map((n) => { const dia = deslocarDia(hojeISO(), n); const ativo = data === dia; return <TouchableOpacity key={n} onPress={() => { setData(dia); setErro('') }} style={[styles.dateButton, ativo && styles.timeSelected]}><Text style={[styles.timeOptionText, ativo && styles.timeSelectedText]}>{['Hoje', 'Amanhã', 'Depois'][n]}</Text></TouchableOpacity> })}</View></View>
      <SwitchRow label="Dia todo" value={diaTodo} onChange={(value) => { setDiaTodo(value); setErro(''); if (value) { setHorario(''); setHorarioFim('') } else { const inicio = `${String(inicioDia).padStart(2, '0')}:00`; const fim = `${String(Math.min(inicioDia + 1, fimDia)).padStart(2, '0')}:00`; setHorario(inicio); setHorarioFim(fim) } }} />
      {!diaTodo && <View style={styles.timePicker}><Text style={styles.label}>Horário da atividade (hora cheia)</Text><Text style={styles.timeSub}>Selecione início e fim para reservar mais de uma hora.</Text><Text style={styles.label}>Início · {horario || '—'}</Text><View style={styles.hoursGrid}>{Array.from({ length: fimDia - inicioDia }, (_, i) => inicioDia + i).map((hour) => { const value = `${String(hour).padStart(2, '0')}:00`; const selected = horario === value; return <TouchableOpacity key={hour} onPress={() => { setHorario(value); if (!horarioFim || horarioFim <= value) setHorarioFim(`${String(Math.min(hour + 1, fimDia)).padStart(2, '0')}:00`) }} style={[styles.hourOption, selected && styles.timeSelected]}><Text style={[styles.timeOptionText, selected && styles.timeSelectedText]}>{value}</Text></TouchableOpacity> })}</View><Text style={styles.label}>Fim · {horarioFim || '—'}</Text><View style={styles.hoursGrid}>{Array.from({ length: Math.max(0, fimDia - Number(horario.slice(0,2) || inicioDia) ) }, (_, i) => Number(horario.slice(0,2) || inicioDia) + i + 1).map((hour) => { const value = `${String(hour).padStart(2, '0')}:00`; const selected = horarioFim === value; return <TouchableOpacity key={hour} onPress={() => setHorarioFim(value)} style={[styles.hourOption, selected && styles.timeSelected]}><Text style={[styles.timeOptionText, selected && styles.timeSelectedText]}>{value}</Text></TouchableOpacity> })}</View></View>}
      <SwitchRow label="Exibir na Agenda" value={mostrarNaAgenda} onChange={setMostrarNaAgenda} />
      <SwitchRow label="Exibir na Todo List" value={mostrarNaTodo} onChange={setMostrarNaTodo} />
      <View style={styles.actions}><Button title={loading ? 'Salvando…' : 'Salvar'} onPress={salvar} loading={loading} /><Button title="Cancelar" variant="secondary" onPress={() => navigation.goBack()} /></View>
    </View>
  </ScrollView>
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <View style={styles.switchRow}><Text style={styles.switchLabel}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} /></View>
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.background, minHeight: '100%' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 20 },
  form: { backgroundColor: colors.surface, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: colors.border, gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  quickDates: { gap: 8 }, dateButtons: { flexDirection: 'row', gap: 8 },
  timePicker: { gap: 9 }, timeSub: { color: colors.muted, fontSize: 12, marginTop: -5 }, hoursGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, hourOption: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, timeSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary }, timeOptionText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' }, timeSelectedText: { color: colors.primary },
  memberList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, memberOption: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, memberDot: { width: 9, height: 9, borderRadius: 5 }, memberText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary }, priorityOption: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  dateButton: { backgroundColor: colors.primaryLight, color: colors.primary, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, overflow: 'hidden' },
  switchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border },
  switchLabel: { color: colors.text, fontWeight: '600' }, actions: { gap: 10, marginTop: 8 }
})
