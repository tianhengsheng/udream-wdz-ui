import { useState, type ComponentType } from 'react';
import { ConfigProvider, Layout, Menu, theme } from 'antd';
import { AuditOutlined, FileSearchOutlined, SettingOutlined } from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import { TopBar } from './components/TopBar';
import { RiskPage } from './pages/risk/RiskPage';
import { RulesPage } from './pages/rules/RulesPage';
import { RecordsPage } from './pages/records/RecordsPage';

/** 左侧菜单与 jar 内 v2 页面一致：行为权重配置 / 私单AI行为检测 / 核查日志 */
const PAGES = [
  { key: 'rules', label: '行为权重配置', icon: <SettingOutlined />, Comp: RulesPage },
  { key: 'risk', label: '私单AI行为检测', icon: <AuditOutlined />, Comp: RiskPage },
  { key: 'records', label: '核查日志', icon: <FileSearchOutlined />, Comp: RecordsPage },
] as const satisfies ReadonlyArray<{ key: string; label: string; icon: React.ReactNode; Comp: ComponentType }>;
type PageKey = (typeof PAGES)[number]['key'];
const PAGE_STORE_KEY = 'udream-wdz-page';

export default function App() {
  const [page, setPage] = useState<PageKey>(() => (PAGES.find((p) => p.key === localStorage.getItem(PAGE_STORE_KEY))?.key ?? 'risk'));
  const Active = PAGES.find((p) => p.key === page)!.Comp;
  return (
    <ConfigProvider locale={zhCN} componentSize="small" theme={{ algorithm: theme.defaultAlgorithm, token: { fontSize: 12, controlHeight: 28, borderRadius: 4 },
      components: { Table: { cellPaddingBlock: 4, cellPaddingInline: 8, headerBg: '#fafafa', fontSize: 12 }, Card: { paddingLG: 12, headerFontSize: 13, headerHeight: 36, headerHeightSM: 32 }, Tag: { fontSize: 11 }, Button: { fontSize: 12 }, Descriptions: { itemPaddingBottom: 4 } } }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Sider theme="light" width={170} style={{ borderRight: '1px solid #f0f0f0' }}>
          <div style={{ padding: '10px 16px', fontWeight: 600 }}>万店长自测 UI</div>
          <Menu mode="inline" selectedKeys={[page]} onClick={(e) => { setPage(e.key as PageKey); localStorage.setItem(PAGE_STORE_KEY, e.key); }}
            items={PAGES.map((p) => ({ key: p.key, icon: p.icon, label: p.label }))} style={{ borderInlineEnd: 'none' }} />
        </Layout.Sider>
        <Layout style={{ background: '#f5f5f5' }}>
          <TopBar />
          <Active />
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
