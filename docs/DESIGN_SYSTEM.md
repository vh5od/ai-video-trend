# AI Video Trend Radar 设计系统

> 版本：1.0
> 状态：当前产品视觉规范的唯一事实来源（source of truth）
> 适用范围：Dashboard、Trend、Trend Detail、Collection、Platforms、Settings，以及未来新增页面

## 1. 产品定位与视觉原则

AI Video Trend Radar 是持续扫描短视频热点、整理趋势证据并辅助判断的工作台。视觉语言应像一台长期运行的私人雷达，而不是通用 SaaS 后台。

核心关键词：

- editorial：编辑式信息排版，标题、横线、留白负责组织内容。
- radar：状态持续更新，但动效克制，不制造仪表盘噪音。
- ASCII：等宽字体、方括号、箭头、硬闪烁和文本扰动构成技术气质。
- evidence-first：视频证据和数据优先，装饰退后。
- monochrome：暖白与黑色为主，颜色只表达状态或交互。

任何新设计都应先通过以下判断：

1. 这个边框是否真的表达分组？
2. 这个颜色是否真的表达状态？
3. 这个动效是否帮助理解交互或监视状态？
4. 删除这个装饰后，信息是否仍然清楚？如果是，应删除。

## 2. 设计令牌

设计令牌定义在 `app/globals.css` 的 `:root` 中。新增功能必须复用令牌，不应在组件中随意写相近颜色。

| 角色 | 令牌 | 当前值 | 用途 |
| --- | --- | --- | --- |
| 页面画布 | `--canvas` | `#f1f0ee` | 全局暖白背景 |
| 主表面 | `--surface` | `#f8f7f4` | 输入区、必要的轻表面 |
| 次表面 | `--surface-soft` | `#e5e3df` | 媒体占位、弱分区 |
| 主文字 | `--ink` | `#050505` | 标题、正文、主边线 |
| 次文字 | `--muted` | `#5f5d58` | 描述、时间、说明 |
| 普通边线 | `--line` | `#d2d0cb` | 表格行、输入框、次级分隔 |
| 强边线 | `--line-strong` | `#9c9992` | hover 或重要分隔 |
| 主信号 | `--signal` | `#000000` | 选中、聚焦、主要操作 |

规则：

- 页面主要由 `--canvas`、`--ink`、`--muted`、`--line` 构成。
- 禁止用渐变、投影、玻璃效果制造层级。
- 禁止新增“品牌蓝”“成功绿”等大面积背景色。
- 蓝色 `#0000ee` 只用于文本选择式选中状态和 CTA hover。

## 3. 字体系统

### 3.1 展示标题

页面主标题使用：

```css
font-family: "Arial Narrow", "Aptos Narrow", Impact, sans-serif;
font-size: clamp(34px, 4vw, 52px);
font-weight: 900;
line-height: 0.82;
letter-spacing: -0.065em;
text-transform: uppercase;
```

使用位置：Dashboard、Trend、Trend Detail、Collection、Platforms、Settings 的页面主标题。

不要将展示标题字体用于正文、按钮或表格。

### 3.2 技术与数据字体

使用 `PP Neue Montreal Mono`：

- Book：400
- Medium：500–600
- Bold：700

字体文件位于 `public/fonts/`，通过 `app/globals.css` 的 `@font-face` 加载。

使用位置：

- 导航、ASCII 标识和元数据
- 表头、数据、状态、标签
- CTA 和技术说明
- Settings 的分区标题与字段标签

注意：当前字体文件为个人使用版本。商业部署前必须确认商业授权。

### 3.3 正文

正文使用：

```css
"Segoe UI Variable", "MiSans", "Noto Sans SC", system-ui, sans-serif
```

正文保持正常大小写，不要强制 uppercase。

### 3.4 字体层级

| 层级 | 字号/字重 | 字体 | 示例 |
| --- | --- | --- | --- |
| 页面主标题 | 34–52px / 900 | Narrow display | `SETTINGS` |
| 卡片趋势标题 | 28px / 500 | 正文字体 | `Higgsfield AI` |
| 分区标题 | 14px / 600 | PP Neue Montreal Mono | `DAILY CRAWL SOURCES` |
| 正文 | 13–14px / 400–500 | 系统无衬线 | 描述与摘要 |
| 字段标签/表头 | 10px / 500–600 | PP Neue Montreal Mono | `PLATFORM` |
| 元数据 | 10–11px / 500 | PP Neue Montreal Mono | 时间、来源数、状态 |

分区标题和字段标签不得只相差 1px。必须保持 14px 与 10px 的明确层级。

## 4. 布局与边界

### 4.1 编辑式分区

次级页面使用 `.editorial-subpage`：

- 页面之间靠横线和留白分区。
- 直接子 `section` 和功能 `form` 不使用卡片背景、圆角或阴影。
- 分区顶线使用 1px `--ink`。
- 分区内部细线使用 1px `--line`。

### 4.2 数据表面

所有表格容器必须使用 `.data-surface`。

```tsx
<div className="data-surface overflow-hidden border border-line bg-white">
  <table>...</table>
</div>
```

规则：

- 数据表面统一 `border-radius: 0`。
- 数据表面统一 `box-shadow: none`。
- 同一页面不得出现一张直角表和一张圆角表。
- 表格 hover 可以改变背景和增加左侧内描边，但不得改变行宽、列宽或页面滚动宽度。

### 4.3 圆角使用

圆角是一种稀缺资源：

- 趋势编辑卡片：8px。
- 趋势卡片内部媒体窗口：8px。
- 视频缩略图：可使用 6–8px。
- 普通数据表、表单分区、设置分区：0px。
- 标签：2px。

不得在同一种组件上混用 0px、6px 和 8px。

### 4.4 阴影

全站默认 `box-shadow: none`。新增页面禁止用阴影表达层级。

## 5. 核心组件

### 5.1 页面头部

标准结构：

```tsx
<header>
  <p>EYEBROW</p>
  <h2>PAGE TITLE</h2>
  <p>Optional description.</p>
</header>
```

- eyebrow：10px、Mono、uppercase。
- 主标题：展示标题样式。
- 描述：14px、muted、限制最大宽度。
- 页面状态或操作位于右上角，不应与主标题争夺视觉权重。

### 5.2 `Badge`

`Badge` 当前输出 `.ui-tag`：透明背景、1px 边线、2px 圆角、10px Mono。

使用场景：平台、关键词、原因标签。

禁止：

- 为平台标签增加粉色、青色等大面积浅色底。
- 用 Badge 表达实时热度状态。

### 5.3 `MonitorStatus`

趋势热度必须使用 `MonitorStatus`，不要使用 Badge。

| 状态 | 圆点颜色 | 语义 |
| --- | --- | --- |
| `hot` | 红 `#ff3b30` | 高热、立即关注 |
| `emerging` | 橙 `#ff9500` | 正在上升 |
| `stable` | 绿 `#34a853` | 稳定持续 |
| `cooling` | 蓝灰 `#6f87a6` | 热度回落 |

动画规则：

- 使用 `monitor-blink` 的阶梯式硬闪烁。
- 不使用扩散光圈、雷达波纹或平滑呼吸动画。
- 必须支持 `prefers-reduced-motion`。

### 5.4 `SourceActionLink`

所有 `OPEN SOURCE` / `OPEN TREND` 必须复用此组件。

视觉规则：

- PP Neue Montreal Mono
- 保持所在区域原有字号
- 700 字重
- 1.5px 下划线，2px offset
- 尾部 `▶`
- hover/focus 变为 `#0000ee`
- hover/focus 触发短暂文本扰动

禁止新增蓝色普通文本版 `Open source` 或深色矩形按钮版 `Open source`。

### 5.5 趋势卡片

- 每个趋势一张等尺寸卡片，不跨列。
- 大屏 3 列，中屏 2 列，小屏 1 列。
- 媒体区使用同一趋势下最多 3 个 9:16 视频缩略图拼成横向证据墙。
- 不允许用单张竖屏视频强制裁切成横图。
- 状态使用 `MonitorStatus`。
- 底部操作使用 `SourceActionLink`。

### 5.6 表格行 hover

`.motion-row` 可以：

- 改变背景色。
- 使用左侧 inset 线。
- 显示绝对定位的 `>`。

不得：

- 在 hover 时改变伪元素宽度。
- 添加会参与表格布局的内容。
- 改变行高、列宽或页面滚动宽度。

## 6. 表单与设置页

- Settings 使用连续表单，不使用三张或更多独立大卡片。
- 分区使用顶线与 20px 左右的垂直内边距。
- 输入框、下拉框、文本框在次级页面使用 0px 圆角、透明背景、1px 边线。
- 原生 `<option>` 只能包含纯文本，禁止放入 `<span>` 或动画组件。
- 主要操作使用黑底白字；同一区域最多一个主操作。
- 危险操作可以使用红色文字或边线，但避免大面积红色背景。

## 7. 动效规范

动效应短、少、可解释。

允许：

- 页面注册进入：约 420–480ms。
- 卡片 hover 上移：最多 3px。
- 图片 hover 缩放：约 1.035–1.055。
- CTA 文本扰动：约 8 帧，每帧 34ms。
- 状态点硬闪烁：约 1.1s 循环。
- 导航文字平移：2–3px。

禁止：

- 大面积漂浮粒子。
- 状态扩散波纹。
- 无意义的持续旋转（品牌雷达标识除外）。
- hover 引发布局重排。
- 同一区域叠加三种以上动效。

所有动效必须在 `prefers-reduced-motion: reduce` 下关闭或降级。

## 8. 页面模板

### Dashboard

- 头部、指标、筛选和时间说明组成一块连续 editorial field。
- 指标使用上下强横线和列分隔，不使用独立指标卡。
- 数据表全部为直角 `.data-surface`。

### Trend List

- 使用等尺寸趋势卡片网格。
- 每张卡片包含标题、状态、证据拼图、摘要、标签和操作。

### Trend Detail

- 代表视频和文字为一条横向证据带。
- Heat / Engagement / Freshness / Sources 使用连续指标条。
- Platform summary 使用连续列，不使用三张嵌套卡片。
- Why it ranks、Follow-up notes、Source evidence 使用横线分区。

### Collection

- 作为工作台处理，允许密集表单和表格，但不使用外层大卡片包裹每个功能。
- 统计数量使用列分隔，不使用四张小卡片。
- 操作按钮应保持 Mono、uppercase 和明确主次关系。

### Settings

- 页面标题 34–52px。
- 分区标题 14px/600。
- 字段标签 10px/500。
- 外层 form 不画边线；每个内部 section 只画一条顶线。
- 禁止 form 与第一个 section 同时设置顶线，避免双线。

### Platforms

- 使用一张直角数据表。
- 状态和平台用 `.ui-tag`。
- 不需要额外卡片或彩色状态背景。

## 9. 功能开发流程

每次新增或修改功能时按以下顺序执行：

1. 确认新功能属于哪个现有页面模板。
2. 优先复用 `Badge`、`MonitorStatus`、`SourceActionLink`、`.data-surface`、`.editorial-subpage`。
3. 只使用现有颜色令牌和字体角色。
4. 检查是否新增了不必要的卡片、圆角、阴影或彩色背景。
5. 检查 hover 前后几何尺寸是否一致。
6. 检查原生表单 HTML 是否有效。
7. 检查键盘 focus 和 reduced motion。
8. 在浏览器逐页复核受影响页面。
9. 运行 `npm.cmd test`。

## 10. UI 验收清单

提交前必须回答：

- [ ] 页面主标题是否使用展示标题字体？
- [ ] 技术标签、状态和表头是否使用 PP Neue Montreal Mono？
- [ ] 正文是否保持系统无衬线字体？
- [ ] 是否复用了现有颜色令牌？
- [ ] 是否出现不必要的蓝、绿、红浅色背景？
- [ ] 同类数据表是否全部为 0px 圆角？
- [ ] 是否新增了阴影？如有，为什么不能用横线和留白？
- [ ] `Open source` / `Open trend` 是否使用 `SourceActionLink`？
- [ ] 趋势状态是否使用 `MonitorStatus`？
- [ ] hover 是否会改变页面宽度、表格列宽或行高？
- [ ] 状态动画是否是硬闪烁，而不是扩散雷达？
- [ ] 原生 `<option>` 是否只含纯文本？
- [ ] 是否支持 `prefers-reduced-motion`？
- [ ] 是否检查了 1440px、约 900px 和移动端布局？
- [ ] 是否运行全部测试？

## 11. 本轮视觉改造记录

本轮改造依次完成：

1. 建立暖白、黑色、灰色为主的 editorial radar 方向。
2. 重做侧边导航为 ASCII 标识、方括号状态与黑底选中项。
3. 将 Dashboard 头部从多卡片改为连续信息区。
4. 将 Dashboard 指标改为横线和列分隔结构。
5. 将时间筛选改为文本选择式交互并保留短扰动动画。
6. 将 Source leaderboard 字体角色拆分为 Mono chrome 与无衬线正文。
7. 统一 `OPEN SOURCE` / `OPEN TREND` 的粗体下划线、箭头、扰动和蓝色 hover。
8. 将 Trend 列表改为 Duties 风格等尺寸编辑卡片。
9. 将竖屏视频改为 9:16 多视频证据拼图。
10. 建立 `MonitorStatus` 的热度颜色与 ASCII 硬闪烁。
11. 将 PP Neue Montreal Mono Book / Medium / Bold 本地接入项目。
12. 修复表格行 hover 的布局抖动，将 `>` 改为绝对定位。
13. 对 Trend Detail、Collection、Settings、Platforms 做对抗式一致性审查。
14. 移除次级页面多余的卡片、阴影、彩色 Badge 和旧式蓝色链接。
15. 统一所有数据表为直角 `.data-surface`。
16. 修复 Settings 双结构线和标题层级问题。
17. 修复 `<option>` 内嵌动画节点导致的 hydration error。

## 12. 禁止事项速查

不要：

- 为每个小模块增加白色卡片。
- 为同类表格设置不同圆角。
- 使用阴影制造层级。
- 用彩色浅底 Badge 表达平台或关键词。
- 手写新的 `Open source` 样式。
- 用雷达扩散波纹表达状态。
- 在 `<option>` 中渲染组件。
- 让 hover 内容参与布局。
- 在没有新语义的情况下新增设计令牌。

优先：

- 横线。
- 留白。
- 明确的字体层级。
- Mono 技术标签。
- 视频证据。
- 单一重点交互。
