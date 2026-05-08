# <img src="./public/favicon.svg" alt="项目 Logo" width="30" height="30" style="vertical-align: middle; margin-right: 8px;"> GPT 图像游乐场

一个基于 Web 的游乐场，用于与 OpenAI 的 GPT 图像模型（`gpt-image-2`、`gpt-image-1.5`、`gpt-image-1` 和 `gpt-image-1-mini`）进行交互，实现图像生成与编辑功能。

> **注意：** 本游乐场默认使用 `gpt-image-2`，这是 OpenAI 最新的 GPT 图像模型。除了传统的固定尺寸外，它还支持高达 4K 的任意分辨率（附带有约束验证）。

<p align="center">
  <img src="./readme-images/interface.jpg" alt="界面截图" width="600"/>
</p>

## ✨ 功能特性

*   **🎨 图像生成模式：** 根据文本提示创建新图像。
*   **🖌️ 图像编辑模式：** 基于文本提示和可选的遮罩修改现有图像。
*   **⚙️ 完整的 API 参数控制：** 通过界面直接访问和调整 OpenAI 图像 API 支持的所有相关参数（尺寸、质量、输出格式、压缩、背景、审核、生成数量）。
*   **📐 自定义分辨率（gpt-image-2）：** 从 2K/4K 预设中选择，或输入任意的宽 × 高，系统会根据模型的约束条件进行实时验证（边长需为 16 的倍数，单边最大 3840 像素，宽高比 ≤ 3:1，总像素在 655，360 至 8,294,400 之间）。
*   **🎭 内置遮罩工具：** 在编辑模式下轻松创建或上传遮罩，以指定需要修改的区域。您可以直接在图像上绘制来生成遮罩。

     > ⚠️ 请注意，目前 `gpt-image-1` 的遮罩功能并不能保证 100% 的控制效果。 <br>1) [这是已知且被确认的模型限制。](https://community.openai.com/t/gpt-image-1-problems-with-mask-edits/1240639/37) <br>2) [OpenAI 计划在未来的更新中解决此问题。](https://community.openai.com/t/gpt-image-1-problems-with-mask-edits/1240639/41)
<p align="center">
  <img src="./readme-images/mask-creation.jpg" alt="遮罩创建截图" width="350"/>
</p>

*   **📜 详细的历史记录与成本追踪：**
    *   查看您所有的图像生成和编辑的完整历史记录。
    *   查看每次请求所使用的参数。
    *   获取详细的 API 令牌用量和每次操作的预估成本明细（`美元`）。（提示：点击图像上的 `$` 金额即可查看）
    *   查看每个历史项所使用的完整提示词。
    *   查看历史总 API 成本。
    *   从历史记录中删除项目。

<p align="center">
  <img src="./readme-images/history.jpg" alt="历史记录截图" width="1306"/>
</p>

<p align="center">
  <img src="./readme-images/cost-breakdown.jpg" alt="成本明细截图" width="350"/>
</p>

*   **🖼️ 灵活的图像输出视图：** 以网格形式查看生成的图像批次，或选择单张图像进行近距离查看。
*   **🚀 发送到编辑：** 快速将任何生成的图像或历史图像直接发送到编辑表单。
*   **📋 粘贴到编辑：** 直接从剪贴板粘贴图像到编辑模式的源图像区域。
*   **💾 存储：** 通过 `NEXT_PUBLIC_IMAGE_STORAGE_MODE` 支持两种存储模式：
    *   **文件系统（默认）：** 图像保存到服务器的 `./generated-images` 目录。
    *   **IndexedDB：** 图像直接保存在浏览器的 IndexedDB 中（非常适合无服务器部署）。
    *   生成历史记录的元数据始终保存在浏览器的本地存储中。

## ▲ 部署到 Vercel

🚨 *注意：如果您从 `main` 或 `master` 分支部署，您的 Vercel 应用将对**任何拥有 URL 的人公开可用**。从其他分支部署则需要用户登录 Vercel（并在您的团队中）才能访问预览构建。* 🚨

您可以通过一键点击将本游乐场的实例部署到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/alasano/gpt-image-1-playground&env=OPENAI_API_KEY,NEXT_PUBLIC_IMAGE_STORAGE_MODE,APP_PASSWORD&envDescription=OpenAI%20API%20Key%20is%20required.%20Set%20storage%20mode%20to%20indexeddb%20for%20Vercel%20deployments.&project-name=gpt-image-playground&repository-name=gpt-image-playground)

在部署设置过程中，系统会提示您输入 `OPENAI_API_KEY` 和 `APP_PASSWORD`。对于 Vercel 部署，**必须**将 `NEXT_PUBLIC_IMAGE_STORAGE_MODE` 设置为 `indexeddb`。

注意：如果未设置 `NEXT_PUBLIC_IMAGE_STORAGE_MODE`，应用程序会自动检测是否在 Vercel 环境中运行（通过 `VERCEL` 或 `NEXT_PUBLIC_VERCEL_ENV` 环境变量），如果是，则默认为 `indexeddb` 模式。否则（例如在本地运行），默认为 `fs` 模式。您始终可以通过显式设置变量为 `fs` 或 `indexeddb` 来覆盖此自动行为。

## 🚀 快速开始 [本地部署]

按照以下步骤在本地运行游乐场。

### 前提条件

*   [Node.js](https://nodejs.org/)（需要版本 20 或更高）
*   [npm](https://www.npmjs.com/)、[yarn](https://yarnpkg.com/)、[pnpm](https://pnpm.io/) 或 [bun](https://bun.sh/)

### 1. 设置 API 密钥 🟢

您需要一个 OpenAI API 密钥才能使用此应用程序。

⚠️ [您的 OpenAI 组织需要完成验证才能使用 GPT 图像模型](https://help.openai.com/en/articles/10910291-api-organization-verification)

1.  如果您没有 `.env.local` 文件，请创建一个。
2.  将您的 OpenAI API 密钥添加到 `.env.local` 文件中：

    ```dotenv
    OPENAI_API_KEY=在此输入您的_openai_api_密钥
