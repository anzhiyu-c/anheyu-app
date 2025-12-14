# 欢迎使用 Anheyu-App

这是一篇系统生成的默认文章，你可以编辑或删除它。

## 段落文本 p

```markdown
<font color=#00ffff size=7> color=#00ffff </font>

<p style="text-align: left">我是居中文字</p>
<font color=#00ffff size=7> color=#00ffff </font>
<p style="text-align: left">我是居中文字</p>
<font color=#00ffff size=7> color=#00ffff </font>
<p style="text-align: left">我是居中文字</p>
<font color=#00ffff size=7> color=#00ffff </font>
<p style="text-align: left">我是居中文字</p>
<font color=#00ffff size=7> color=#00ffff </font>
<p style="text-align: left">我是居中文字</p>
<font color=#00ffff size=7> color=#00ffff </font>
<p style="text-align: left">我是居中文字</p>
<font color=#00ffff size=7> color=#00ffff </font>
<p style="text-align: left">我是居中文字</p>
```

:::tabs

== tab 标签语法

```markdown
<font color=#00ffff size=7> color=#00ffff </font>

<p style="text-align: left">我是居中文字</p>
```

== tab 配置参数

颜色: color 十六进制值
大小: size 数字值(number)

p 标签支持写 自定义 css

== tab 样式预览

<font color=#00ffff size=7> color=#00ffff </font>

<p style="text-align: left">我是居中文字</p>

== tab 示例源码

```markdown
<font color=#00ffff size=7> color=#00ffff </font>

<p style="text-align: left">我是居中文字</p>
```

:::

### 🤖 基本演示

**加粗**，<u>下划线</u>，_斜体_，~~删除线~~，上标^26^，下标~1~，`inline code`，[超链接](https://github.com/anzhiyu-c)

> 引用：《I Have a Dream》

1. So even though we face the difficulties of today and tomorrow, I still have a dream.
2. It is a dream deeply rooted in the American dream.
3. I have a dream that one day this nation will rise up.

- [ ] 周五
- [ ] 周六
- [x] 周天

![图片](https://imzbf.github.io/md-editor-rt/imgs/mark_emoji.gif)

## 🤗 代码演示

```vue
<template>
  <MdEditor v-model="text" />
</template>

<script setup>
import { ref } from "vue";
import { MdEditor } from "md-editor-v3";
import "md-editor-v3/lib/style.css";

const text = ref("Hello Editor!");
</script>
```

## 🖨 文本演示

依照普朗克长度这项单位，目前可观测的宇宙的直径估计值（直径约 930 亿光年，即 8.8 × 10^26^ 米）即为 5.4 × 10^61^倍普朗克长度。而可观测宇宙体积则为 8.4 × 10^184^立方普朗克长度（普朗克体积）。

## 📈 表格演示

| 表头 1 |  表头 2  | 表头 3 |
| :----- | :------: | -----: |
| 左对齐 | 中间对齐 | 右对齐 |

## 📏 公式

行内：$x+y^{2x}$

$$
\sqrt[3]{x}
$$

## 🧬 图表

```mermaid
flowchart TD
  Start --> Stop
```

```mermaid
---
title: Example Git diagram
---
gitGraph
   commit
   commit
   branch develop
   checkout develop
   commit
   commit
   checkout main
   merge develop
   commit
   commit
```

## 🪄 提示

!!! success 支持的类型

note、abstract、info、tip、success、question、warning、failure、danger、bug、example、quote、hint、caution、error、attention

!!!

## 折叠框

1. 折叠框
   ::: folding
   查看详情
   这是折叠框的内容
   :::
2. 默认打开的折叠框
   ::: folding open
   查看默认打开的折叠框
   这是一个默认打开的折叠框。
   :::
3. 带十六进制颜色
   ::: folding #ca1b1b
   查看红色折叠框
   这是一个红色主题的折叠框。
   :::
4. 带颜色且默认打开
   ::: folding open #ca1b1b
   查看默认打开的红色折叠框
   这是一个默认打开的红色折叠框。
   :::

## 隐藏块

:::hidden display=查看答案 bg=#FF7242 color=#fff
傻子，怎么可能有答案
:::

这是一个谜语：为什么西装很酷？{hide display=查看答案 bg=#FF7242 color=#fff}因为西装裤(C 装酷){/hide}

## 文本

这是{u}带下划线的文本{/u}

这是{emp}带着重号的文本{/emp}

这是{wavy}带波浪线的文本{/wavy}

这是{del}带删除线的文本{/del}

按{kbd}command + D{/kbd}可以复制当前行

密码是：{psw}这里没有验证码{/psw}

这是{u color=#FF0000}红色下划线{/u}文本

这是{emp color=#0066FF}蓝色着重号{/emp}文本

这是{wavy color=#00CC66}绿色波浪线{/wavy}文本

这是{del color=#9933FF}紫色删除线{/del}文本

按{kbd color=#FF6600}Ctrl + C{/kbd}复制

密码：{psw color=#FF69B4}secret123{/psw}

## 按钮

:::tabs active=3

== tab 标签语法

```markdown
{btn url=链接地址 text=按钮文字}{/btn}

{btn url=链接地址 text=按钮文字 icon=图标类名 color=颜色 style=样式 layout=布局 position=位置 size=大小}{/btn}
```

== tab 配置参数

**必填参数**：

- `url`: 链接地址
- `text`: 按钮文字

**可选参数**：

- `icon`: 图标类名（默认：anzhiyu-icon-circle-arrow-right）
- `color`: 颜色主题
  - default（默认主题色）
  - blue（蓝色）
  - pink（粉色）
  - red（红色）
  - purple（紫色）
  - orange（橙色）
  - green（绿色）
- `style`: 按钮样式
  - 留空（实心按钮，默认）
  - outline（空心按钮）
- `layout`: 布局方式
  - 留空（行内布局，默认）
  - block（块级布局）
- `position`: 按钮位置（仅 layout=block 时有效）
  - 留空（左对齐，默认）
  - center（居中）
  - right（右对齐）
- `size`: 按钮大小
  - 留空（普通大小，默认）
  - larger（大号按钮）

== tab 样式预览

**基础按钮**

{btn url=https://blog.anheyu.com/ text=AnZhiYu}{/btn}

**颜色主题**

{btn url=# text=Default}{/btn}
{btn url=# text=Blue color=blue}{/btn}
{btn url=# text=Pink color=pink}{/btn}
{btn url=# text=Red color=red}{/btn}
{btn url=# text=Purple color=purple}{/btn}
{btn url=# text=Orange color=orange}{/btn}
{btn url=# text=Green color=green}{/btn}

**空心按钮**

{btn url=# text=Default style=outline}{/btn}
{btn url=# text=Blue color=blue style=outline}{/btn}
{btn url=# text=Pink color=pink style=outline}{/btn}
{btn url=# text=Green color=green style=outline}{/btn}

**块级按钮（左中右）**

{btn url=# text=左对齐按钮 layout=block}{/btn}
{btn url=# text=居中按钮 layout=block position=center}{/btn}
{btn url=# text=右对齐按钮 layout=block position=right}{/btn}

**大号按钮**

{btn url=# text=大号实心按钮 color=purple size=larger}{/btn}
{btn url=# text=大号空心按钮 color=orange style=outline size=larger}{/btn}

**自定义图标**

{btn url=https://github.com text=GitHub icon=anzhiyu-icon-github color=blue}{/btn}
{btn url=# text=下载 icon=anzhiyu-icon-download color=green}{/btn}

== tab 示例源码

```markdown
<!-- 基础用法 -->

{btn url=https://blog.anheyu.com/ text=AnZhiYu}{/btn}

<!-- 带颜色 -->

{btn url=# text=蓝色按钮 color=blue}{/btn}
{btn url=# text=粉色按钮 color=pink}{/btn}

<!-- 空心样式 -->

{btn url=# text=空心按钮 style=outline}{/btn}
{btn url=# text=蓝色空心 color=blue style=outline}{/btn}

<!-- 块级布局 -->

{btn url=# text=左对齐 layout=block}{/btn}
{btn url=# text=居中 layout=block position=center}{/btn}
{btn url=# text=右对齐 layout=block position=right}{/btn}

<!-- 大号按钮 -->

{btn url=# text=大按钮 size=larger}{/btn}

<!-- 组合使用 -->

{btn url=# text=立即开始 color=green layout=block position=center size=larger}{/btn}

<!-- 自定义图标 -->

{btn url=https://github.com text=GitHub icon=anzhiyu-icon-github color=blue}{/btn}

<!-- 多按钮并排 -->

{btn url=#download text=下载 color=blue}{/btn}
{btn url=#docs text=文档 color=green}{/btn}
{btn url=#about text=关于 color=orange style=outline}{/btn}
```

== tab 高级技巧

**响应式按钮组**

在移动端和桌面端都能良好展示的按钮组合：

{btn url=#feature1 text=功能一 color=blue}{/btn}
{btn url=#feature2 text=功能二 color=green}{/btn}
{btn url=#feature3 text=功能三 color=orange}{/btn}

**行动号召按钮**

突出重要操作的大号居中按钮：

{btn url=#start text=立即开始使用 color=purple layout=block position=center size=larger}{/btn}

**次要操作按钮**

使用空心样式表示次要操作：

{btn url=#learn text=了解更多 style=outline layout=block position=center}{/btn}

== tab 最佳实践

1. **颜色选择**

   - 主要操作用实心按钮（默认、blue、green）
   - 次要操作用空心按钮（outline）
   - 警告操作用 red 或 orange
   - 特殊强调用 pink 或 purple

2. **布局建议**

   - 多个按钮并排时使用行内布局（默认）
   - 单个重要按钮使用块级居中布局
   - 表单提交按钮使用块级布局

3. **尺寸使用**

   - 普通内容使用默认尺寸
   - 重要行动号召使用 larger 尺寸
   - 移动端考虑使用 larger 增加点击区域

4. **图标规范**
   - 外链使用 anzhiyu-icon-external-link
   - 下载使用 anzhiyu-icon-download
   - GitHub 使用 anzhiyu-icon-github
   - 默认箭头 anzhiyu-icon-circle-arrow-right

:::

## 按钮组

:::tabs active=3

== tab 标签语法

```markdown
:::btns

- icon=图标类名 title=标题 url=链接地址 desc=描述文字
- icon=图标类名 title=标题 url=链接地址 desc=描述文字
  :::
```

完整格式：

```markdown
:::btns cols=列数 style=样式

- icon=图标类名 title=标题 url=链接地址 desc=描述文字 color=颜色
- icon=图标类名 title=标题 url=链接地址 desc=描述文字 color=颜色
  :::
```

== tab 配置参数

**容器参数**（在 `:::btns` 后指定）：

- `cols`: 列数，默认为 3，范围 1-6
- `style`: 样式风格，可选 `default`、`card`、`simple`

**按钮参数**：

- `icon`: 图标（必填），支持三种格式：
  - AnZhiYu 图标：如 `anzhiyu-icon-user-3-fill`
  - Iconify 图标：如 `ri:github-fill`、`mdi:home`（格式为 `prefix:name`）
  - 图片链接：支持 http:// 或 https:// 开头的图片 URL
- `title`: 按钮标题（必填）
- `url`: 链接地址，默认为 `#`
- `desc`: 描述文字（可选）
- `color`: 按钮颜色（可选）
  - blue（蓝色）
  - pink（粉色）
  - red（红色）
  - purple（紫色）
  - orange（橙色）
  - green（绿色）

== tab 样式预览

**团队成员展示**

:::btns cols=3

- icon=anzhiyu-icon-shapes title=安知鱼 url=https://blog.anheyu.com desc=创始人·全栈开发 color=blue
- icon=anzhiyu-icon-shapes title=张小明 url=# desc=前端工程师 color=green
- icon=anzhiyu-icon-shapes title=李小红 url=# desc=UI/UX 设计师 color=pink
- icon=anzhiyu-icon-shapes title=王小刚 url=# desc=后端工程师 color=purple
- icon=anzhiyu-icon-shapes title=刘小丽 url=# desc=产品经理 color=orange
- icon=anzhiyu-icon-shapes title=赵小强 url=# desc=测试工程师 color=red

:::

**友情链接（4 列）**

:::btns cols=4

- icon=anzhiyu-icon-link title=安知鱼博客 url=https://blog.anheyu.com desc=技术分享与生活记录
- icon=anzhiyu-icon-link title=Hexo url=https://hexo.io desc=快速、简洁的博客框架
- icon=anzhiyu-icon-link title=Vue.js url=https://vuejs.org desc=渐进式 JavaScript 框架
- icon=anzhiyu-icon-link title=TypeScript url=https://www.typescriptlang.org desc=JavaScript 的超集

:::

**社交媒体链接（5 列）**

:::btns cols=5

- icon=anzhiyu-icon-github-fill title=GitHub url=https://github.com color=blue
- icon=anzhiyu-icon-twitter-fill title=Twitter url=https://twitter.com color=blue
- icon=anzhiyu-icon-bilibili-fill title=Bilibili url=https://bilibili.com color=pink
- icon=anzhiyu-icon-wechat-fill title=微信 url=# color=green
- icon=anzhiyu-icon-qq-fill title=QQ url=# color=blue

:::

**简单列表（2 列）**

:::btns cols=2

- icon=anzhiyu-icon-file-text title=文档 url=# desc=查看完整文档 color=blue
- icon=anzhiyu-icon-github title=源码 url=# desc=GitHub 仓库 color=purple

:::

== tab 使用示例

**示例 1：团队成员页面**

展示团队成员信息，使用 3 列布局：

```markdown
:::btns cols=3

- icon=anzhiyu-icon-shapes title=张三 url=https://example.com desc=前端工程师 color=blue
- icon=anzhiyu-icon-shapes title=李四 url=https://example.com desc=后端工程师 color=green
- icon=anzhiyu-icon-shapes title=王五 url=https://example.com desc=UI 设计师 color=pink

:::
```

**示例 2：项目展示**

展示多个项目，使用 4 列布局：

```markdown
:::btns cols=4

- icon=anzhiyu-icon-code title=项目 A url=# desc=Web 应用开发
- icon=anzhiyu-icon-mobile title=项目 B url=# desc=移动端应用
- icon=anzhiyu-icon-server title=项目 C url=# desc=后端服务
- icon=anzhiyu-icon-database title=项目 D url=# desc=数据库设计

:::
```

**示例 3：合作伙伴**

不使用描述，只显示图标和标题：

```markdown
:::btns cols=6

- icon=anzhiyu-icon-company-1 title=公司 A url=#
- icon=anzhiyu-icon-company-2 title=公司 B url=#
- icon=anzhiyu-icon-company-3 title=公司 C url=#
- icon=anzhiyu-icon-company-4 title=公司 D url=#
- icon=anzhiyu-icon-company-5 title=公司 E url=#
- icon=anzhiyu-icon-company-6 title=公司 F url=#

:::
```

**示例 4：使用图片作为图标**

icon 支持 https 图片链接，显示为圆形头像：

```markdown
:::btns cols=4

- icon=https://example.com/avatar1.jpg title=成员 A url=#
- icon=https://example.com/avatar2.jpg title=成员 B url=#
- icon=https://example.com/avatar3.jpg title=成员 C url=#
- icon=https://example.com/avatar4.jpg title=成员 D url=#

:::
```

== tab 最佳实践

**1. 列数选择**

- **2 列**: 适合内容较多的项目，需要更多空间展示描述
- **3 列**: 最常用的布局，适合团队成员、服务介绍等
- **4 列**: 适合友情链接、合作伙伴等
- **5-6 列**: 适合社交媒体图标、简单链接等

**2. 图标使用**

- 保持同一组按钮使用相同系列的图标
- 团队成员建议使用 `anzhiyu-icon-user-*` 系列
- 社交媒体使用对应的品牌图标
- 链接使用 `anzhiyu-icon-link` 或 `anzhiyu-icon-external-link`

**3. 颜色搭配**

- 团队成员可以使用不同颜色区分角色
- 同类型链接建议使用相同颜色
- 重要项目可以使用 `blue` 或 `purple` 突出显示

**4. 描述文字**

- 描述文字应该简短精炼（10-20 字为佳）
- 如果内容较长，考虑使用 2 列布局
- 纯图标导航可以省略描述

**5. 响应式注意事项**

- 移动端会自动调整为更少的列数
- 6 列布局在移动端可能显示为 2-3 列
- 建议测试移动端效果

:::

## tab 分栏

:::tabs

== tab 标签语法

```markdown
:::tabs
== tab 标签 1
内容 1
== tab 标签 2
内容 2
== tab 标签 3
内容 3
:::
```

**指定默认选中**

```markdown
:::tabs active=2
== tab 标签 1
内容 1
== tab 标签 2
内容 2（默认选中）
== tab 标签 3
内容 3
:::
```

== tab 配置参数

**基础语法**：

- 使用 `:::tabs` 开始标签容器
- 使用 `== tab 标题` 标记每个标签页
- 使用 `:::` 结束标签容器

**可选参数**：

- `active=数字`: 指定默认激活的标签（从 1 开始计数）
  - 不设置时默认激活第一个标签
  - 数字超出范围会降级为第一个标签
  - 示例：`:::tabs active=2` 表示默认激活第二个标签

**内容支持**：

- ✅ 完整的 Markdown 语法
- ✅ 代码块（支持语法高亮）
- ✅ 图片、链接
- ✅ 列表、表格
- ✅ 其他插件（按钮、隐藏内容、折叠框等）

**注意事项**：

- `:::tabs` 和 `:::` 必须独占一行
- `== tab` 必须在行首
- 标签标题不能为空

== tab 样式预览

**基础标签切换**

可以在不同标签页之间切换内容，第一个标签默认选中。

**带按钮的标签**

标签页内可以包含按钮：

{btn url=#demo text=在线演示 color=blue}{/btn}
{btn url=#docs text=查看文档 color=green}{/btn}

**带代码的标签**

标签页内可以包含代码块：

```javascript
console.log("Hello World");
```

**带隐藏内容的标签**

标签页内可以使用隐藏内容：

{hide display=查看答案}这是隐藏的内容{/hide}

**带文本样式的标签**

标签页内可以使用各种文本样式：

{u}下划线{/u}、{emp}着重号{/emp}、{wavy}波浪线{/wavy}、{del}删除线{/del}

== tab 最佳实践

**1. 标签标题命名**

- ✅ 简洁明了：HTML、CSS、JavaScript
- ✅ 长度建议：2-8 个字
- ✅ 避免特殊符号
- ❌ 不要过长：如何在 Windows 系统上完成安装

**2. 标签数量建议**

- ✅ 推荐 2-6 个标签
- ⚠️ 超过 6 个考虑拆分内容
- ❌ 避免只有 1 个标签

**3. 内容组织**

- 第一个标签放最常用内容
- 使用 `active` 参数突出重点
- 相关内容归为一组
- 保持各标签内容量均衡

**4. 默认激活策略**

- `active=1`：最常用、最基础的内容
- `active=2` 或更后：进阶内容、特殊场景
- 教程类：从第一个开始
- 对比类：激活最推荐的选项

**5. 嵌套建议**

- ✅ 可嵌套：折叠框、隐藏内容、按钮
- ✅ 可嵌套：文本样式插件
- ⚠️ 谨慎嵌套：Tabs 嵌套 Tabs（不超过 2 层）
- ❌ 避免过度嵌套导致结构混乱

**6. 响应式考虑**

- 标签按钮会自动换行适配移动端
- 移动端建议使用较短的标题
- 保持标题长度一致更美观

**7. 代码块处理**

- 代码块中的 `:::` 和 `== tab` 会被正确忽略
- 可以安全地在代码块内展示 Tabs 语法
- 代码块结束标记必须是纯 ` ``` `

:::

## 图片组

图片组插件可以创建美观的网格布局图片展示，非常适合展示作品集、相册、产品图等。

:::tabs active=3

== tab 标签语法

```markdown
:::gallery
![图片1](https://upload-bbs.miyoushe.com/upload/2025/10/20/125766904/d9bd6eaa4bd95b4a3822697d2a02b9fe_3838888873972014349.jpg "图片标题1")
![图片2](https://upload-bbs.miyoushe.com/upload/2025/10/20/125766904/70dd78e6ccdebf05ea6cca4926dab2f3_3988741683324456483.jpg "图片标题2")
![图片3](https://upload-bbs.miyoushe.com/upload/2025/10/20/125766904/c2c03f1e052d0cb67867a780d2d2a367_7241546671181857520.jpg "图片标题3")
:::
```

**带参数**：

```markdown
:::gallery cols=列数 gap=间距 ratio=宽高比
![图片1](https://upload-bbs.miyoushe.com/upload/2025/10/20/125766904/d9bd6eaa4bd95b4a3822697d2a02b9fe_3838888873972014349.jpg "标题1")
![图片2](https://upload-bbs.miyoushe.com/upload/2025/10/20/125766904/70dd78e6ccdebf05ea6cca4926dab2f3_3988741683324456483.jpg "标题2")
:::
```

== tab 配置参数

**容器参数**（在 `:::gallery` 后指定）：

- `cols`: 列数，默认为 3，范围 1-6
- `gap`: 图片间距，默认为 10px（支持 px、rem、em 单位）
- `ratio`: 图片宽高比（如 16:9、1:1），不设置则自适应图片原始尺寸

**图片格式支持**：

1. **Markdown 图片语法**（推荐）

   ```markdown
   ![替代文本](图片URL "图片标题")
   ```

2. **HTML img 标签**

   ```markdown
   <img src="图片URL" alt="替代文本" title="图片标题" />
   ```

3. **参数格式**
   ```markdown
   url=图片 URL alt=替代文本 title=图片标题 desc=图片描述
   ```

**常用宽高比**：

- `1:1` - 正方形
- `16:9` - 宽屏
- `4:3` - 传统屏幕
- `3:2` - 照片常用比例

== tab 样式预览

**基础三列图片组**

:::gallery
![示例图片1](https://picsum.photos/800/600?random=1 "随机图片 1")
![示例图片2](https://picsum.photos/800/600?random=2 "随机图片 2")
![示例图片3](https://picsum.photos/800/600?random=3 "随机图片 3")
:::

**四列照片墙**

:::gallery cols=4 gap=8px
![照片1](https://picsum.photos/600/400?random=4)
![照片2](https://picsum.photos/600/400?random=5)
![照片3](https://picsum.photos/600/400?random=6)
![照片4](https://picsum.photos/600/400?random=7)
![照片5](https://picsum.photos/600/400?random=8)
![照片6](https://picsum.photos/600/400?random=9)
![照片7](https://picsum.photos/600/400?random=10)
![照片8](https://picsum.photos/600/400?random=11)
:::

**正方形图片组（1:1）**

:::gallery cols=3 ratio=1:1
![方形图1](https://picsum.photos/800/800?random=12 "正方形图片 1")
![方形图2](https://picsum.photos/800/800?random=13 "正方形图片 2")
![方形图3](https://picsum.photos/800/800?random=14 "正方形图片 3")
![方形图4](https://picsum.photos/800/800?random=15 "正方形图片 4")
![方形图5](https://picsum.photos/800/800?random=16 "正方形图片 5")
![方形图6](https://picsum.photos/800/800?random=17 "正方形图片 6")
:::

**宽屏比例（16:9）**

:::gallery cols=2 ratio=16:9 gap=20px
![宽屏图1](https://picsum.photos/1920/1080?random=18 "宽屏图片 1")
![宽屏图2](https://picsum.photos/1920/1080?random=19 "宽屏图片 2")
![宽屏图3](https://picsum.photos/1920/1080?random=20 "宽屏图片 3")
![宽屏图4](https://picsum.photos/1920/1080?random=21 "宽屏图片 4")
:::

**单列大图展示**

:::gallery cols=1
![大图1](https://picsum.photos/1600/900?random=22 "单列大图 1")
![大图2](https://picsum.photos/1600/900?random=23 "单列大图 2")
:::

== tab 使用示例

**示例 1：作品集展示**

```markdown
:::gallery cols=3 ratio=1:1
![作品1](https://example.com/work1.jpg "设计作品A")
![作品2](https://example.com/work2.jpg "设计作品B")
![作品3](https://example.com/work3.jpg "设计作品C")
![作品4](https://example.com/work4.jpg "设计作品D")
![作品5](https://example.com/work5.jpg "设计作品E")
![作品6](https://example.com/work6.jpg "设计作品F")
:::
```

**示例 2：视频封面展示**

```markdown
:::gallery cols=2 ratio=16:9 gap=20px
![视频1](url1 "教程视频第一集")
![视频2](url2 "教程视频第二集")
![视频3](url3 "教程视频第三集")
![视频4](url4 "教程视频第四集")
:::
```

**示例 3：产品展示**

```markdown
:::gallery cols=4
![产品1](url1 "产品名称A")
![产品2](url2 "产品名称B")
![产品3](url3 "产品名称C")
![产品4](url4 "产品名称D")
:::
```

**示例 4：活动海报**

```markdown
:::gallery cols=1
![海报1](url1 "活动海报")
![海报2](url2 "宣传图片")
:::
```

== tab 最佳实践

**1. 列数选择**

- **1 列**: 适合横幅图、大图展示
- **2 列**: 适合宽屏图片、视频封面
- **3 列**: 最常用的布局，适合作品集、相册
- **4 列**: 适合产品展示、照片墙
- **5-6 列**: 适合小图标、图标集合

**2. 宽高比使用**

- **不设置**: 图片保持原始比例，适合尺寸不一的图片
- **1:1**: 正方形，适合头像、LOGO、产品图
- **16:9**: 宽屏，适合视频封面、横幅
- **4:3**: 传统照片比例
- **3:2**: 相机照片常用比例

**3. 间距设置**

- **8-10px**: 紧凑布局，适合照片墙
- **15-20px**: 标准布局，最常用
- **25-30px**: 宽松布局，突出单张图片

**4. 响应式设计**

图片组会根据屏幕尺寸自动调整：

- **桌面端（>768px）**: 保持设定的列数
- **平板端（≤768px）**: 4-6 列自动调整为 3 列
- **手机端（≤500px）**: 3-6 列自动调整为 2 列，2 列自动调整为 1 列

**5. 交互特性**

- ✅ 悬停效果：图片轻微上浮并放大
- ✅ 显示标题：鼠标悬停显示图片标题
- ✅ 点击放大：集成 Fancybox，支持全屏查看
- ✅ 懒加载：自动启用图片懒加载优化性能

**6. 性能优化**

- 单个图片组建议不超过 20 张
- 使用适当的图片尺寸（不要过大）
- 移动端建议使用较少的列数（2-3 列）
- 图片会自动懒加载，提升首屏性能

**7. 注意事项**

- 确保图片 URL 有效且可访问
- 使用相同尺寸的图片效果更佳
- 建议添加有意义的图片标题
- 测试移动端显示效果

:::

## LinkCard

LinkCard 插件可以创建美观的链接卡片，用于展示外部链接信息。

### LinkCard 基础用法

{linkcard url=https://blog.anheyu.com title=安知鱼 sitename=AnZhiYu}{/linkcard}

```markdown
{linkcard url=https://blog.anheyu.com title=安知鱼 sitename=AnZhiYu}{/linkcard}
```

### 自定义图标

#### 字体图标

{linkcard url=https://github.com title=GitHub sitename=代码托管平台 icon=anzhiyu-icon-github}{/linkcard}

```markdown
{linkcard url=https://github.com title=GitHub sitename=代码托管平台 icon=anzhiyu-icon-github}{/linkcard}
```

#### HTTP 图标链接

{linkcard url=https://www.google.com title=Google sitename=搜索引擎 icon=https://www.google.com/favicon.ico}{/linkcard}

{linkcard url=https://github.com title=GitHub sitename=代码托管平台 icon=https://github.githubassets.com/favicons/favicon.png}{/linkcard}

```markdown
{linkcard url=https://www.google.com title=Google sitename=搜索引擎 icon=https://www.google.com/favicon.ico}{/linkcard}

{linkcard url=https://github.com title=GitHub sitename=代码托管平台 icon=https://github.githubassets.com/favicons/favicon.png}{/linkcard}
```

### 自定义提示文本

{linkcard url=https://www.google.com title=Google sitename=搜索引擎 tips=访问搜索引擎}{/linkcard}

```markdown
{linkcard url=https://www.google.com title=Google sitename=搜索引擎 tips=访问搜索引擎}{/linkcard}
```

### 完整示例

{linkcard url=https://docs.anheyu.com title=AnZhiYu 文档 sitename=AnZhiYu Docs icon=anzhiyu-icon-book tips=查看完整文档}{/linkcard}

```markdown
{linkcard url=https://docs.anheyu.com title=AnZhiYu 文档 sitename=AnZhiYu Docs icon=anzhiyu-icon-book tips=查看完整文档}{/linkcard}
```

### 多个链接卡片

{linkcard url=https://blog.anheyu.com title=安知鱼博客 sitename=AnZhiYu Blog}{/linkcard}

{linkcard url=https://github.com/anzhiyu-c title=AnZhiYu GitHub sitename=GitHub Repository icon=https://github.githubassets.com/favicons/favicon.png}{/linkcard}

{linkcard url=https://www.bilibili.com title=哔哩哔哩 sitename=B 站 icon=https://www.bilibili.com/favicon.ico tips=观看视频}{/linkcard}

```markdown
{linkcard url=https://blog.anheyu.com title=安知鱼博客 sitename=AnZhiYu Blog}{/linkcard}

{linkcard url=https://github.com/anzhiyu-c title=AnZhiYu GitHub sitename=GitHub Repository icon=https://github.githubassets.com/favicons/favicon.png}{/linkcard}

{linkcard url=https://www.bilibili.com title=哔哩哔哩 sitename=B 站 icon=https://www.bilibili.com/favicon.ico tips=观看视频}{/linkcard}
```

### 参数说明

| 参数     | 说明                           | 类型   | 可选值                       | 默认值            |
| -------- | ------------------------------ | ------ | ---------------------------- | ----------------- |
| url      | 链接地址                       | string | -                            | #                 |
| title    | 链接标题                       | string | -                            | 链接标题          |
| sitename | 网站名称                       | string | -                            | 网站名称          |
| icon     | 图标（字体图标类名或图片链接） | string | 字体图标类名或 HTTP 图片链接 | anzhiyu-icon-link |
| tips     | 提示文本                       | string | -                            | 引用站外地址      |

### 注意事项

- 链接会在新标签页中打开
- 自动添加 `rel="external nofollow noreferrer"` 属性
- 图标支持两种方式：
  - **字体图标**：使用 AnZhiYu 图标字体类名（如 `anzhiyu-icon-github`）
  - **图片图标**：使用 HTTP/HTTPS 图片链接（如网站 favicon）
- 图片图标会自动调整为 20x20 像素，带圆角效果
- 卡片具有悬停效果和点击反馈
- 适合用于推荐相关链接或引用外部资源

## 🎬 视频画廊

视频画廊插件可以创建美观的视频展示区域，非常适合展示教程视频、作品集、产品演示等。

### 基础用法

:::video-gallery
url=https://npm.elemecdn.com/anzhiyu-blog@1.1.6/img/post/wuhan/1.mp4 title=武汉风光 1
url=https://npm.elemecdn.com/anzhiyu-blog@1.1.6/img/post/wuhan/2.mp4 title=武汉风光 2
:::

```markdown
:::video-gallery
url=视频地址 1 title=视频标题 1
url=视频地址 2 title=视频标题 2
:::
```

### 自定义列数和比例

:::video-gallery cols=1 ratio=16:9
url=https://npm.elemecdn.com/anzhiyu-blog@1.1.6/img/post/wuhan/1.mp4 title=单列展示 desc=武汉城市风光
:::

```markdown
:::video-gallery cols=1 ratio=16:9
url=视频地址 title=视频标题 desc=视频描述
:::
```

### 参数说明

- `cols`: 列数，默认为 2，范围 1-4
- `gap`: 视频间距，默认为 16px
- `ratio`: 视频宽高比，默认为 16:9（也可设置 4:3、1:1 等）
- `url`: 视频地址（必填）
- `poster`: 视频封面图（可选）
- `title`: 视频标题（可选）
- `desc`: 视频描述（可选）

### 特性

- ✅ 响应式设计，自动适配移动端
- ✅ 悬停效果，显示播放按钮
- ✅ 原生视频控制器，支持全屏播放
- ✅ 支持多种视频格式（MP4、WebM、OGG 等）

## 🎵 音乐播放器

音乐播放器插件可以在文章中嵌入美观的网易云音乐播放器，支持播放、暂停、进度控制等功能。

### 基础用法

{music id=554241732}{/music}

```markdown
{music id=554241732}{/music}
```

只需提供网易云音乐的歌曲 ID，系统会自动获取歌曲信息、封面、音频 URL，并提取封面主色用于进度条。

### 多首歌曲

{music id=1974443814}{/music}

{music id=1868553}{/music}

```markdown
{music id=1974443814}{/music}

{music id=1868553}{/music}
```

### 功能特性

- ✅ 自动获取歌曲信息（名称、歌手、封面）
- ✅ 自动提取封面主色，进度条颜色自适应
- ✅ 支持播放、暂停、进度控制
- ✅ 显示播放时间和总时长
- ✅ 旋转封面动画
- ✅ 响应式设计，完美适配移动端

### 如何获取歌曲 ID

1. 打开网易云音乐网页版或客户端
2. 找到你喜欢的歌曲
3. 复制歌曲链接，ID 就是链接中的数字

例如：`https://music.163.com/#/song?id=554241732`，ID 就是 `554241732`

![文章内音乐组件](https://upload-bbs.miyoushe.com/upload/2025/11/05/125766904/9d759897f65eb5e7d59d54e54806e671_970332254315767898.png)

## ☘️ 占个坑@！

没了
