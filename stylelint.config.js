export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['coverage/**', 'dist/**', 'node_modules/**'],
  rules: {
    'alpha-value-notation': null,
    'color-function-alias-notation': null,
    'color-function-notation': null,
    'custom-property-empty-line-before': null,
    'media-feature-range-notation': null,
    'no-descending-specificity': null,
    'selector-class-pattern': null,
  },
};
