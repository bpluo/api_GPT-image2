## <img src="./public/favicon.svg" alt="项目 Logo" width="30" height="30" style="vertical-align: middle; margin-right: 8px;"> GPT 图像工坊

面向学术科研论文绘图的 OpenAI 图像 API 工作台。项目围绕“论文图生成 → 局部修订 → 历史回看 → 继续编辑”流程优化，适合制作方法架构图、实验结果图、技术示意图、图形摘要和论文配图草稿。

<p align="center">
  <img src="./readme-images/interface.jpg" alt="界面截图" width="820"/>
</p>

**当前定位：** 论文绘图助手 + 图像生成/编辑调试台。核心 API、存储与历史链路保持简单透明，方便本地研究、Serverless 部署和后续二次开发。

## 核心功能

- **生成与编辑双模式**：支持 `generate` / `edit`，可从生成结果直接发送到编辑表单继续修订。
- **科研论文绘图模板**：内置 `AcademicPromptPicker`，覆盖方法架构图、实验结果图、技术示意图、图形摘要、定性对比网格和科研图修订。
- **覆盖 / 追加两种模板操作**：可用模板覆盖当前提示词，也可在论文摘要、方法描述或实验数据说明后追加绘图规范。
- **学术风格约束**：默认强调白底、低饱和配色、扁平矢量、英文短标签、可打印布局，并避免虚构数据、轴、图例、方法名或数据集名。
- **流式生成预览**：生成模式下，`gpt-image-2` 且 `n=1` 时可启用 SSE 流式部分预览。
- **Mask 编辑器**：编辑模式支持上传/粘贴图片、绘制 Mask、上传 Mask，适合局部重绘、统一风格、清理背景和修正标签。
- **历史记录链路**：记录 prompt、参数、模型、成本估算、存储模式、父子编辑关系和科研模板标签。
- **稳定图片显示**：本地 API 图片、IndexedDB Blob、Data URL 预览统一按场景解析，结果图、历史缩略图和编辑来源图保持可回显。
- **两种存储模式**：服务器文件系统 `fs`（默认）或浏览器 IndexedDB（Dexie.js，适合 Serverless）。

## 推荐使用流程

### 1. 生成论文图

1. 进入“生成图片”。
2. 选择科研模板：
   - **方法架构图 / Method Pipeline**：模型结构、pipeline、数据流、核心创新。
   - **实验结果图 / Publication Chart**：柱状图、折线图、热力图、误差线和置信区间；只使用用户提供数据。
   - **技术示意图 / System Diagram**：系统架构、流程图、时序图、状态机、网络拓扑。
3. 点击“覆盖提示词”从模板开始，或点击“追加规范”把论文绘图规范附加到已有描述后。
4. 输入论文方法、实验数据含义、系统模块与数据流。
5. 选择尺寸、质量、输出格式，提交生成。

### 2. 修订已有图

1. 切换到“编辑图片”，或从输出/历史记录点击发送到编辑。
2. 上传、粘贴或使用历史图片作为源图。
3. 可选绘制 Mask，限定局部重绘区域。
4. 选择“科研图修订 / Figure Refinement”等编辑模板。
5. 提交后会生成新的历史记录，并保留与来源记录的父子关系。

### 3. 回看历史与继续编辑

- 历史面板展示每次请求的缩略图、模型、耗时、成本估算和科研模板标签。
- 新记录使用稳定 `id` 管理，删除历史不会再依赖 timestamp 匹配。
- 删除记录会同步清理对应图片；IndexedDB 模式会清理本地 Blob 和缓存 URL。
- 点击历史记录可回显图片；点击“发送到编辑”可沿用历史图片继续修订。

## 技术栈

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS / shadcn/ui / Radix UI / lucide-react
- OpenAI 官方 SDK
- Dexie.js（IndexedDB 存储）
- Server-Sent Events（流式生成预览）

## API 路由

- `POST /api/images`：图像生成与编辑。支持普通 JSON 响应和生成模式 SSE 流式响应。
- `GET /api/image/[filename]`：读取服务器文件系统中的图片。
- `POST /api/image-delete`：删除指定图片文件，支持可选密码验证。
- `GET /api/auth-status`：查询后端是否启用 `APP_PASSWORD`。

## 存储模式

### `fs`：服务器文件系统

默认模式。生成图片写入项目根目录的 `generated-images/`，并通过 `/api/image/[filename]` 读取。

适合：

- 本地开发
- 长驻服务器
- 需要直接查看生成文件的场景

### `indexeddb`：浏览器 IndexedDB

服务端返回 `b64_json`，客户端解码为 Blob 并写入 Dexie。历史记录仍保存在 `localStorage.openaiImageHistory`。

适合：

- Vercel 等 Serverless 平台
- 文件系统不可持久化的部署环境
- 希望图片保存在浏览器本地的场景

## 环境变量

创建 `.env.local`：

```dotenv
OPENAI_API_KEY=在此填入你的_openai_api_key

# 可选：兼容 OpenAI Images API 的自定义 Endpoint
# OPENAI_API_BASE_URL=

# 可选：fs 或 indexeddb；Vercel 环境建议 indexeddb
# NEXT_PUBLIC_IMAGE_STORAGE_MODE=indexeddb

# 可选：启用后敏感 API 需要客户端提交 SHA-256 密码哈希
# APP_PASSWORD=你的管理密码
```

## 本地开发

先决条件：Node.js >= 20。

```bash
git clone <repo-url>
cd gpt-image-playground
npm install
npm run dev
```

打开： http://localhost:3000

## 常用脚本

```bash
npm run dev      # 启动开发服务器
npm run build    # 生产构建
npm run start    # 启动生产服务
npm run lint     # ESLint 检查
npm run format   # Prettier 格式化 src
```

## 部署注意

- Serverless 平台建议设置 `NEXT_PUBLIC_IMAGE_STORAGE_MODE=indexeddb`。
- `fs` 模式需要服务器进程拥有 `generated-images/` 读写权限。
- 如果设置 `APP_PASSWORD`，前端会本地计算 SHA-256 后提交，不会直接发送明文密码。
- Next.js 如提示 workspace root 推断到上级目录，检查是否存在多份 lockfile，或在 `next.config` 中显式配置 Turbopack root。

## 图片显示与历史记录说明

- 生成结果、历史缩略图、编辑源图都通过统一解析函数获得可显示地址。
- `fs` 模式使用 `/api/image/[filename]`。
- `indexeddb` 模式使用 `URL.createObjectURL(blob)`，并缓存/释放 Blob URL。
- 历史记录包含 `id`、`sessionId`、`parentId`、`sourceImageFilenames`、`coverImageFilename`，用于串联生成-编辑链路。
- 科研模板元数据只在当前 prompt 仍包含模板文本时写入，避免手动改写后历史标签误报。

## FAQ

**Q: 为什么编辑模式没有流式预览？**  
A: 当前流式参数只对生成模式的 `gpt-image-2` 生效。编辑模式隐藏流式 UI，避免产生“已开启但无效果”的误导。

**Q: 实验结果图会不会编造数据？**  
A: 模板明确要求只使用用户提供的 numbers、labels、methods、datasets 和 metrics。缺数据时应生成占位图表结构，而不是伪造数值。

**Q: 图片看不见怎么办？**  
A: `fs` 模式检查 `generated-images/` 是否存在且可读写；`indexeddb` 模式检查浏览器存储权限。历史记录中图片若已被手动删除，则缩略图无法回显。

**Q: 支持哪些模型？**  
A: UI 支持 `gpt-image-2`、`gpt-image-1.5`、`gpt-image-1`、`gpt-image-1-mini`。不同模型在尺寸、质量、成本和编辑行为上可能不同。

## 开发目录

- [src/app](src/app)：App Router 页面和 API 路由。
- [src/components](src/components)：表单、历史面板、输出面板、科研模板选择器和 UI 组件。
- [src/lib](src/lib)：成本估算、尺寸校验、IndexedDB、科研提示词库和通用工具。

## 许可证与反馈

如需帮助或报告问题，请在仓库提交 Issue。
