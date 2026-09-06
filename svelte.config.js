import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    // 卡牌元件（src/lib）維持 Svelte 3 語法，以 legacy mode 執行；
    // 新元件使用 runes。Svelte 5 會依檔案自動判斷模式。
  }
}
