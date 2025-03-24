import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts({ insertTypesEntry: true })],
  build: {
    lib: {
      entry: {
        sleek: './src/main.ts',
        components: './src/components/index.ts',
      },
      name: 'sleek',

    },
    rollupOptions: {
      output: [
        // Remove hash from files referenced via `import.meta.glob`
        {
          format: 'es',
          chunkFileNames: '[name].js',
        },
        {
          format: 'cjs',
          chunkFileNames: '[name].cjs',
        },
      ]
    }
  }
});
