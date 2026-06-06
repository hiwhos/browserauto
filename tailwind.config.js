/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/popup/**/*.{ts,tsx}',
    './src/sidepanel/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
};
