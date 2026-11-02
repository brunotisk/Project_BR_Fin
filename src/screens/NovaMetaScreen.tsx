import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '../services/supabase'
import { colors } from '../theme'
import { Input } from '../components/Input'
import { Button } from '../components/Button'
import { notify } from '../utils/notify'

export function NovaMetaScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const [nome, setNome] = useState('')
  const [valorObjetivo, setValorObjetivo] = useState('')
  const [valorAtual, setValorAtual] = useState('0')
  const [dataLimite, setDataLimite] = useState('')
  const [loading, setLoading] = useState(false)
  const [erros, setErros] = useState<{ [key: string]: string }>({})

  async function handleSalvar() {
    const novosErros: { [key: string]: string } = {}

    if (!nome.trim()) {
      novosErros.nome = 'Informe o nome da meta'
    }

    const valObj = Number(valorObjetivo.replace(',', '.'))
    if (isNaN(valObj) || valObj <= 0) {
      novosErros.valorObjetivo = 'Informe um valor objetivo válido (> 0)'
    }

    const valAtual = Number(valorAtual.replace(',', '.'))
    if (isNaN(valAtual) || valAtual < 0) {
      novosErros.valorAtual = 'Valor inicial inválido'
    }

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros)
      return
    }

    setLoading(true)
    setErros({})

    try {
      const { error } = await supabase.from('metas').insert({
        nome: nome.trim(),
        valor_objetivo: valObj,
        valor_atual: valAtual,
        data_limite: dataLimite.trim() || null,
        status: 'ativa'
      })

      if (error) throw error

      notify('Sucesso!', 'Meta criada com sucesso.')
      navigation.goBack()
    } catch (err: any) {
      notify('Erro ao salvar meta', err?.message || 'Falha ao cadastrar meta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nova Meta Financeira</Text>
      <Text style={styles.subtitle}>Defina objetivos como reserva, viagem ou compra de bens</Text>

      <View style={styles.form}>
        <Input
          label="Nome da Meta *"
          placeholder="Ex: Reserva de Emergência, Carro Novo, Viagem"
          value={nome}
          onChangeText={setNome}
          error={erros.nome}
        />

        <Input
          label="Valor do Objetivo (R$) *"
          placeholder="Ex: 10000,00"
          keyboardType="numeric"
          prefix="R$"
          value={valorObjetivo}
          onChangeText={setValorObjetivo}
          error={erros.valorObjetivo}
        />

        <Input
          label="Valor Já Acumulado (R$)"
          placeholder="0,00"
          keyboardType="numeric"
          prefix="R$"
          value={valorAtual}
          onChangeText={setValorAtual}
          error={erros.valorAtual}
          hint="Quanto você já guardou para esta meta até agora"
        />

        <Input
          label="Data Limite / Prazo (Opcional)"
          placeholder="Ex: 2026-12-31"
          value={dataLimite}
          onChangeText={setDataLimite}
          hint="Formato: AAAA-MM-DD"
        />

        <View style={styles.actions}>
          <Button title="Salvar Meta" onPress={handleSalvar} loading={loading} />
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
  actions: {
    marginTop: 10,
    gap: 10
  }
})
