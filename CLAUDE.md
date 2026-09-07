本项目是 wdz-ai V2 的开发者自测 UI（React/Vite/antd），先读 README.md；方案分期在后端仓库 docs/wdz-ai/react-ui-plan.md。
- 只加页面/组件，不改 jar 内 HTML 页面；接口字段以后端 WdzAiV2VO/Request 为准。
- 19 位 id 一律字符串；标记值域改动要同步 constants/marks.ts 与后端 @Pattern。
- 自测：preview_start `wdz-ui`，用 `window.__t`（src/test/hooks.ts）做文本断言，少截图。
