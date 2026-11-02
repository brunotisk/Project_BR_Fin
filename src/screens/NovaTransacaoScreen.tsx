import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '../services/supabase'
import { Categoria, Conta, TipoTransacao } from '../types'
import { colors } from '../theme'
import { hojeISO } from '../utils/datas'
import { Input } from '../components/Input'
import { OptionSelector } from '../components/OptionSelector'
import { Button } from '../components/Button'
import { notify } from '../utils/notify'

const TIPOS_TRANSACOES: { label: string; value: TipoTransacao }[] = [
  { label: 'Despesa 💸', value: 'despesa' },
  { label: 'Receita 💰', value: 'receita' }
]

export function NovaTransacaoScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const [tipo, setTipo] = useState<TipoTransacao>('despesa')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [dataTransacao, setDataTransacao] = useState(hojeISO())
  const [contaId, setContaId] = useState<string>('')
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [observacao, setObservacao] = useState('')
  const [status, setStatus] = useState<'confirmado' | 'pendente'>('confirmado')

  // Parcelamento
  const [isParcelado, setIsParcelado] = useState(false)
  const [totalParcelas, setTotalParcelas] = useState('2')
  const [primeiroVencimento, setPrimeiroVencimento] = useState(hojeISO())

  // Carregamento de dados para dropdowns
  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(false)
  const [erros, setErros] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    async function carregarDados() {
      const [resContas, resCategorias] = await Promise.all([
        supabase.from('contas').select('*').eq('ativa', true).order('nome'),
        supabase.from('categorias').select('*').order('nome')
      ])

      if (resContas.data && resContas.data.length > 0) {
        setContas(resContas.data as Conta[])
        setContaId(resContas.data[0].id)
      }

      if (resCategorias.data) {
        setCategorias(resCategorias.data as Categoria[])
      }
    }

    carregarDados()
  }, [])

  // Categorias compatíveis com o tipo atual
  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipo)

  async function handleSalvar() {
    const novosErros: { [key: string]: string } = {}

    if (!descricao.trim()) {
      novosErros.descricao = 'Informe uma descrição'
    }

    const valorNum = Number(valor.replace(',', '.'))
    if (isNaN(valorNum) || valorNum <= 0) {
      novosErros.valor = 'Informe um valor maior que zero'
    }

    if (!contaId) {
      novosErros.contaId = 'Selecione uma conta para o lançamento'
    }

    if (!dataTransacao.trim()) {
      novosErros.data = 'Informe a data (AAAA-MM-DD)'
    }

    if (isParcelado) {
      const numParcelas = parseInt(totalParcelas, 10)
      if (isNaN(numParcelas) || numParcelas < 2) {
        novosErros.parcelas = 'Informe no mínimo 2 parcelas'
      }
      if (!primeiroVencimento.trim()) {
        novosErros.vencimento = 'Informe a data do 1º vencimento'
      }
    }

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros)
      return
    }

    setLoading(true)
    setErros({})

    try {
      if (isParcelado) {
        // Usa a RPC segura criada no banco
        const { error } = await supabase.rpc('criar_transacao_parcelada', {
          p_conta_id: contaId,
          p_categoria_id: categoriaId,
          p_descricao: descricao.trim(),
          p_valor_total: valorNum,
          p_total_parcelas: parseInt(totalParcelas, 10),
          p_primeiro_vencimento: primeiroVencimento,
          p_tipo: tipo,
          p_data: dataTransacao,
          p_observacao: observacao.trim() || null
        })

        if (error) throw error
        notify('Sucesso!', 'Compra parcelada criada com todas as parcelas calculadas!')
      } else {
        const { error } = await supabase.from('transacoes').insert({
          conta_id: contaId,
          categoria_id: categoriaId,
          tipo,
          descricao: descricao.trim(),
          valor: valorNum,
          data: dataTransacao,
          status,
          observacao: observacao.trim() || null
        })

        if (error) throw error
        notify('Sucesso!', `${tipo === 'receita' ? 'Receita' : 'Despesa'} registrada com sucesso!`)
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
      <Text style={styles.title}>Nova Transação</Text>
      <Text style={styles.subtitle}>Registre suas receitas, gastos ou compras parceladas</Text>

      <View style={styles.form}>
        <OptionSelector
          options={TIPOS_TRANSACOES}
          selectedValue={tipo}
          onSelect={(val) => {
            setTipo(val as TipoTransacao)
            setCategoriaId(null)
          }}
        />

        <Input
          label="Descrição *"
          placeholder={tipo === 'despesa' ? 'Ex: Supermercado, Aluguel, Combustível' : 'Ex: Salário mensal, Freelance, Rendimentos'}
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

        <Input
          label="Data (AAAA-MM-DD) *"
          placeholder="2026-10-03"
          value={dataTransacao}
          onChangeText={setDataTransacao}
          error={erros.data}
          hint="Formato: AAAA-MM-DD"
        />

        {/* Seleção de Conta */}
        <View style={styles.section}>
          <Text style={styles.label}>Conta / Carteira *</Text>
          {contas.length === 0 ? (
            <View style={styles.alerta}>
              <Text style={styles.alertaTexto}>Nenhuma conta encontrada. Cadastre uma conta primeiro!</Text>
              <TouchableOpacity onPress={() => navigation.navigate('NovaConta')}>
                <Text style={styles.linkTexto}>+ Cadastrar Conta</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              {contas.map((c) => {
                const selecionada = c.id === contaId
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setContaId(c.id)}
                    style={[
                      styles.chip,
                      selecionada && { borderColor: c.cor || colors.primary, backgroundColor: (c.cor || colors.primary) + '15' }
                    ]}
                  >
                    <View style={[styles.pontoCor, { backgroundColor: c.cor || colors.primary }]} />
                    <Text style={[styles.chipTexto, selecionada && { fontWeight: '700', color: colors.text }]}>
                      {c.nome}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
          {erros.contaId ? <Text style={styles.errorText}>{erros.contaId}</Text> : null}
        </View>

        {/* Seleção de Categoria */}
        <View style={styles.section}>
          <View style={styles.rowJustify}>
            <Text style={styles.label}>Categoria ({tipo === 'despesa' ? 'Despesa' : 'Receita'})</Text>
            <TouchableOpacity onPress={() => navigation.navigate('NovaCategoria')}>
              <Text style={styles.linkTexto}>+ Nova Categoria</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            <TouchableOpacity
              onPress={() => setCategoriaId(null)}
              style={[styles.chip, !categoriaId && styles.chipAtivo]}
            >
              <Text style={[styles.chipTexto, !categoriaId && styles.chipTextoAtivo]}>Sem categoria</Text>
            </TouchableOpacity>

            {categoriasDoTipo.map((cat) => {
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
        </View>

        {/* Status */}
        <OptionSelector
          label="Situação do Lançamento"
          options={[
            { label: 'Confirmado / Pago', value: 'confirmado' },
            { label: 'Pendente / Agendado', value: 'pendente' }
          ]}
          selectedValue={status}
          onSelect={(s) => setStatus(s as 'confirmado' | 'pendente')}
        />

        {/* Opção de Parcelamento */}
        {tipo === 'despesa' && (
          <View style={styles.parcelamentoCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.parcelamentoTitulo}>Parcelar esta compra?</Text>
                <Text style={styles.parcelamentoDesc}>Gera as parcelas mensais automaticamente</Text>
              </View>
              <Switch
                value={isParcelado}
                onValueChange={setIsParcelado}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            {isParcelado && (
              <View style={styles.parcelasCampos}>
                <Input
                  label="Quantidade de Parcelas"
                  placeholder="Ex: 3"
                  keyboardType="numeric"
                  value={totalParcelas}
                  onChangeText={setTotalParcelas}
                  error={erros.parcelas}
                />
                <Input
                  label="Data do 1º Vencimento (AAAA-MM-DD)"
                  placeholder="2026-10-03"
                  value={primeiroVencimento}
                  onChangeText={setPrimeiroVencimento}
                  error={erros.vencimento}
                />
              </View>
            )}
          </View>
        )}

        <Input
          label="Observações / Anotações"
          placeholder="Detalhes adicionais (opcional)"
          value={observacao}
          onChangeText={setObservacao}
          multiline
          numberOfLines={2}
        />

        <View style={styles.actions}>
          <Button title="Salvar Transação" onPress={handleSalvar} loading={loading} />
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
  rowJustify: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  linkTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary
  },
  chipsScroll: {
    gap: 8,
    paddingVertical: 4
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  chipAtivo: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  chipTexto: {
    fontSize: 13,
    color: colors.muted
  },
  chipTextoAtivo: {
    color: colors.primary,
    fontWeight: '700'
  },
  pontoCor: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8
  },
  alerta: {
    padding: 12,
    backgroundColor: colors.warningLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warning,
    gap: 6
  },
  alertaTexto: {
    fontSize: 13,
    color: colors.text
  },
  parcelamentoCard: {
    backgroundColor: colors.background,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  parcelamentoTitulo: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  parcelamentoDesc: {
    fontSize: 12,
    color: colors.muted
  },
  parcelasCampos: {
    gap: 10,
    marginTop: 6
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
