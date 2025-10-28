/** @type {import('tailwindcss').Config} */
import preline from 'preline/plugin.js';

export default {
  content: [
    './src/**/*.{html,js}',
    'node_modules/preline/dist/*.js',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    preline,
  ],
};

