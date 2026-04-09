import {
  Globe,
  Image as ImageIcon,
  Home,
  Sparkles,
  PanelsTopLeft,
  PanelLeft,
  Paintbrush,
  FileText,
  FolderOpen,
  MessageSquare,
  Mail,
  Link2,
  UserCircle,
  Monitor,
  MessageCircle,
  Images,
  Music,
  ShieldCheck,
  Share2,
  DatabaseBackup,
} from "lucide-react";
import type { SettingCategoryId } from "@/lib/settings/setting-descriptors";

export interface SubSection {
  id: SettingCategoryId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
}

export interface CategorySection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: SubSection[];
}

export const settingsCategories: CategorySection[] = [
  {
    id: "site",
    label: "站点信息",
    icon: Globe,
    children: [
      { id: "site-basic", label: "基本信息", icon: Globe, keywords: ["站点名称", "描述", "URL", "备案", "公告"] },
      { id: "site-icon", label: "Logo 与图标", icon: ImageIcon, keywords: ["favicon", "logo", "图标", "PWA"] },
    ],
  },
  {
    id: "appearance",
    label: "外观配置",
    icon: Paintbrush,
    children: [
      {
        id: "appearance-skin",
        label: "换肤与配色",
        icon: Sparkles,
        keywords: ["换肤", "主题", "配色", "品牌色", "语义色", "皮肤"],
      },
      {
        id: "appearance-home",
        label: "首页设置",
        icon: Home,
        keywords: ["首页", "顶部", "banner", "分类", "页脚", "导航"],
      },
      {
        id: "appearance-userpanel",
        label: "顶栏用户面板",
        icon: PanelsTopLeft,
        keywords: ["顶栏", "用户面板", "userpanel", "个人中心", "通知", "后台"],
      },
      { id: "appearance-sidebar", label: "侧边栏", icon: PanelLeft, keywords: ["侧边栏", "作者", "标签", "天气"] },
      { id: "appearance-page", label: "页面样式", icon: Paintbrush, keywords: ["外链", "图片", "一图流", "CSS", "JS"] },
    ],
  },
  {
    id: "content",
    label: "内容管理",
    icon: FileText,
    children: [
      { id: "content-post", label: "文章配置", icon: FileText, keywords: ["文章", "封面", "打赏", "代码块", "复制"] },
      { id: "content-file", label: "文件处理", icon: FolderOpen, keywords: ["上传", "缩略图", "EXIF", "视频"] },
    ],
  },
  {
    id: "user",
    label: "用户通知",
    icon: MessageSquare,
    children: [
      { id: "user-comment", label: "评论系统", icon: MessageSquare, keywords: ["评论", "敏感词", "通知", "审核"] },
      { id: "user-email", label: "邮件服务", icon: Mail, keywords: ["SMTP", "邮件", "模板", "激活"] },
    ],
  },
  {
    id: "pages",
    label: "页面显示",
    icon: Monitor,
    children: [
      { id: "pages-flink", label: "友链管理", icon: Link2, keywords: ["友链", "申请", "审核"] },
      { id: "pages-about", label: "关于页面", icon: UserCircle, keywords: ["关于", "技能", "生涯"] },
      { id: "pages-equipment", label: "装备页面", icon: Monitor, keywords: ["装备", "好物"] },
      { id: "pages-comments", label: "评论页面", icon: MessageCircle, keywords: ["最近评论"] },
      { id: "pages-album", label: "相册页面", icon: Images, keywords: ["相册", "图片", "瀑布流", "画廊"] },
      { id: "pages-music", label: "音乐页面", icon: Music, keywords: ["音乐", "播放器", "歌单", "胶囊", "唱片"] },
    ],
  },
  {
    id: "advanced",
    label: "高级功能",
    icon: ShieldCheck,
    children: [
      {
        id: "advanced-captcha",
        label: "人机验证",
        icon: ShieldCheck,
        keywords: ["Turnstile", "Cloudflare", "极验", "图片验证码", "captcha"],
      },
      { id: "advanced-wechat-share", label: "微信分享", icon: Share2, keywords: ["微信", "分享", "JS-SDK", "公众号"] },
      {
        id: "advanced-backup",
        label: "备份导入",
        icon: DatabaseBackup,
        keywords: ["备份", "导入", "导出", "恢复", "配置"],
      },
    ],
  },
];

export const INDEPENDENT_API_SECTIONS: SettingCategoryId[] = ["advanced-backup"];

export const ALL_CATEGORY_IDS: SettingCategoryId[] = settingsCategories.flatMap(c =>
  c.children.map(s => s.id).filter(id => !INDEPENDENT_API_SECTIONS.includes(id))
);
