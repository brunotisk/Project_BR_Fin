import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme'

export interface OptionItem<T extends string | number> {
  label: string
  value: T
  color?: string
  icon?: string
}

interface OptionSelectorProps<T extends string | number> {
  label?: string
  options: OptionItem<T>[]
  selectedValue: T
  onSelect: (value: T) => void
  error?: string
}

export function OptionSelector<T extends string | number>({
  label,
  options,
  selectedValue,
  onSelect,
  error
}: OptionSelectorProps<T>) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.optionsGrid}>
        {options.map((opt) => {
          const isSelected = opt.value === selectedValue
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => onSelect(opt.value)}
              style={[
                styles.optionButton,
                isSelected && styles.optionSelected,
                opt.color && isSelected ? { borderColor: opt.color, backgroundColor: opt.color + '15' } : undefined
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  isSelected && styles.optionTextSelected,
                  opt.color && isSelected ? { color: opt.color } : undefined
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginBottom: 4
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  optionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  optionText: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: '500'
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '700'
  },
  errorText: {
    fontSize: 12,
    color: colors.expense
  }
})
