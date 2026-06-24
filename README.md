<!--
╔══════════════════════════════════════════════════════════════════════╗
║  DreamSeed 种梦计划 — AI创造者大赛  官方 README 模板                ║
║                                                                      ║
║  使用说明：                                                          ║
║  1. 将本模板放在参赛仓库根目录 README.md 的顶部                       ║
║  2. 头图使用 DreamField 官方公开活动图片地址                         ║
║  3. 请保留 DREAMFIELD_README_HEADER_START / END 标识                 ║
║  4. 分割线以下供创作者自由编写项目内容                               ║
╚══════════════════════════════════════════════════════════════════════╝
-->

<!-- DREAMFIELD_README_HEADER_START -->

<p align="center">
  <a href="https://www.dreamfield.top">
    <img src="https://www.dreamfield.top/dream-field/contest-readme/assets/dreamseed-readme-banner.png" alt="DreamSeed 种梦计划参赛作品" width="100%" />
  </a>
</p>

<p align="right"><a href="./README_EN.md">English</a></p>

<!-- DREAMFIELD_README_HEADER_END -->

# <img src="./public/favicon.svg" alt="项目 Logo" width="30" height="30" style="vertical-align: middle; margin-right: 8px;"> GPT 图像工坊

一个基于 OpenAI GPT Image 系列模型（`gpt-image-2`、`gpt-image-1.5`、`gpt-image-1`、`gpt-image-1-mini`）的 Web 端图像生成与编辑工作台。

> **说明：** 工坊默认使用 OpenAI 最新的 `gpt-image-2` 模型。该模型不仅兼容旧版的固定尺寸，还支持高达 4K 的任意分辨率（含约束校验）。

<p align="center">
  <img src="./readme-images/interface.jpg" alt="主界面截图" width="600"/>
</p>

---

## ✨ 功能特性

 **🎨 图像生成模式**：通过文本提示词（Prompt）创建全新图像。
 **🖌️ 图像编辑模式**：基于文本指令 + 可选 Mask 对已有图像进行局部修改。
**⚙️ 完整 API 参数控制**：通过 UI 直接调整 OpenAI Images API 支持的所有关键参数——模型、尺寸、输出格式、压缩质量、背景、审核、生成数量。
**📐 自定义分辨率（gpt-image-2）**：支持从 2K / 4K 预设中选取，或手动输入 宽×高，实时校验模型约束：
  - 宽高均为 **16 的倍数**
  - 单边最大 **3840 px**
  - 宽高比 ≤ **3:1**
  - 总像素范围 **655,360 ~ 8,294,400**

**🎭 集成 Mask 工具**：在编辑模式下，可直接在图像上涂抹以生成 Mask，也支持上传外部 Mask 图像。

  > ⚠️ 请注意：`gpt-image-1` 的 Mask 编辑功能目前尚不能保证 100% 精确控制。<br>
  > 1) [这是已知且已确认的模型局限性。](https://community.openai.com/t/gpt-image-1-problems-with-mask-edits/1240639/37)<br>
  > 2) [OpenAI 计划在后续更新中改进此问题。](https://community.openai.com/t/gpt-image-1-problems-with-mask-edits/1240639/41)

<p align="center">
  <img src="./readme-images/mask-creation.jpg" alt="Mask 编辑" width="350"/>
</p>

 **📜 详细历史与成本追踪**：
  - 查看所有图像生成与编辑的完整历史记录
  - 每次请求的参数详情一览
  - 详细的 API Token 用量及预估费用明细（`$USD`）——**提示：点击图像上的 `$` 金额即可查看**
  - 查看每条历史记录对应的完整 Prompt
  - 累计历史 API 总费用统计
  - 支持从历史记录中删除条目

<p align="center">
  <img src="./readme-images/history.jpg" alt="历史记录面板" width="1306"/>
</p>

<p align="center">
  <img src="./readme-images/cost-breakdown.jpg" alt="费用明细" width="350"/>
</p>

 **🖼️ 灵活的图片输出视图**：以网格形式浏览批量生成的图像，也可选中单张仔细查看。
 **🚀 一键送编辑**：将生成结果或历史记录中的任意图像快速送入编辑模式。
 **📋 剪贴板粘贴**：直接将剪贴板中的图像粘贴到编辑模式的源图像区域。
 **💾 双存储模式**：通过 `NEXT_PUBLIC_IMAGE_STORAGE_MODE` 切换：
  - **Filesystem（默认）**：图像保存在服务端的 `./generated-images` 目录
  - **IndexedDB**：图像直接存储在浏览器 IndexedDB 中（**Serverless 部署的理想选择**）
  - 生成历史元数据始终保存在浏览器 LocalStorage 中

---
## 🚀 使用步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```dotenv
OPENAI_API_KEY=your_openai_api_key_here
# 可选
# OPENAI_API_BASE_URL=your_compatible_api_endpoint_here
# NEXT_PUBLIC_IMAGE_STORAGE_MODE=indexeddb
# APP_PASSWORD=your_password_here
```

### 3. 启动本地开发

```bash
npm run dev
```

### 4. 打开应用

访问 `http://localhost:3000`。

## ⚙️ 配置说明

- `OPENAI_API_KEY`：必需。
- `OPENAI_API_BASE_URL`：可选，自定义兼容 Endpoint。
- `NEXT_PUBLIC_IMAGE_STORAGE_MODE`：`fs` 或 `indexeddb`。
- `APP_PASSWORD`：可选，用于保护删除等敏感操作。

## 🚢 部署提示

- Node.js 20 或更高版本。
- Vercel 等 Serverless 环境建议使用 `indexeddb`。
- 如果启用 `fs` 模式，请确保服务器可写入 `generated-images/`。

## ❓ FAQ

- 支持哪些模型？
  - `gpt-image-2`、`gpt-image-1.5`、`gpt-image-1`、`gpt-image-1-mini`
- 为什么图片有时无法加载？
  - `fs` 模式下检查目录写入权限。
  - `indexeddb` 模式下检查浏览器存储权限。

## 🤝 联系我们

如需帮助或报告问题，请在仓库打开 Issue，或联系作者。
