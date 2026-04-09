/**
 * 关于页面配置类型定义
 * 对接后端 siteConfig.about.page 嵌套结构
 */

export interface AboutSiteTips {
  tips: string;
  title1: string;
  title2: string;
  word: string[];
}

export interface AboutMap {
  title: string;
  strengthenTitle: string;
  background: string;
  backgroundDark: string;
}

export interface SelfInfo {
  tips1: string;
  contentYear: string;
  tips2: string;
  content2: string;
  tips3: string;
  content3: string;
}

export interface Personalities {
  tips: string;
  authorName: string;
  personalityType: string;
  personalityTypeColor: string;
  personalityImg: string;
  nameUrl: string;
  photoUrl: string;
}

export interface Maxim {
  tips: string;
  top: string;
  bottom: string;
}

export interface Buff {
  tips: string;
  top: string;
  bottom: string;
}

export interface Game {
  tips: string;
  title: string;
  uid: string;
  background: string;
}

export interface ComicItem {
  name: string;
  cover: string;
  href: string;
}

export interface Comic {
  tips: string;
  title: string;
  list: ComicItem[];
}

export interface Like {
  tips: string;
  title: string;
  bottom: string;
  background: string;
}

export interface Music {
  tips: string;
  title: string;
  link: string;
  background: string;
}

export interface Career {
  desc: string;
  color?: string;
}

export interface Careers {
  tips: string;
  title: string;
  img?: string;
  list?: Career[];
}

export interface SkillsTips {
  tips: string;
  title: string;
}

export interface AboutEnableConfig {
  author_box?: boolean;
  page_content?: boolean;
  skills?: boolean;
  careers?: boolean;
  statistic?: boolean;
  map_and_info?: boolean;
  personality?: boolean;
  photo?: boolean;
  maxim?: boolean;
  buff?: boolean;
  game?: boolean;
  comic?: boolean;
  like_tech?: boolean;
  music?: boolean;
  custom_code?: boolean;
  reward?: boolean;
  comment?: boolean;
}

/** 后端返回的 about.page 嵌套结构 */
export interface AboutPageConfig {
  name: string;
  description: string;
  subtitle: string;
  avatar_img: string;
  avatar_skills_left: string[];
  avatar_skills_right: string[];
  statistics_background: string;
  about_site_tips: AboutSiteTips;
  map: AboutMap;
  self_info: SelfInfo;
  personalities: Personalities;
  maxim: Maxim;
  buff: Buff;
  game: Game;
  comic: Comic;
  like: Like;
  music: Music;
  careers: Careers;
  skills_tips: SkillsTips;
  custom_code_html?: string;
  enable: AboutEnableConfig;
}

/** 打赏记录 */
export interface DonationItem {
  id: number;
  name: string;
  amount: number;
  suffix: string;
  created_at: string;
  status: number;
}

export interface DonationListResponse {
  list: DonationItem[];
  total: number;
  page: number;
  page_size: number;
}
