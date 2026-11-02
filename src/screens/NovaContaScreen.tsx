import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '../services/supabase'
import { TipoConta } from '../types'
import { colors } from '../theme'
import { Input } from '../components/Input'
import { OptionSelector } from '../components/OptionSelector'
import { Button } from '../components/Button'
import { notify } from '../utils/notify'

const TIPOS_CONTA: { label: string; value: TipoConta }[] = [
  { label: 'Conta Corrente', value: 'corrente' },
  { label: 'Poupança', value: 'poupanca' },
  { label: 'Carteira / Dinheiro', value: 'carteira' },
  { label: 'Investimento', value: 'investimento' },
  { label: 'Outro', value: 'outro' }
]

const CORES_SUGERIDAS = [
  '#2563EB', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444',
  '#EC4899', '#06B6D4', '#64748B', '#14B8A6', '#F97316'
]

export function NovaContaScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoConta>('corrente')
  const [saldoInicial, setSaldoInicial] = useState('0')
  const [instituicao, setInstituicao] = useState('')
  const [cor, setCor] = useState(CORES_SUGERIDAS[0])
  const [loading, setLoading] = useState(false)
  const [erros, setErros] = useState<{ [key: string]: string }>({})

  async function handleSalvar() {
    const novosErros: { [key: string]: string } = {}
    if (!nome.trim()) {
      novosErros.nome = 'Informe o nome da conta'
    }

    const saldoFormatado = Number(saldoInicial.replace(',', '.'))
    if (isNaN(saldoFormatado)) {
      novosErros.saldo = 'Valor de saldo inválido'
    }

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros)
      return
    }

    setLoading(true)
    setErros({})

    try {
      const { error } = await supabase.from('contas').insert({
        nome: nome.trim(),
        tipo,
        saldo_inicial: saldoFormatado,
        instituicao: instituicao.trim() || null,
        cor,
        ativa: true
      })

      if (error) {
        throw error
      }

      notify('Sucesso!', 'Conta adicionada com sucesso.')
      navigation.goBack()
    } catch (err: any) {
      notify('Erro ao salvar conta', err?.message || 'Ocorreu um erro ao criar a conta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nova Conta / Carteira</Text>
      <Text style={styles.subtitle}>Cadastre suas contas bancárias, carteira ou investimentos</Text>

      <View style={styles.form}>
        <Input
          label="Nome da Conta *"
          placeholder="Ex: Nubank, Itaú, Carteira..."
          value={nome}
          onChangeText={setNome}
          error={erros.nome}
        />

        <OptionSelector
          label="Tipo da Conta *"
          options={TIPOS_CONTA}
          selectedValue={tipo}
          onSelect={(val) => setTipo(val as TipoConta)}
        />

        <Input
          label="Saldo Inicial (R$)"
          placeholder="0,00"
          keyboardType="numeric"
          prefix="R$"
          value={saldoInicial}
          onChangeText={setSaldoInicial}
          error={erros.saldo}
          hint="Informe quanto dinheiro já tem nesta conta hoje"
        />

        <Input
          label="Instituição Financeira (Opcional)"
          placeholder="Ex: Nubank, Banco Inter, Bradesco..."
          value={instituicao}
          onChangeText={setInstituicao}
        />

        <View style={styles.corContainer}>
          <Text style={styles.label}>Cor da Conta</Text>
          <View style={styles.coresGrid}>
            {CORES_SUGERIDAS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCor(c)}
                style={[
                  styles.circuloCor,
                  { backgroundColor: c },
                  cor === c && styles.circuloSelecionado
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <Button title="Salvar Conta" onPress={handleSalvar} loading={loading} />
          <Button title="Cancelar" onPress={() => navigation.goBack()} variant="secondary" />
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: colors.background,
    minHeight: '100%'
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 20
  },
  form: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8
  },
  corContainer: {
    marginBottom: 8
  },
  coresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  circuloCor: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  circuloSelecionado: {
    borderColor: colors.text,
    transform: [{ scale: 1.15 }]
  },
  actions: {
    marginTop: 10,
    gap: 10
  }
})
