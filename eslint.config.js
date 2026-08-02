import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  ignores: [
    'dev-dist',
    'dist',
    '.impeccable',
  ],
  rules: {
    'node/prefer-global/process': 'off',
    'ts/no-use-before-define': 'off',
    'ts/consistent-type-definitions': ['error', 'interface'],
    'vue/custom-event-name-casing': 'off',
  },
})
