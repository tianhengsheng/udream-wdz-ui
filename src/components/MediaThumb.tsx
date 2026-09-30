import { Image } from 'antd';

/** 缩略图点击预览（antd Image 自带预览层，替代 v2 的 imagePreviewModal） */
export function MediaThumb({ url, avatar }: { url?: string; label?: string; avatar?: boolean }) {
  if (!url) return <span style={{ color: '#999' }}>-</span>;
  const size = avatar ? 28 : 40;
  // 阻止冒泡：缩略图及其预览层（Portal 内的点击仍沿 React 树冒泡）的点击不能触发表格行点击（行点击会打开排队订单抽屉）
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <Image src={url} width={size} height={size} style={{ objectFit: 'cover', borderRadius: avatar ? '50%' : 4 }} />
    </span>
  );
}
