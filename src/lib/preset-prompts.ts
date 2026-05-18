export type PromptTemplate = {
    title: string;
    text: string;
    description?: string;
    recommendedSize?: 'auto' | 'square' | 'landscape' | 'portrait' | 'custom';
    recommendedQuality?: 'low' | 'medium' | 'high' | 'auto';
    recommendedOutputFormat?: 'png' | 'jpeg' | 'webp';
    tags?: string[];
    useCases?: ('generate' | 'edit')[];
};

export type PromptCategory = {
    id: string;
    label: string;
    icon: string;
    prompts: PromptTemplate[];
};

const academicStyleRules = `

## 统一论文绘图规范
- Use a clean academic figure style: white background, flat vector shapes, precise alignment, thin arrows, and low-saturation professional colors.
- All visible labels must be short, readable English labels. Avoid long paragraphs inside the figure.
- Prefer publication-ready layout: clear hierarchy, consistent spacing, balanced whitespace, and figure elements that remain readable in a paper column.
- Do not invent quantitative values, axis scales, legends, equations, dataset names, or method names. If data is missing, leave clean placeholders or visualize structure only.
- Avoid photorealistic rendering, messy sketches, decorative 3D shadows, saturated colors, and unreadable tiny text.`;

export const presetPromptCategories: PromptCategory[] = [
    {
        id: 'academic',
        label: '科研论文绘图',
        icon: 'FileText',
        prompts: [
            {
                title: '方法架构图 / Method Pipeline',
                description: '适合论文主图、模型结构、数据流、模块机制和核心创新展示。',
                recommendedSize: 'landscape',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png',
                tags: ['方法架构图', 'Pipeline', '顶会主图'],
                useCases: ['generate'],
                text: `请基于我提供的论文方法描述，绘制一张 publication-ready 的方法架构图。

## 图形目标
- 展示方法的整体 pipeline、输入/输出、关键模块、数据流方向和核心创新点。
- 将复杂方法拆成 3-6 个清晰阶段，每个阶段使用圆角模块、简洁图标或张量示意表达。
- 用箭头表示信息流、特征流或训练/推理流程，必要时用不同颜色区分主干路径、辅助分支和损失约束。

## 内容要求
- 图中保留短英文标签，例如 Input, Encoder, Fusion, Decoder, Loss, Output。
- 如果我提供张量尺寸、模块名、损失函数或数据集名，只使用我提供的信息，不要自行编造。
- 突出 novelty：用细边框、浅色高亮或 callout 标注最关键模块。
${academicStyleRules}`
            },
            {
                title: '实验结果图 / Publication Chart',
                description: '适合 SOTA 对比、消融实验、折线/柱状/热力图和多指标结果可视化。',
                recommendedSize: 'landscape',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png',
                tags: ['实验结果图', 'Chart', '禁止编造数据'],
                useCases: ['generate'],
                text: `请基于我提供的实验数据或实验目的，绘制一张严谨的论文结果图。

## 图形目标
- 根据数据关系选择最合适的学术图表：grouped bar chart, horizontal bar chart, line chart with confidence band, heatmap, scatter plot, radar chart, box/violin plot, or qualitative comparison grid。
- 强调统计严谨性：如果我提供均值/方差/多次实验结果，请加入 error bars、confidence interval 或清晰图例。
- 如果方法名称较长，优先使用横向条形图；如果展示训练过程，优先使用带置信区间的折线图；如果展示矩阵结果，优先使用热力图。

## 数据约束
- Strictly use only the numbers, labels, methods, datasets, and metrics I provide.
- Do not invent values, rankings, p-values, axis ranges, legends, or baselines.
- If exact data is not provided, create a clean chart layout template with placeholders instead of fake data.
${academicStyleRules}`
            },
            {
                title: '技术示意图 / System Diagram',
                description: '适合系统架构、流程图、时序图、状态机、网络拓扑和工程论文配图。',
                recommendedSize: 'landscape',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png',
                tags: ['技术示意图', '系统架构', '流程图'],
                useCases: ['generate'],
                text: `请基于我提供的系统或技术流程描述，绘制一张论文级技术示意图。

## 图形目标
- 根据内容选择 system architecture、flowchart、sequence diagram、state machine、ER diagram 或 network topology 风格。
- 将系统分层展示，例如 Client / Service / Model / Database / External API，或 Sensor / Data / Model / Application。
- 使用清晰箭头表达调用关系、数据流、状态转移或时序消息。

## 视觉要求
- 使用工程论文常见的白底或极浅灰底，模块为几何块，边框细、对齐严格。
- 用少量角色色区分层级或组件类型，不使用花哨装饰。
- 图例、协议名、模块名只使用我提供的信息；缺失时用 generic placeholders。
${academicStyleRules}`
            },
            {
                title: '图形摘要 / Graphical Abstract',
                description: '适合期刊 graphical abstract、研究总览和论文首页视觉摘要。',
                recommendedSize: 'landscape',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png',
                tags: ['Graphical Abstract', '研究总览'],
                useCases: ['generate'],
                text: `请基于我提供的研究主题和主要贡献，绘制一张期刊风格 graphical abstract。

## 图形目标
- 用 3-4 个连续面板讲清楚 Problem → Method → Key Mechanism → Outcome。
- 画面应像论文图形摘要，而不是营销海报；重点是科学逻辑、机制路径和可读性。
- 如果涉及实验装置、材料、算法或生物机制，用简洁示意而非写实照片。
${academicStyleRules}`
            },
            {
                title: '定性对比网格 / Qualitative Comparison',
                description: '适合 CV/ML 论文中的多方法、多样本、多列对比结果图。',
                recommendedSize: 'landscape',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png',
                tags: ['定性对比', 'Comparison Grid'],
                useCases: ['generate'],
                text: `请基于我提供的样本、方法和对比目标，绘制一张论文定性对比网格。

## 图形目标
- 使用规则网格布局：rows = samples, columns = methods 或 ablations。
- 每列有清晰英文方法名，每行保持相同样本顺序。
- 用细边框、放大框或箭头突出关键差异，但不要夸张装饰。

## 严格约束
- 不要生成虚假的实验结果图像或假数据。
- 如果我没有提供真实结果，只生成空白网格模板、标签、占位框和版式结构。
${academicStyleRules}`
            },
            {
                title: '科研图修订 / Figure Refinement',
                description: '用于编辑模式：统一已有论文图风格、清理背景、修正布局和标签。',
                recommendedSize: 'auto',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png',
                tags: ['编辑修订', '统一风格'],
                useCases: ['edit'],
                text: `请在保留原图科学含义和结构的前提下，将这张图修订为更适合论文发表的版本。

## 修订目标
- 保留原有模块、连线、数据关系和标签含义，不改变科学结论。
- 统一为干净的 academic vector style：白底、低饱和配色、细边框、整齐对齐、清晰箭头。
- 改善文字可读性，将标签整理为短英文标签；不要新增我没有提供的术语或数值。
- 清理多余背景、杂乱线条、过重阴影和不一致字体。
${academicStyleRules}`
            }
        ]
    },
    {
        id: 'illustration',
        label: '插画',
        icon: 'Palette',
        prompts: [
            { title: '水彩风景', text: '柔和的水彩风格风景画，描绘了一座日本古城在樱花季节中的景象，远处是覆盖着雪的富士山，温暖的晨光洒在整个画面上，柔和的色彩融合，梦幻般的氛围' },
            { title: '儿童绘本', text: '温馨可爱的儿童绘本插画风格，一只穿着黄色雨衣的小兔子在雨后森林中跳跃，水坑反射着彩虹色，柔和的粉彩配色，简单的形状，迷人的表情' },
            { title: '水墨极简', text: '极简主义中国水墨画风格，一叶扁舟在薄雾笼罩的江面上行驶，只用了寥寥数笔黑色墨迹，大量留白，宁静致远，优雅的笔触' }
        ]
    },
    {
        id: 'poster',
        label: '海报设计',
        icon: 'Newspaper',
        prompts: [
            { title: '电影海报', text: '史诗科幻电影海报，一名孤独的宇航员站在荒芜的外星景观中，凝视着巨大行星在天空中升起，戏剧性的光线，丰富的纹理，大胆的排版空间，电影般的构图' },
            { title: '极简音乐节', text: '为夏季音乐节设计的极简主义海报，黑底配霓虹粉色和青色渐变，抽象的声波图形，大胆的无衬线字体，现代且充满活力的风格，A4比例' }
        ]
    },
    {
        id: 'ui-ux',
        label: 'UI/UX设计',
        icon: 'Monitor',
        prompts: [
            { title: '移动端仪表盘', text: '现代移动端应用界面设计，深色模式的金融仪表盘，包含彩色图表和卡片式布局，跟踪支出、投资和预算，干净的无衬线字体，微妙的光泽效果，iOS风格导航' },
            { title: 'SaaS着陆页', text: '现代SaaS产品着陆页的界面设计，浅色背景，干净的布局，大标题和插图，可爱的品牌配色方案，客户推荐区域，圆角组件，极简主义' }
        ]
    }
];

export const academicPromptCategory = presetPromptCategories.find((category) => category.id === 'academic')!;

export function getAcademicPromptsForMode(mode: 'generate' | 'edit'): PromptTemplate[] {
    return academicPromptCategory.prompts.filter((prompt) => !prompt.useCases || prompt.useCases.includes(mode));
}

export function getAllPresetPrompts(): { title: string; text: string; categoryLabel: string }[] {
    const result: { title: string; text: string; categoryLabel: string }[] = [];
    for (const cat of presetPromptCategories) {
        for (const p of cat.prompts) {
            result.push({ title: p.title, text: p.text, categoryLabel: cat.label });
        }
    }
    return result;
}
