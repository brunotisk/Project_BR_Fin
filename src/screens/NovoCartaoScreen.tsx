import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '../services/supabase'
import { BandeiraCartao } from '../types'
import { colors } from '../theme'
import { Input } from '../components/Input'
import { OptionSelector } from '../components/OptionSelector'
import { Button } from '../components/Button'
import { notify } from '../utils/notify'

const BANDEIRAS: { label: string; value: BandeiraCartao }[] = [
  { label: 'Mastercard', value: 'mastercard' },
  { label: 'Visa', value: 'visa' },
  { label: 'Elo', value: 'elo' },
  { label: 'Amex', value: 'amex' },
  { label: 'Hipercard', value: 'hipercard' },
  { label: 'Outro', value: 'outro' }
]

const CORES_CARTAO = [
  '#820AD1', // Nubank roxo
  '#000000', // Black / XP
  '#EC7000', // Itaú laranja
  '#CC092F', // Bradesco vermelho
  '#003399', // Banco do Brasil azul
  '#FF7A00', // Inter laranja
  '#10B981', // Verde
  '#2563EB'  // Azul padrão
]

export function NovoCartaoScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const [nome, setNome] = useState('')
  const [limite, setLimite] = useState('')
  const [diaFechamento, setDiaFechamento] = useState('25')
  const [diaVencimento, setDiaVencimento] = useState('5')
  const [bandeira, setBandeira] = useState<BandeiraCartao>('mastercard')
  const [cor, setCor] = useState(CORES_CARTAO[0])
  const [loading, setLoading] = useState(false)
  const [erros, setErros] = useState<{ [key: string]: string }>({})

  async function handleSalvar() {
    const novosErros: { [key: string]: string } = {}

    if (!nome.trim()) {
      novosErros.nome = 'Informe o nome ou apelido do cartão'
    }

    const limNum = Number(limite.replace(',', '.'))
    if (isNaN(limNum) || limNum <= 0) {
      novosErros.limite = 'Informe um limite total válido'
    }

    const fech = parseInt(diaFechamento, 10)
    if (isNaN(fech) || fech < 1 || fech > 31) {
      novosErros.fechamento = 'Dia de fechamento inválido (1-31)'
    }

    const venc = parseInt(diaVencimento, 10)
    if (isNaN(venc) || venc < 1 || venc > 31) {
      novosErros.vencimento = 'Dia de vencimento inválido (1-31)'
    }

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros)
      return
    }

    setLoading(true)
    setErros({})

    try {
      const { error } = await supabase.from('cartoes_credito').insert({
        nome: nome.trim(),
        limite: limNum,
        dia_fechamento: fech,
        dia_vencimento: venc,
        bandeira,
        cor,
        ativo: true
      })

      if (error) throw error

      notify('Sucesso!', 'Cartão de crédito cadastrado com sucesso.')
      navigation.goBack()
    } catch (err: any) {
      notify('Erro ao salvar cartão', err?.message || 'Falha ao salvar cartão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Novo Cartão de Crédito</Text>
      <Text style={styles.subtitle}>Cadastre para controlar faturas, limites e parcelas futuras</Text>

      {/* Pré-visualização do Cartão */}
      <View style={[styles.cartaoPreview, { backgroundColor: cor }]}>
        <View style={styles.previewTop}>
          <Text style={styles.previewChip}>💳</Text>
          <Text style={styles.previewBandeira}>{bandeira.toUpperCase()}</Text>
        </View>
        <Text style={styles.previewNome}>{nome || 'Nome do Cartão'}</Text>
        <View style={styles.previewBottom}>
          <View>
            <Text style={styles.previewMiniLabel}>FECHAMENTO</Text>
            <Text style={styles.previewMiniValor}>Dia {diaFechamento || '25'}</Text>
          </View>
          <View>
            <Text style={styles.previewMiniLabel}>VENCIMENTO</Text>
            <Text style={styles.previewMiniValor}>Dia {diaVencimento || '5'}</Text>
          </View>
          <View>
            <Text style={styles.previewMiniLabel}>LIMITE</Text>
            <Text style={styles.previewMiniValor}>R$ {limite || '0,00'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.form}>
        <Input
          label="Nome do Cartão *"
          placeholder="Ex: Nubank Ultravioleta, Itaú Click, XP Infinite"
          value={nome}
          onChangeText={setNome}
          error={erros.nome}
        />

        <Input
          label="Limite Total do Cartão (R$) *"
          placeholder="Ex: 5000,00"
          keyboardType="numeric"
          prefix="R$"
          value={limite}
          onChangeText={setLimite}
          error={erros.limite}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Input
              label="Dia de Fechamento *"
              placeholder="Ex: 25"
              keyboardType="numeric"
              value={diaFechamento}
              onChangeText={setDiaFechamento}
              error={erros.fechamento}
              hint="Melhor dia de compra"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Dia de Vencimento *"
              placeholder="Ex: 5"
              keyboardType="numeric"
              value={diaVencimento}
              onChangeText={setDiaVencimento}
              error={erros.vencimento}
              hint="Pagamento da fatura"
            />
          </View>
        </View>

        <OptionSelector
          label="Bandeira do Cartão"
          options={BANDEIRAS}
          selectedValue={bandeira}
          onSelect={(b) => setBandeira(b as BandeiraCartao)}
        />

        <View style={styles.section}>
          <Text style={styles.label}>Cor de Destaque do Cartão</Text>
          <View style={styles.coresGrid}>
            {CORES_CARTAO.map((c) => (
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
          <Button title="Salvar Cartão" onPress={handleSalvar} loading={loading} />
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
    marginBottom: 16
  },
  cartaoPreview: {
    padding: 20,
    borderRadius: 16,
    height: 170,
    justifyContent: 'space-between',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4
  },
  previewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  previewChip: {
    fontSize: 24
  },
  previewBandeira: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1
  },
  previewNome: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700'
  },
  previewBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  previewMiniLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '600'
  },
  previewMiniValor: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2
  },
  form: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  section: {
    gap: 8
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
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
