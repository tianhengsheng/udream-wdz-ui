# udream-wdz-ui

万店长（wdz-ai V2）开发者自测 UI。**纯自测工具，jar 内 `static/ai/v2` 页面不动**；只对接 WdzAiV2Controller 31 个端点。
方案与分期见后端仓库 `docs/wdz-ai/react-ui-plan.md`。

## 启动
- 后端仓库 `.claude/launch.json` 配置名 `wdz-ui`（preview_start），端口 8080（与 scanbuy-ui/mqtt-ui 互斥）。
- 手动：`npm run dev`。
- 默认环境「本地直连9002」：需本地 IDEA 起 `UnifiedAPP`；unified 自身不鉴权，不设 token 也能查。其他环境走网关，需在右上角设 PC token（粘贴或账号密码登录；本地网关档 PC 登录必 50130，用 dev/newdev/test 登录后同桶互通）。

## 结构
```
src/envs.ts            环境预设（localDirect/local/dev/test/newdev）
src/api/client.ts      axios：att 头注入、/env/{key} 前缀、50120/50130 续登提示、19 位 id 字符串兜底
src/api/wdz.ts         31 端点集中
src/types/wdz.ts       VO/Req 手抄，id 一律 string
src/constants/marks.ts 标记值域（一级 7 个与后端 @Pattern 同步）、应用范围、默认日期 07-01~07-07
src/store/useFilters.ts 私单风险列表筛选 + 当前默认规则 id
src/pages/risk/        私单AI行为检测（RiskListTab 已完成；排行/批量第二期）
src/pages/records/ rules/  第二/三期
src/test/hooks.ts      window.__t（nav/click/type/select/setFilter/setToken/snap/table/toasts）
```

## 红线
- eventId / storeId / orgId 全链路字符串，禁 Number()。
- 剔分口径（excluded 显 "-"）、排行订单三列、窗口聚合全部信后端，前端不做聚合。
- 导出直接调后端任务中心接口。
