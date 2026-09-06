---
status: accepted
date: 2026-09-06
---

# 搜尋改用原生 fetch 呼叫 pokemontcg.io，不使用 pokemontcgsdk

原作的搜尋框透過 `pokemontcgsdk` 查詢 pokemontcg.io。該套件已停止維護，並鎖定舊版 axios 0.x，
安裝後 `npm audit` 回報 2 個高風險漏洞且無法在不降版的前提下修復。搜尋只需要一個 GET 請求，
因此改用原生 `fetch` 直接呼叫 `https://api.pokemontcg.io/v2/cards`，查詢參數與原作相同，
`X-Api-Key` 由 `VITE_API_KEY` 提供（可留空，僅受速率限制）。
