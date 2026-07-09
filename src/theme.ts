import { createTheme, type MantineThemeOverride } from '@mantine/core'

export const theme: MantineThemeOverride = createTheme({
  primaryColor: 'grape',
  colors: {
    dark: [
      '#C1C2C5',
      '#A6A7AB',
      '#909296',
      '#5C5F66',
      '#373A40',
      '#2C2E33',
      '#25262B',
      '#1A1B1E',
      '#141517',
      '#101113',
    ],
  },
  fontFamily: 'Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif',
  fontFamilyMonospace: 'Cascadia Code, Fira Code, monospace',
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Slider: {
      defaultProps: {
        size: 'sm',
      },
    },
    Switch: {
      defaultProps: {
        size: 'sm',
      },
    },
  },
})

export const corruptionVariables = {
  applyCorruption(cssVars: Record<string, string>): string {
    return Object.entries(cssVars)
      .map(([key, value]) => `${key}: ${value};`)
      .join('\n')
  },
}

export const denialFilters = {
  blur: (px: number) => `blur(${px}px)`,
  saturate: (percent: number) => `saturate(${percent}%)`,
  brightness: (percent: number) => `brightness(${percent}%)`,
  hueRotate: (degrees: number) => `hue-rotate(${degrees}deg)`,
  combine: (filters: string[]) => filters.filter(Boolean).join(' '),
}
