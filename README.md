# <img src="./public/favicon.svg" alt="项目 Logo" width="30" height="30" style="vertical-align: middle; margin-right: 8px;"> GPT 图像游乐场

一个基于 Web 的游乐场，用于与 OpenAI 的 GPT 图像模型（`gpt-image-2`、`gpt-image-1.5`、`gpt-image-1` 和 `gpt-image-1-mini`）进行交互，实现图像生成与编辑功能。

> **Note：** 本游乐场默认使用 `gpt-image-2`，这是 OpenAI 最新的 GPT 图像模型。除了传统的固定尺寸外，它还支持高达 4K 的任意分辨率（附带有约束验证）。

<p align="center">
  <img src="./readme-images/interface.jpg" alt="界面截图" width="600"/>
</p>

## ✨ 功能特性

* **🎨 图像生成模式：** 根据文本 Prompt 创建新图像。
* **🖌️ 图像编辑模式：** 基于文本 Prompt 和可选的 Mask 修改现有图像。
* **⚙️ 完整的 API 参数控制：** 通过界面直接访问和调整 OpenAI Images API 支持的所有相关参数（Size、Quality、输出格式、压缩、背景、审核、生成数量）。
* **📐 自定义分辨率（gpt-image-2）：** 从 2K/4K 预设中选择，或输入任意的 Width × Height，系统会根据模型的约束条件进行实时验证（边长需为 16 的倍数，单边最大 3840 像素，宽高比 ≤ 3:1，总像素在 655,360 至 8,294,400 之间）。
* **🎭 内置 Mask 工具：** 在编辑模式下轻松创建或上传 Mask，以指定需要修改的区域。您可以直接在图像上绘制来生成 Mask。

  > ⚠️ 请注意，目前 `gpt-image-1` 的 Mask 功能并不能保证 100% 的控制效果。  
  > 1) [这是已知且被确认的模型限制。](https://community.openai.com/t/gpt-image-1-problems-with-mask-edits/1240639/37)  
  > 2) [OpenAI 计划在未来的更新中解决此问题。](https://community.openai.com/t/gpt-image-1-problems-with-mask-edits/1240639/41)

<p align="center">
  <img src="./readme-images/mask-creation.jpg" alt="Mask 创建截图" width="350"/>
</p>

* **📜 详细的历史记录与成本追踪：**
  * 查看您所有的图像生成和编辑的完整历史记录。
  * 查看每次请求所使用的参数。
  * 获取详细的 API Token 用量和每次操作的预估成本明细（`USD`）。（提示：点击图像上的 `$` 金额即可查看）
  * 查看每个历史项所使用的完整 Prompt。
  * 查看历史总 API 成本。
  * 从历史记录中删除项目。

<p align="center">
  <img src="./readme-images/history.jpg" alt="历史记录截图" width="1306"/>
</p>

<p align="center">
  <img src="./readme-images/cost-breakdown.jpg" alt="成本明细截图" width="350"/>
</p>

* **🖼️ 灵活的图像输出视图：** 以网格形式查看生成的图像批次，或选择单张图像进行近距离查看。
* **🚀 发送到编辑：** 快速将任何生成的图像或历史图像直接发送到编辑表单。
* **📋 粘贴到编辑：** 直接从剪贴板粘贴图像到编辑模式的源图像区域。
* **💾 存储：** 通过 `NEXT_PUBLIC_IMAGE_STORAGE_MODE` 支持两种存储模式：
  * **Filesystem（默认）：** 图像保存到服务器的 `./generated-images` 目录。
  * **IndexedDB：** 图像直接保存在浏览器的 IndexedDB 中（非常适合 Serverless 部署）。
  * 生成历史记录的元数据始终保存在浏览器的 Local Storage 中。

## 🚀 快速开始（本地部署）

按照以下步骤在本地运行游乐场。

### 前提条件

* [Node.js](https://nodejs.org/)（需要版本 20 或更高）
* [npm](https://www.npmjs.com/)、[yarn](https://yarnpkg.com/)、[pnpm](https://pnpm.io/) 或 [bun](https://bun.sh/)

### 1. 设置 API 密钥 🟢

您需要一个 OpenAI API Key 才能使用此应用程序。

⚠️ [您的 OpenAI Organization 需要完成验证才能使用 GPT 图像模型](https://help.openai.com/en/articles/10910291-api-organization-verification)

1. 如果您没有 `.env.local` 文件，请创建一个。
2. 将您的 OpenAI API Key 添加到 `.env.local` 文件中：

```dotenv
OPENAI_API_KEY=在此输入您的_openai_api_密钥
```

**Important：** 请确保您的 API Key 保密。`.env.local` 文件默认已包含在 `.gitignore` 中，以防止意外提交。


#### 🟡 （可选）IndexedDB 模式（用于 Serverless 环境）

对于文件系统为只读或临时性的环境（如 Vercel 的 Serverless Functions），您可以将应用程序配置为使用 Dexie.js 将生成的图像直接存储在浏览器的 IndexedDB 中。

在您的 `.env.local` 文件中或托管服务商的界面中设置以下环境变量：

```dotenv
NEXT_PUBLIC_IMAGE_STORAGE_MODE=indexeddb
```

当此变量设置为 `indexeddb` 时：
* 服务器 API (`/api/images`) 将返回 Base64 格式的图像数据 (`b64_json`)，而不是将其保存到磁盘。
* 客户端应用程序将对 Base64 数据进行解码，并将图像 Blob 存储在 IndexedDB 中。
* 图像将使用 Blob URL 直接从浏览器的存储中提供。

如果**未设置**此变量或其值为其他内容，应用程序将恢复为默认行为，即把图像保存到服务器文件系统的 `./generated-images` 目录。

**Note：** 如果未显式设置 `NEXT_PUBLIC_IMAGE_STORAGE_MODE`，应用程序会自动检测是否在 Vercel 环境中运行（通过 `VERCEL` 或 `NEXT_PUBLIC_VERCEL_ENV` 环境变量），如果是，则默认为 `indexeddb` 模式。否则（例如在本地运行），默认为 `fs` 模式。您始终可以通过显式设置变量为 `fs` 或 `indexeddb` 来覆盖此自动行为。

#### 🟡 （可选）使用自定义 API Endpoint

如果您需要使用与 OpenAI 兼容的 API Endpoint（例如本地模型服务器或其他供应商），可以通过在 `.env.local` 文件中设置 `OPENAI_API_BASE_URL` 环境变量来指定其基础 URL：

```dotenv
OPENAI_API_KEY=在此输入您的_openai_api_密钥
OPENAI_API_BASE_URL=在此输入您的兼容_api_endpoint地址
```

如果未设置 `OPENAI_API_BASE_URL`，应用程序将默认使用标准的 OpenAI API Endpoint。

---

#### 🟡 （可选）启用密码验证

```dotenv
APP_PASSWORD=在此输入您的密码
```

当设置了 `APP_PASSWORD` 时，前端将提示您输入密码来验证请求。

<p align="center">
  <img src="./readme-images/password-dialog.jpg" alt="密码对话框截图" width="460"/>
</p>

---

### 2. 安装依赖 🟢

在终端中导航到项目目录，并安装必要的依赖包：

```bash
npm install
# 或者
# yarn install
# 或者
# pnpm install
# 或者
# bun install
```

### 3. 运行开发服务器 🟢

启动 Next.js 开发服务器：

```bash
npm run dev
# 或者
# yarn dev
# 或者
# pnpm dev
# 或者
# bun dev
```

### 4. 打开游乐场 🟢

在您的网页浏览器中打开 [http://localhost:3000](http://localhost:3000)。现在您应该可以使用 GPT 图像游乐场了！
