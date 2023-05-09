import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    ssr: true,
    lib: {
      entry: ["src/ts-wrapper.ts", "src/polyfill.ts"],
      formats: ["es"],
    },
  },
  plugins: [dts()],
});
