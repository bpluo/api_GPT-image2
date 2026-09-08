# 图像工坊：体验与流程审查记录

审查日期：2026-09-08。范围：首次配置、生成与编辑、请求与流式处理、图片存储、历史管理、失败恢复、移动端布局。

本文记录图像工坊的主要体验问题、已实施的修复和当前验证范围。模板部分的补充说明见 [模板与提示词说明](prompt-workflow.md)。


## 主要问题与处理结果

下表位置指向修改后的实现，便于检查修复。

| 等级 | 原问题及用户影响 | 修复与代码位置 |
| --- | --- | --- |
| 严重 | 自定义接口地址可以与服务端密钥混用，导致服务端密钥被发送到调用者选择的地址。 | 自定义地址必须搭配个人密钥；个人与服务端配置分别解析。[api-config.ts](../src/lib/api-config.ts#L27) |
| 高 | 修改密码后立即重试仍可能读取旧状态；上游 API 的 401 又可能被误判为访问密码错误。 | 重试显式传入新密码摘要，使用独立错误码区分两类认证失败。[page.tsx](../src/app/page.tsx#L162)、[images/route.ts](../src/app/api/images/route.ts#L17) |
| 高 | 编辑界面的流式开关没有实际发送；生成和编辑共用流式状态，会互相干扰。 | 两种模式分别保存配置，统一使用请求快照生成表单。[image-request.ts](../src/lib/image-request.ts#L30) |
| 高 | 流式解析依赖固定换行及结尾格式，中断或缺少完成事件时可能静默结束。 | 支持分包、CRLF 和末尾无空行；未收到完整图片时明确报错。[image-request.ts](../src/lib/image-request.ts#L78) |
| 高 | 批量返回中一张无效，或完整图片后流连接中断，会丢弃已有结果。 | 保留有效图片并显示部分成功提示；空图片不作为成功结果保存。[images/route.ts](../src/app/api/images/route.ts#L161)、[image-stream.ts](../src/lib/image-stream.ts#L103) |
| 高 | 新请求开始或失败就清空预览；长请求只有转圈，用户无法判断或退出。 | 保留原结果，显示等待时间、保存阶段、停止等待和明确的重试入口。[use-image-job.ts](../src/hooks/use-image-job.ts#L12)、[image-output.tsx](../src/components/image-output.tsx#L24) |
| 高 | 删除部分失败仍移除整条记录；以时间戳识别条目可能误删同毫秒记录。 | 使用稳定 ID，仅移除成功删除的图片，保留失败图片及参数。[history.ts](../src/lib/history.ts#L121) |
| 高 | 清空操作与存储模式绑定，可能清错浏览器图片；共用或被后续编辑引用的源图也可能被删。 | 按每条记录的实际存储位置制定删除计划，保护仍被引用的图片，不执行数据库整表清空。[history.ts](../src/lib/history.ts#L94)、[client-images.ts](../src/lib/client-images.ts#L46) |
| 高 | 将历史图片送入编辑时按当前部署模式读取，迁移后可能读错位置。 | 历史图片按记录自己的存储模式读取，继续编辑直接使用当前可见图片地址。[client-images.ts](../src/lib/client-images.ts#L8) |
| 高 | 上传图片与预览异步追加可能错位；增加参考图会重置底图选区，未重新保存时可能提交旧遮罩。 | 预览与 File 对象绑定；仅更换底图才重建遮罩编辑器；提交时从最新笔画生成遮罩，增加撤销。[mask-editor.tsx](../src/components/mask-editor.tsx#L78)、[editing-form.tsx](../src/components/editing-form.tsx#L73) |
| 中 | 刷新会丢失提示词与参数，生成与编辑之间缺少独立草稿。 | 独立保存两套文字和参数草稿，校验恢复数据，存储失败给出提示。[use-workspace-draft.ts](../src/hooks/use-workspace-draft.ts#L14) |
| 中 | 历史读取失败会覆盖旧数据；多页面保存容易覆盖较新的记录。 | 保留无法解析的原始数据，坏条目先备份；更新前读取最新记录并监听其他页面变化。[use-history-store.ts](../src/hooks/use-history-store.ts#L8) |
| 中 | 浏览器空间不足时，已经生成的图片也无法交给用户。 | 即使 IndexedDB 保存失败，仍保留当前图片的可下载地址，并提示下载后再刷新。[client-images.ts](../src/lib/client-images.ts#L19) |
| 中 | 首页的模板和技术参数占据主要空间，提示词被挤到下方；移动端嵌套固定高度难以操作。 | 提示词优先，模板采用选择与预览面板，高级选项按需折叠；桌面双栏、窄屏顺序布局，并提供页面导航。[prompt-composer.tsx](../src/components/prompt-composer.tsx#L20)、[image-options.tsx](../src/components/image-options.tsx#L20) |
| 中 | 结果缺少直接下载、放大和后续编辑入口；历史横向堆积且无法检索。 | 增加原图下载、放大、批量浏览、设为编辑底图；历史支持搜索、类型筛选、分组、分页和参数复用。[image-output.tsx](../src/components/image-output.tsx#L24)、[history-panel.tsx](../src/components/history-panel.tsx#L31) |
| 中 | 中转模型套用其他模型单价，异常令牌值也可能产生误导费用。 | 未知单价不估算，拒绝负数及非有限用量；沿用项目已有标准模型费率，实际费用仍以服务商为准。[cost-utils.ts](../src/lib/cost-utils.ts#L103) |
| 低 | 中英文混杂、控件命名不清晰、关闭删除确认后无法重新开启。 | 统一中文文案和尺寸错误提示，补充控件名称，提供可恢复的删除确认开关。 |

## 重构结构

- `image-settings.ts`：共享模型列表、配置约束、尺寸和上传校验。
- `api-config.ts`、`server-config.ts`：配置配对、访问密码与服务端存储选择。
- `image-request.ts`、`use-image-job.ts`：请求快照、流解析、取消、错误与等待状态。
- `history.ts`、`use-history-store.ts`：旧记录迁移、分组、引用保护与持久化。
- `client-images.ts`、`stored-image.tsx`：按需读取、保存和释放图片资源，避免一次加载全部历史 Blob。
- `image-options.tsx`、`prompt-composer.tsx`：生成和编辑共用表单控件。
- `mask-editor.tsx`：独立维护局部编辑笔画与遮罩，表单提交时读取最新选区。

## 验证情况

自动化回归 61 项全部通过，分别位于 `tests/core.test.cjs`、`tests/api.test.cjs`、`tests/client.test.cjs` 和 `tests/prompts.test.cjs`。TypeScript、ESLint、生产构建和差异空白检查均通过。请求均被模拟，没有调用真实付费图像服务。

验证命令：

```powershell
node --test tests/core.test.cjs tests/api.test.cjs tests/client.test.cjs tests/prompts.test.cjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src
node node_modules/next/dist/bin/next build
git diff --check
```



已准备本地模拟验收服务 `tests/fixture-server.cjs`，地址为 `http://127.0.0.1:3020`。所有生成、编辑、删除请求都由模拟服务处理，不转发到真实图像服务。

尚未完成真实服务商输出与浏览器交互验收，以下项目需要继续验证：

1. 桌面与 390 像素窄屏下的布局、滚动、键盘焦点和弹窗。
2. 刷新恢复草稿、模板替换撤销、中文输入期间的提交快捷键。
3. 生成成功、失败保留结果、等待取消，以及密码修改后自动继续。
4. 图片拖放、粘贴、增加参考图、换底图、涂抹与撤销后提交。
5. 历史检索、参数复用、放大、下载和删除确认。

## 当前行为边界

- 编辑素材与笔画只保留在当前页面，刷新后需重新添加；文字与参数会保存。
- 取消会中止客户端等待并尝试取消上游请求，上游已发生的处理或费用无法保证回退。
- 旧历史缺少的尺寸等参数无法精确还原，复用时使用默认值并提示。
- 历史导出包含记录、提示词和参数，不包含图片文件；需要保留的图片应另行下载。
