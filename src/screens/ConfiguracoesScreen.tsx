import { useCallback, useState } from 'react'
import { ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../services/supabase'
import { useAuth } from '../services/AuthProvider'
import { colors } from '../theme'
import { Button } from '../components/Button'
import { notify } from '../utils/notify'

type ConviteRecebido = { convite_id: string; agenda_id: string; agenda_nome: string; remetente: string; criado_em: string }
type ConviteEnviado = { id: string; email: string; status: string; criado_em: string }
const CORES = ['#2563EB', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B']

export function ConfiguracoesScreen() {
  const { session, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [cor, setCor] = useState('#2563EB')
  const [recebidos, setRecebidos] = useState<ConviteRecebido[]>([])
  const [enviados, setEnviados] = useState<ConviteEnviado[]>([])
  const [enviando, setEnviando] = useState(false)
  const [aceitando, setAceitando] = useState('')
  const [inicioDia, setInicioDia] = useState(7)
  const [fimDia, setFimDia] = useState(20)

  const carregar = useCallback(async () => {
    const [resRecebidos, resEnviados, resCor, resHorario] = await Promise.all([
      supabase.rpc('listar_convites_recebidos'),
      supabase.from('agenda_convites').select('id, email, status, criado_em').order('criado_em', { ascending: false }),
      supabase.from('agenda_membros').select('cor').eq('usuario_id', session?.user.id || '').limit(1).maybeSingle(),
      supabase.from('agenda_preferencias').select('inicio_dia, fim_dia').eq('usuario_id', session?.user.id || '').maybeSingle()
    ])
    if (!resRecebidos.error && resRecebidos.data) setRecebidos(resRecebidos.data as ConviteRecebido[])
    if (!resEnviados.error && resEnviados.data) setEnviados(resEnviados.data as ConviteEnviado[])
    if (!resCor.error && resCor.data?.cor) setCor(resCor.data.cor)
    if (!resHorario.error && resHorario.data) {
      setInicioDia(Number(resHorario.data.inicio_dia.slice(0, 2)))
      setFimDia(Number(resHorario.data.fim_dia.slice(0, 2)))
    }
  }, [session?.user.id])
  useFocusEffect(useCallback(() => { void carregar() }, [carregar]))

  async function convidar() {
    if (!email.trim()) { notify('Informe um e-mail', 'Digite o e-mail da pessoa que você quer convidar.'); return }
    const emailConvidado = email.trim()
    setEnviando(true)
    const { error } = await supabase.rpc('convidar_para_agenda', { p_email: emailConvidado })
    setEnviando(false)
    if (error) { notify('Não foi possível enviar o convite', error.message); return }
    setEmail('')
    notify('Convite criado', 'Escolha como avisar a pessoa. Ela poderá aceitar em Configurações ao entrar no app com este e-mail.')
    try {
      await Share.share({ message: `Olá! Te convidei para compartilhar uma agenda no App Financeiro. Abra o app ou crie sua conta com ${emailConvidado} e aceite o convite na aba Configurações.` })
    } catch { /* O convite continua salvo mesmo se o compartilhamento for fechado. */ }
    void carregar()
  }

  async function aceitar(conviteId: string) {
    setAceitando(conviteId)
    const { error } = await supabase.rpc('aceitar_convite_agenda', { p_convite_id: conviteId })
    setAceitando('')
    if (error) { notify('Não foi possível aceitar', error.message); return }
    notify('Agenda compartilhada', 'Você já pode ver os compromissos desta agenda.')
    void carregar()
  }

  async function alterarCor(novaCor: string) {
    setCor(novaCor)
    const { error } = await supabase.rpc('atualizar_cor_agendas', { p_cor: novaCor })
    if (error) notify('Não foi possível alterar a cor', error.message)
  }

  async function salvarHorario(inicio: number, fim: number) {
    setInicioDia(inicio); setFimDia(fim)
    const { error } = await supabase.from('agenda_preferencias').upsert({ usuario_id: session!.user.id, inicio_dia: `${String(inicio).padStart(2, '0')}:00`, fim_dia: `${String(fim).padStart(2, '0')}:00` })
    if (error) notify('Não foi possível salvar o horário', error.message)
  }

  return <ScrollView style={styles.page} contentContainerStyle={styles.container}>
    <Text style={styles.title}>Configurações</Text>
    <Text style={styles.subtitle}>Compartilhamento e preferências da sua agenda.</Text>

    <View style={styles.card}><View style={styles.heading}><View style={styles.icon}><Ionicons name="time-outline" size={20} color={colors.primary} /></View><View style={styles.headingText}><Text style={styles.sectionTitle}>Duração do dia</Text><Text style={styles.itemSub}>Define as horas visíveis na agenda</Text></View></View>
      <Text style={styles.timeLabel}>Início · {String(inicioDia).padStart(2, '0')}:00</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourOptions}>{Array.from({ length: 23 }, (_, hour) => <TouchableOpacity key={hour} onPress={() => { const fim = hour >= fimDia ? Math.min(hour + 1, 23) : fimDia; void salvarHorario(hour, fim) }} style={[styles.hourOption, inicioDia === hour && styles.hourOptionActive]}><Text style={[styles.hourOptionText, inicioDia === hour && styles.hourOptionTextActive]}>{String(hour).padStart(2, '0')}</Text></TouchableOpacity>)}</ScrollView>
      <Text style={styles.timeLabel}>Fim · {String(fimDia).padStart(2, '0')}:00</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourOptions}>{Array.from({ length: 23 - inicioDia }, (_, index) => index + inicioDia + 1).map((hour) => <TouchableOpacity key={hour} onPress={() => void salvarHorario(inicioDia, hour)} style={[styles.hourOption, fimDia === hour && styles.hourOptionActive]}><Text style={[styles.hourOptionText, fimDia === hour && styles.hourOptionTextActive]}>{String(hour).padStart(2, '0')}</Text></TouchableOpacity>)}</ScrollView>
    </View>

    {recebidos.length > 0 && <View style={styles.card}><Text style={styles.sectionTitle}>Convites recebidos</Text>{recebidos.map((convite) => <View key={convite.convite_id} style={styles.invite}><View style={styles.inviteInfo}><Text style={styles.itemTitle}>{convite.agenda_nome}</Text><Text style={styles.itemSub}>Convite de {convite.remetente}</Text></View><TouchableOpacity disabled={aceitando === convite.convite_id} onPress={() => aceitar(convite.convite_id)} style={styles.accept}><Text style={styles.acceptText}>{aceitando === convite.convite_id ? '...' : 'Aceitar'}</Text></TouchableOpacity></View>)}</View>}

    <View style={styles.card}><View style={styles.heading}><View style={styles.icon}><Ionicons name="people-outline" size={20} color={colors.primary} /></View><View style={styles.headingText}><Text style={styles.sectionTitle}>Compartilhar agenda</Text><Text style={styles.itemSub}>Convide alguém pelo e-mail</Text></View></View>
      <TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="nome@exemplo.com" placeholderTextColor={colors.muted} style={styles.input} />
      <Button title={enviando ? 'Enviando…' : 'Criar convite'} onPress={convidar} loading={enviando} />
      <Text style={styles.hint}>Depois de criar o convite, você pode avisar a pessoa pelo menu de compartilhamento do celular. Ela aceitará em Configurações usando este e-mail.</Text>
      {enviados.length > 0 && <View style={styles.sentList}><Text style={styles.listTitle}>Convites enviados</Text>{enviados.map((item) => <View key={item.id} style={styles.sentRow}><Text style={styles.itemSub}>{item.email}</Text><Text style={[styles.status, item.status === 'aceito' && styles.accepted]}>{item.status === 'aceito' ? 'Aceito' : 'Pendente'}</Text></View>)}</View>}
    </View>

    <View style={styles.card}><View style={styles.heading}><View style={[styles.icon, { backgroundColor: cor + '20' }]}><Ionicons name="color-palette-outline" size={20} color={cor} /></View><View style={styles.headingText}><Text style={styles.sectionTitle}>Minha cor</Text><Text style={styles.itemSub}>Identifica suas atividades no calendário compartilhado</Text></View></View><View style={styles.colors}>{CORES.map((c) => <TouchableOpacity key={c} accessibilityLabel={`Selecionar cor ${c}`} onPress={() => alterarCor(c)} style={[styles.colorOption, { backgroundColor: c }, cor === c && styles.colorSelected]}>{cor === c ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}</TouchableOpacity>)}</View></View>

    <View style={styles.card}><Text style={styles.sectionTitle}>Conta</Text><Text style={styles.itemSub}>{session?.user.email}</Text><TouchableOpacity onPress={() => void signOut()} style={styles.signOut}><Ionicons name="log-out-outline" size={18} color={colors.expense} /><Text style={styles.signOutText}>Sair da conta</Text></TouchableOpacity></View>
  </ScrollView>
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, container: { padding: 18, gap: 14, paddingBottom: 30 }, title: { fontSize: 27, fontWeight: '800', color: colors.text }, subtitle: { fontSize: 13, color: colors.muted, marginTop: -9 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 13 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 11 }, icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight }, headingText: { flex: 1, gap: 3 }, sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text }, itemSub: { fontSize: 12, color: colors.muted }, timeLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginTop: 3 }, hourOptions: { flexDirection: 'row', gap: 7 }, hourOption: { minWidth: 38, paddingVertical: 8, alignItems: 'center', borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, hourOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight }, hourOptionText: { color: colors.muted, fontSize: 12, fontWeight: '600' }, hourOptionTextActive: { color: colors.primary, fontWeight: '700' }, input: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 13, color: colors.text, backgroundColor: colors.surface, fontSize: 14 }, hint: { fontSize: 11, lineHeight: 16, color: colors.muted }, sentList: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 9 }, listTitle: { fontSize: 12, fontWeight: '700', color: colors.text }, sentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, status: { fontSize: 10, fontWeight: '700', color: colors.warning }, accepted: { color: colors.income }, colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 4 }, colorOption: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, colorSelected: { borderWidth: 3, borderColor: colors.text, transform: [{ scale: 1.08 }] }, invite: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.border }, inviteInfo: { flex: 1, gap: 3 }, itemTitle: { fontSize: 13, color: colors.text, fontWeight: '700' }, accept: { backgroundColor: colors.primary, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 9 }, acceptText: { color: '#fff', fontSize: 12, fontWeight: '700' }, signOut: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.border }, signOutText: { color: colors.expense, fontSize: 13, fontWeight: '700' }
})
