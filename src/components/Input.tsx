import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native'
import { colors } from '../theme'

interface InputProps extends TextInputProps {
  label: string
  error?: string
  hint?: string
  prefix?: string
}

export function Input({ label, error, hint, prefix, style, ...rest }: InputProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, !!error && styles.inputError]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor={colors.muted}
          style={[styles.input, style]}
          {...rest}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    marginBottom: 4
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 14
  },
  inputError: {
    borderColor: colors.expense
  },
  prefix: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.muted,
    marginRight: 6
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 10
  },
  errorText: {
    fontSize: 12,
    color: colors.expense
  },
  hintText: {
    fontSize: 12,
    color: colors.muted
  }
})
