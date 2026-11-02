import { useState } from 'react'
import {
  ActivityIndicator,
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

const MIN_PASSWORD_LENGTH = 6

export function LoginScreen() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [modo, setModo] = useState<'login' | 'cadastro'>('login')

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false)
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

    if (!password) {
      novosErros.password = 'Informe sua senha'
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      novosErros.password = `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`
    }

    if (modo === 'cadastro') {
      if (!nome.trim()) {
        novosErros.nome = 'Informe seu nome completo'
      }
      if (password !== confirmPassword) {
        novosErros.confirmPassword = 'As senhas não coincidem'
      }
    }

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros)
      return
    }

    setErros({})
    setLoading(true)

    try {
      if (modo === 'login') {
        const { error } = await signIn(email.trim(), password)
        if (error) {
          notify('Não foi possível entrar', error.message || 'Verifique suas credenciais e tente novamente.')
        }
      } else {
        const { error } = await signUp(email.trim(), password, nome.trim())
        if (error) {
          notify('Erro no cadastro', error.message || 'Não foi possível criar sua conta.')
        } else {
          notify(
            'Conta Criada com Sucesso! 🎉',
            'Se a confirmação estiver habilitada no seu projeto, verifique sua caixa de e-mail para validar.'
          )
          setModo('login')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleEsqueciSenha() {
    if (!email.trim() || !validarEmail(email.trim())) {
      notify('Atenção', 'Digite seu e-mail no campo acima para enviarmos o link de recuperação.')
      return
    }

    setLoading(true)
    try {
      const { error } = await resetPassword(email.trim())
      if (error) {
        notify('Erro ao solicitar recuperação', error.message)
      } else {
        notify(
          'E-mail Enviado! 📬',
          `Enviamos as instruções de recuperação para ${email.trim()}. Verifique sua caixa de entrada e spam.`
        )
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
        {/* Topo / Marca com Visual Fintech */}
        <View style={styles.brandContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="wallet" size={36} color="#fff" />
          </View>
          <Text style={styles.brandTitle}>BR Fin</Text>
          <Text style={styles.brandSubtitle}>
            Gestão financeira inteligente, faturas e projeção de cartões
          </Text>
        </View>

        {/* Card Principal */}
        <View style={styles.card}>
          {/* Seletor de Modo (Abas) */}
          <View style={styles.tabSelector}>
            <TouchableOpacity
              onPress={() => {
                setModo('login')
                setErros({})
              }}
              style={[styles.tabButton, modo === 'login' && styles.tabButtonActive]}
            >
              <Text style={[styles.tabText, modo === 'login' && styles.tabTextActive]}>
                Entrar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setModo('cadastro')
                setErros({})
              }}
              style={[styles.tabButton, modo === 'cadastro' && styles.tabButtonActive]}
            >
              <Text style={[styles.tabText, modo === 'cadastro' && styles.tabTextActive]}>
                Criar Conta
              </Text>
            </TouchableOpacity>
          </View>

          {/* Formulário */}
          <View style={styles.form}>
            {/* Campo Nome (Apenas no Cadastro) */}
            {modo === 'cadastro' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Seu Nome Completo</Text>
                <View style={[styles.inputBox, !!erros.nome && styles.inputBoxError]}>
                  <Ionicons name="person-outline" size={20} color={colors.muted} style={styles.inputIcon} />
                  <TextInput
                    value={nome}
                    onChangeText={setNome}
                    placeholder="Ex: Ana Silva"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="words"
                    style={styles.textInput}
                  />
                </View>
                {erros.nome ? <Text style={styles.errorText}>{erros.nome}</Text> : null}
              </View>
            )}

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
                  style={styles.textInput}
                />
              </View>
              {erros.email ? <Text style={styles.errorText}>{erros.email}</Text> : null}
            </View>

            {/* Campo Senha */}
            <View style={styles.inputGroup}>
              <View style={styles.rowBetween}>
                <Text style={styles.inputLabel}>Senha</Text>
                {modo === 'login' && (
                  <TouchableOpacity onPress={handleEsqueciSenha}>
                    <Text style={styles.esqueciSenhaTexto}>Esqueceu a senha?</Text>
                  </TouchableOpacity>
                )}
              </View>
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

            {/* Campo Confirmar Senha (Apenas no Cadastro) */}
            {modo === 'cadastro' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirmar Senha</Text>
                <View style={[styles.inputBox, !!erros.confirmPassword && styles.inputBoxError]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.muted} style={styles.inputIcon} />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Repita sua senha"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!mostrarConfirmarSenha}
                    style={styles.textInput}
                  />
                  <TouchableOpacity
                    onPress={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={mostrarConfirmarSenha ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.muted}
                    />
                  </TouchableOpacity>
                </View>
                {erros.confirmPassword ? (
                  <Text style={styles.errorText}>{erros.confirmPassword}</Text>
                ) : null}
              </View>
            )}

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
                    {modo === 'login' ? 'Entrar no Sistema' : 'Criar Minha Conta'}
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
    marginBottom: 28
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5
  },
  brandSubtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
    lineHeight: 20
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
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    padding: 4,
    borderRadius: 12,
    marginBottom: 20
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  tabButtonActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: '700'
  },
  form: {
    gap: 16
  },
  inputGroup: {
    gap: 6
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text
  },
  esqueciSenhaTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary
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
