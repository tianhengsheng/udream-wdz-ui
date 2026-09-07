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
src/pages/risk/        私单AI行为检测：RiskListTab 风险列表 / StoreRankingTab 门店排行（→EventQueueModal 查看事件与排队）/ BatchReviewTab 批量核查
src/pages/records/     核查日志
src/pages/rules/       行为权重配置：RulesPage 规则表 / RuleConfigModal 检测配置弹窗（constants/ruleDefaults.ts 默认值与 detection 结构）/ RuleDetectionModal 规则监测 / MaintenanceCard 维护区（门店×日期重算、清理门店日数据默认试运行）
src/components/dialogs/ 全局弹窗：CalculationModal 详情/计算过程、ReviewModal 标记、RecordModal 操作记录、AttendanceModal 打卡、OrdersDrawer 排队订单
src/store/useDialogs.ts 全局弹窗状态 + refreshTick（标记提交后各列表自动刷新）
src/test/hooks.ts      window.__t（nav/click/type/select/setFilter/setToken/snap/table/toasts）
```

## 经网关的路径前缀
unified-service 在网关的路由是 `Paths=/mgt/**,/mgt/unified/**` + StripPrefix=1（本地网关 actuator 实测），所以网关档 envs.ts 用 serviceOverrides 把 `/unified` 补成 `/mgt/unified/...`；`/uc/user/login` 等仍是根路由。本地网关经 Nacos 负载到 unified-service 的所有注册实例（可用 `curl localhost:20000/actuator/gateway/routes` 看当前解析到哪台），若别的机器也注册了实例，请求可能落到非本机代码。改 envs.ts 的代理规则后必须重启 vite。

## 写接口需要有效 token
读接口（列表/详情/排行）本地直连不需 token；**标记提交等写接口**后端从 att 取操作人，无 token 或 token 过期返回 `000006 登录状态已失效`（UI 会弹 token 提示）。jar 内 HTML 页存在 localStorage 的 token 过期后同样提交不了。用 dev/newdev/test 环境账号密码登录一次，同桶 token 互通。

## 红线
- eventId / storeId / orgId 全链路字符串，禁 Number()。
- 剔分口径（excluded 显 "-"）、排行订单三列、窗口聚合全部信后端，前端不做聚合。
- 导出直接调后端任务中心接口。
