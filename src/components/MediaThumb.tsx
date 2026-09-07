import { Image } from 'antd';

/** 缩略图点击预览（antd Image 自带预览层，替代 v2 的 imagePreviewModal） */
export function MediaThumb({ url, avatar }: { url?: string; label?: string; avatar?: boolean }) {
  if (!url) return <span style={{ color: '#999' }}>-</span>;
  const size = avatar ? 28 : 40;
  return <Image src={url} width={size} height={size} style={{ objectFit: 'cover', borderRadius: avatar ? '50%' : 4 }} />;
}
