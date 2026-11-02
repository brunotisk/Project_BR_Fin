import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { colors } from '../theme'

type Props = {
  title: string
  onPress: () => unknown
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}

export function Button({ title, onPress, loading, disabled, variant = 'primary' }: Props) {
  const secondary = variant === 'secondary'
  const inactive = Boolean(disabled || loading)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      disabled={inactive}
      onPress={() => {
        void onPress()
      }}
      style={[styles.button, secondary && styles.secondary, inactive && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.text : '#fff'} />
      ) : (
        <Text style={[styles.text, secondary && styles.secondaryText]}>{title}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingHorizontal: 16 },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  disabled: { opacity: 0.55 },
  text: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryText: { color: colors.text }
})
