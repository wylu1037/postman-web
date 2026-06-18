/** @type {import('prettier').Config} */
const config = {
  plugins: ['prettier-plugin-tailwindcss'],
  singleQuote: true,
  trailingComma: 'none',
  tailwindStylesheet: './src/app/globals.css',
  tailwindFunctions: ['cn', 'clsx', 'cva']
};

export default config;
