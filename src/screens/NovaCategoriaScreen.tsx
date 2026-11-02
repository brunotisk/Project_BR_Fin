import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../services/supabase'
import { TipoTransacao } from '../types'
import { colors } from '../theme'
import { Input } from '../components/Input'
import { OptionSelector } from '../components/OptionSelector'
import { Button } from '../components/Button'
import { notify } from '../utils/notify'

const TIPOS_CATEGORIA: { label: string; value: TipoTransacao }[] = [
  { label: 'Despesa', value: 'despesa' },
  { label: 'Receita', value: 'receita' }
]

const ICONES_SUGERIDOS: (keyof typeof Ionicons.glyphMap)[] = [
  'cart-outline', 'restaurant-outline', 'car-outline', 'home-outline',
  'cash-outline', 'fitness-outline', 'airplane-outline', 'medical-outline',
  'school-outline', 'game-controller-outline', 'gift-outline', 'briefcase-outline'
]

const CORES_CATEGORIA = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
  '#2563EB', '#6366F1', '#8B5CF6', '#EC4899', '#64748B'
]

export function NovaCategoriaScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoTransacao>('despesa')
  const [icone, setIcone] = useState<keyof typeof Ionicons.glyphMap>('cart-outline')
  const [cor, setCor] = useState(CORES_CATEGORIA[0])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSalvar() {
    if (!nome.trim()) {
      setErro('Informe o nome da categoria')
      return
    }

    setLoading(true)
    setErro('')

    try {
      const { error } = await supabase.from('categorias').insert({
        nome: nome.trim(),
        tipo,
        icone,
        cor
      })

      if (error) throw error

      notify('Sucesso!', 'Categoria criada com sucesso.')
      navigation.goBack()
    } catch (err: any) {
      notify('Erro ao salvar categoria', err?.message || 'Falha ao cadastrar categoria.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nova Categoria</Text>
      <Text style={styles.subtitle}>Organize seus lançamentos por categorias</Text>

      <View style={styles.form}>
        <OptionSelector
          label="Tipo da Categoria *"
          options={TIPOS_CATEGORIA}
          selectedValue={tipo}
          onSelect={(val) => {
            const novoTipo = val as TipoTransacao
            setTipo(novoTipo)
            if (novoTipo === 'receita') {
              setCor('#10B981')
              setIcone('cash-outline')
            } else {
              setCor('#EF4444')
              setIcone('cart-outline')
            }
          }}
        />

        <Input
          label="Nome da Categoria *"
          placeholder={tipo === 'despesa' ? 'Ex: Mercado, Transporte, Lazer' : 'Ex: Salário, Rendimentos, Vendas'}
          value={nome}
          onChangeText={setNome}
          error={erro}
        />

        <View style={styles.section}>
          <Text style={styles.label}>Ícone</Text>
          <View style={styles.iconesGrid}>
            {ICONES_SUGERIDOS.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setIcone(item)}
                style={[
                  styles.iconeBtn,
                  icone === item && { backgroundColor: cor + '20', borderColor: cor }
                ]}
              >
                <Ionicons
                  name={item}
                  size={24}
                  color={icone === item ? cor : colors.muted}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Cor da Categoria</Text>
          <View style={styles.coresGrid}>
            {CORES_CATEGORIA.map((c) => (
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
          <Button title="Salvar Categoria" onPress={handleSalvar} loading={loading} />
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
  iconesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  iconeBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
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
