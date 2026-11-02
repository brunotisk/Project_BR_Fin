import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '../services/supabase'
import { Categoria } from '../types'
import { colors } from '../theme'
import { Input } from '../components/Input'
import { Button } from '../components/Button'
import { notify } from '../utils/notify'

export function NovoOrcamentoScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const dataAtual = new Date()
  const [mes, setMes] = useState(String(dataAtual.getMonth() + 1))
  const [ano, setAno] = useState(String(dataAtual.getFullYear()))
  const [valorLimite, setValorLimite] = useState('')
  const [categoriaId, setCategoriaId] = useState<string>('')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(false)
  const [erros, setErros] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    async function carregarCategorias() {
      // Regra de integridade do banco: orçamentos só aceitam categorias de despesa!
      const { data } = await supabase
        .from('categorias')
        .select('*')
        .eq('tipo', 'despesa')
        .order('nome')

      if (data && data.length > 0) {
        setCategorias(data as Categoria[])
        setCategoriaId(data[0].id)
      }
    }

    carregarCategorias()
  }, [])

  async function handleSalvar() {
    const novosErros: { [key: string]: string } = {}

    if (!categoriaId) {
      novosErros.categoria = 'Selecione uma categoria de despesa'
    }

    const m = parseInt(mes, 10)
    if (isNaN(m) || m < 1 || m > 12) {
      novosErros.mes = 'Mês deve ser entre 1 e 12'
    }

    const a = parseInt(ano, 10)
    if (isNaN(a) || a < 2000 || a > 2100) {
      novosErros.ano = 'Ano inválido'
    }

    const valorLim = Number(valorLimite.replace(',', '.'))
    if (isNaN(valorLim) || valorLim <= 0) {
      novosErros.valor = 'Informe um valor limite válido (> 0)'
    }

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros)
      return
    }

    setLoading(true)
    setErros({})

    try {
      const { error } = await supabase.from('orcamentos').insert({
        categoria_id: categoriaId,
        mes: m,
        ano: a,
        valor_limite: valorLim
      })

      if (error) throw error

      notify('Sucesso!', 'Limite de orçamento registrado com sucesso.')
      navigation.goBack()
    } catch (err: any) {
      notify('Erro ao salvar orçamento', err?.message || 'Falha ao salvar orçamento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Novo Orçamento Mensal</Text>
      <Text style={styles.subtitle}>Estipule um limite máximo de gastos por categoria</Text>

      <View style={styles.form}>
        <View style={styles.section}>
          <Text style={styles.label}>Categoria de Despesa *</Text>
          {categorias.length === 0 ? (
            <Text style={styles.aviso}>Nenhuma categoria de despesa encontrada.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              {categorias.map((cat) => {
                const selecionada = cat.id === categoriaId
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setCategoriaId(cat.id)}
                    style={[
                      styles.chip,
                      selecionada && { borderColor: cat.cor || colors.primary, backgroundColor: (cat.cor || colors.primary) + '20' }
                    ]}
                  >
                    <Text style={[styles.chipTexto, selecionada && { fontWeight: '700', color: colors.text }]}>
                      {cat.nome}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
          {erros.categoria ? <Text style={styles.errorText}>{erros.categoria}</Text> : null}
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Input
              label="Mês (1-12) *"
              keyboardType="numeric"
              value={mes}
              onChangeText={setMes}
              error={erros.mes}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Ano *"
              keyboardType="numeric"
              value={ano}
              onChangeText={setAno}
              error={erros.ano}
            />
          </View>
        </View>

        <Input
          label="Valor Limite Teto (R$) *"
          placeholder="Ex: 800,00"
          keyboardType="numeric"
          prefix="R$"
          value={valorLimite}
          onChangeText={setValorLimite}
          error={erros.valor}
          hint="Valor máximo que você planeja gastar nesta categoria no mês"
        />

        <View style={styles.actions}>
          <Button title="Salvar Orçamento" onPress={handleSalvar} loading={loading} />
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
  section: {
    gap: 8
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  chipsScroll: {
    gap: 8,
    paddingVertical: 4
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  chipTexto: {
    fontSize: 13,
    color: colors.muted
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  aviso: {
    fontSize: 13,
    color: colors.muted
  },
  errorText: {
    fontSize: 12,
    color: colors.expense
  },
  actions: {
    marginTop: 10,
    gap: 10
  }
})
