import { useState } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../services/AuthProvider'
import { colors } from '../theme'
import { notify } from '../utils/notify'

export function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erros, setErros] = useState<{ [key: string]: string }>({})

  function validarEmail(emailStr: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)
  }

  async function handleAcaoPrincipal() {
    const novosErros: { [key: string]: string } = {}

    if (!email.trim()) {
      novosErros.email = 'Informe seu e-mail'
    } else if (!validarEmail(email.trim())) {
      novosErros.email = 'E-mail em formato inválido'
    }

    if (!password.trim()) {
      novosErros.password = 'Informe sua senha'
    }

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros)
      return
    }

    setErros({})
    setLoading(true)

    try {
      const { error } = await signIn(email.trim(), password)
      if (error) {
        notify('Não foi possível entrar', error.message || 'Verifique suas credenciais e tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Identidade visual do PWA */}
        <View style={styles.brandContainer}>
          <View pointerEvents="none" style={styles.artCircleLarge} />
          <View pointerEvents="none" style={styles.artCircleSmall} />
          <Image source={require('../../assets/plenna/icon-192.png')} style={styles.brandLogo} resizeMode="contain" />
          <Text style={styles.brandTitle}>Plenna</Text>
          <Text style={styles.brandSubtitle}>FINANÇAS  •  AGENDA  •  TAREFAS</Text>
        </View>

        {/* Card Principal */}
        <View style={styles.card}>
          {/* Formulário */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>Acesse sua conta</Text>
            <Text style={styles.formSubtitle}>Entre com seu e-mail e senha para continuar.</Text>

            {/* Campo E-mail */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>E-mail</Text>
              <View style={[styles.inputBox, !!erros.email && styles.inputBoxError]}>
                <Ionicons name="mail-outline" size={20} color={colors.muted} style={styles.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seu@email.com"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  returnKeyType="next"
                  style={styles.textInput}
                />
              </View>
              {erros.email ? <Text style={styles.errorText}>{erros.email}</Text> : null}
            </View>

            {/* Campo Senha */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Senha</Text>
              <View style={[styles.inputBox, !!erros.password && styles.inputBoxError]}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.muted} style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Sua senha secreta"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!mostrarSenha}
                  returnKeyType="go"
                  onSubmitEditing={handleAcaoPrincipal}
                  style={styles.textInput}
                />
                <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)} style={styles.eyeBtn}>
                  <Ionicons
                    name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.muted}
                  />
                </TouchableOpacity>
              </View>
              {erros.password ? <Text style={styles.errorText}>{erros.password}</Text> : null}
            </View>

            {/* Botão Principal com Efeito Visual */}
            <TouchableOpacity
              onPress={handleAcaoPrincipal}
              disabled={loading}
              style={[styles.btnPrincipal, loading && styles.btnDesabilitado]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.btnContent}>
                  <Text style={styles.btnPrincipalTexto}>
                    Entrar no sistema
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Rodapé de Segurança e Privacidade */}
        <View style={styles.footer}>
          <Ionicons name="shield-checkmark" size={16} color={colors.income} />
          <Text style={styles.footerTexto}>
            Seus dados são criptografados com segurança de ponta a ponta
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center'
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 22,
    paddingVertical: 25,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: colors.primary,
    overflow: 'hidden'
  },
  artCircleLarge: {
    position: 'absolute',
    width: 230,
    height: 130,
    top: -76,
    right: -34,
    borderRadius: 115,
    backgroundColor: '#8DBB9A',
    opacity: 0.75,
    transform: [{ rotate: '-18deg' }]
  },
  artCircleSmall: {
    position: 'absolute',
    width: 180,
    height: 95,
    bottom: -65,
    left: -34,
    borderRadius: 90,
    backgroundColor: '#C7E66B',
    opacity: 0.9,
    transform: [{ rotate: '-18deg' }]
  },
  brandLogo: {
    width: 66,
    height: 66,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,243,234,0.28)'
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#F5F3EA',
    letterSpacing: -0.5
  },
  brandSubtitle: {
    fontSize: 10,
    color: '#DCE8DC',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 280,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 1.5
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3
  },
  form: {
    gap: 16
  },
  formTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3
  },
  formSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: -10,
    marginBottom: 2
  },
  inputGroup: {
    gap: 6
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: 14
  },
  inputBoxError: {
    borderColor: colors.expense,
    backgroundColor: colors.expenseLight + '20'
  },
  inputIcon: {
    marginRight: 10
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 12
  },
  eyeBtn: {
    padding: 6
  },
  errorText: {
    fontSize: 12,
    color: colors.expense,
    marginTop: 2
  },
  btnPrincipal: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3
  },
  btnDesabilitado: {
    opacity: 0.6
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  btnPrincipalTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24
  },
  footerTexto: {
    fontSize: 12,
    color: colors.muted
  }
})
