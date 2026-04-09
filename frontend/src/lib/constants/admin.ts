/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-06 23:09:05
 * @LastEditTime: 2026-02-27 18:28:03
 * @LastEditors: 安知鱼
 */
/** 通用每页条数选项 */
export const PAGE_SIZES = [10, 20, 50];

/** 默认封面图 */
export const FALLBACK_COVER = "/images/default-cover.webp";

/** 后台表格空状态文案配置 */
export interface TableEmptyTexts {
  filterEmptyText: string;
  emptyText: string;
  filterHint?: string;
  emptyHint?: string;
  actionLabel?: string;
}

export const ADMIN_EMPTY_TEXTS = {
  posts: {
    filterEmptyText: "没有匹配的文章",
    emptyText: "还没有文章",
    emptyHint: "点击「新建文章」开始你的创作之旅",
    actionLabel: "新建文章",
  },
  users: {
    filterEmptyText: "没有匹配的用户",
    emptyText: "暂无用户数据",
    emptyHint: "点击「新增用户」添加第一个用户",
  },
  albums: {
    filterEmptyText: "没有匹配的图片",
    emptyText: "还没有相册图片",
    emptyHint: "点击「添加图片」开始上传",
    actionLabel: "添加图片",
  },
  docSeries: {
    filterEmptyText: "没有匹配的文档系列",
    emptyText: "还没有文档系列",
    emptyHint: "点击「新增系列」创建第一个文档系列",
    actionLabel: "新增系列",
  },
  comments: {
    filterEmptyText: "没有匹配的评论",
    emptyText: "还没有评论",
    emptyHint: "用户发表评论后将在这里显示",
  },
  friends: {
    filterEmptyText: "没有匹配的友链",
    emptyText: "还没有友链",
    filterHint: "试试调整筛选条件",
    emptyHint: "点击「新建友链」开始添加",
    actionLabel: "添加友链",
  },
  orders: {
    filterEmptyText: "没有匹配的订单",
    emptyText: "暂无订单数据",
    filterHint: "请尝试调整筛选条件",
  },
  supports: {
    filterEmptyText: "没有匹配的工单",
    emptyText: "暂无工单",
    emptyHint: "当用户提交售后问题后会显示在这里",
  },
  products: {
    filterEmptyText: "没有匹配的商品",
    emptyText: "暂无商品",
    emptyHint: "点击「新增商品」创建第一件商品",
  },
  pages: {
    filterEmptyText: "没有匹配的页面",
    emptyText: "还没有自定义页面",
    emptyHint: "点击「新建页面」创建隐私政策、关于等静态页面",
    actionLabel: "新建页面",
  },
} as const satisfies Record<string, TableEmptyTexts>;
