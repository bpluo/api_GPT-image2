import type { PromptCategorySource, PromptField } from './preset-prompts';

const field = (
    id: string,
    label: string,
    example: string,
    required = true,
    kind: PromptField['kind'] = 'text'
): PromptField => ({ id, label, example, required, kind });
const scientific = [
    '模块、术语、连接关系和数值只使用提供的内容；缺失信息不自行补造。',
    '使用简洁的学术示意风格，清晰区分信息层级；标签、箭头和图例互不遮挡。',
    '保留足够边距和留白，避免装饰性立体效果与难以辨认的小字。'
];
const faithfulEdit = [
    '只修改明确指定的内容，保留其余主体、构图、比例和细节。',
    '如提供遮罩，将修改限制在选区内；处理好选区边缘的连续性。'
];
const photo = ['保持主体比例、材质和光影关系自然，避免不合理的透视与反射。', '不添加未提供的标志、文字或水印。'];
const layout = [
    '信息层级清晰、对齐一致，正文不过密，四周留有安全边距。',
    '明确给出的文案、数字和专有名词逐字保留，不添加虚构宣传信息。'
];

export const templateCategories: PromptCategorySource[] = [
    {
        id: 'academic',
        label: '科研绘图',
        description: '方法架构、研究示意与论文图修订',
        icon: 'FlaskConical',
        prompts: [
            {
                id: 'method-pipeline',
                title: '方法架构图',
                description: '把方法描述整理成输入、模块与输出的清晰流程。',
                mode: 'generate',
                tags: ['方法', '架构', '流程'],
                keywords: ['method', 'pipeline', 'framework', '网络结构'],
                fields: [
                    field('subject', '研究任务', '多传感器信息融合的目标识别方法'),
                    field('flow', '模块与数据流', '相机与雷达输入 → 各自编码 → 特征融合 → 目标分类'),
                    field('focus', '需要突出之处', '重点突出特征融合模块，用浅色边框强调。', false)
                ],
                task: '绘制一张能准确解释所给方法的方法架构示意图。',
                composition: '按数据流方向组织版面，主路径清晰，辅助分支与主路径有区别；图中只放必要的短标签。',
                constraints: scientific,
                recommendedSize: 'landscape',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            },
            {
                id: 'scientific-chart',
                title: '实验结果图版式',
                description: '先确定结果图的结构、图例与标注位置。',
                mode: 'generate',
                tags: ['实验', '数据图', '排版'],
                keywords: ['chart', 'plot', '结果', '消融', '折线', '柱状', 'heatmap'],
                fields: [
                    field('subject', '想呈现的比较或关系', '比较三种方法在两个数据集上的表现'),
                    {
                        ...field('data', '已有数据与统计信息', '', false),
                        placeholder: '粘贴真实数据、指标单位、样本量以及误差含义；没有数据时留空。'
                    },
                    field('labels', '方法名、指标与单位', '方法 A、方法 B、方法 C；准确率（%）', false)
                ],
                task: '为所给实验内容设计一张易于阅读的结果图版式。',
                composition: '按数据关系选择清楚的图表结构，设置图例与坐标标签的位置；用颜色、线型或标记共同区分组别。',
                constraints: [...scientific, '不编造数据、排名、坐标范围、误差线、显著性标记或检验方法。'],
                emptyFieldRule: {
                    field: 'data',
                    instruction:
                        '当前未提供真实数据：只画带标签的版式框架，不绘制代表实验结果的曲线、柱形、热力值或趋势。'
                },
                note: '适合先定版式。正式定量图的数值、比例与统计标记，需使用数据绘图工具生成并核对。',
                recommendedSize: 'landscape',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            },
            {
                id: 'system-diagram',
                title: '系统与技术示意',
                description: '展示系统分层、组件关系或工程流程。',
                mode: 'generate',
                tags: ['系统', '组件', '技术流程'],
                keywords: ['architecture', 'flowchart', 'sequence', '拓扑'],
                fields: [
                    field('subject', '系统用途', '边缘设备协同完成图像分析'),
                    field('flow', '组件与连接关系', '摄像头 → 边缘推理节点 → 消息队列 → 服务端结果展示'),
                    field('details', '需要标注的信息', '分别标明设备端和服务端边界；箭头表示数据方向。', false)
                ],
                task: '根据给定组件与关系绘制一张清楚的技术示意图。',
                composition: '按层级或流程排列模块，箭头方向明确，避免交叉连线；需要分组时使用轻量边界。',
                constraints: scientific,
                recommendedSize: 'landscape',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            },
            {
                id: 'graphical-abstract',
                title: '研究图形摘要',
                description: '用少量场景讲清研究问题、方法与已有结论。',
                mode: 'generate',
                tags: ['图形摘要', '研究总览'],
                keywords: ['graphical abstract', '机制', '研究概览'],
                fields: [
                    field('subject', '研究问题', '如何提高低照度场景下的目标识别能力'),
                    field('method', '方法或机制', '融合来自相机和雷达的互补信息'),
                    {
                        ...field('outcome', '已得到的结论', '', false),
                        placeholder: '只填写已证实的结论；没有结果时留空。'
                    }
                ],
                task: '把所给研究内容整理成一张科学逻辑清楚的图形摘要。',
                composition: '按“问题 → 方法或机制 → 已提供的结果”组织画面；未提供结果时不增加结论面板。',
                constraints: [...scientific, '不夸大效果，不把预期目标画成已证实的结果。'],
                recommendedSize: 'landscape',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            },
            {
                id: 'qualitative-grid',
                title: '定性对比网格',
                description: '准备统一的样本、方法和局部放大框版式。',
                mode: 'generate',
                tags: ['对比', '网格', '空白版式'],
                keywords: ['qualitative', 'comparison', 'grid', '视觉对比'],
                fields: [
                    field('rows', '行：样本或场景', '室内场景、街道路口、低照度场景'),
                    field('columns', '列：方法或设置', '输入图、方法 A、方法 B、参考结果'),
                    field('focus', '重点比较的区域', '每个图框右下角预留相同尺寸的局部放大框。', false)
                ],
                task: '绘制一张用于放置真实定性结果的空白比较网格。',
                composition: '行列对齐，所有图框尺寸一致；行标题和列标题明确，放大框位置统一。',
                constraints: [...scientific, '只生成图框、标签与版式，不绘制虚构实验图像或暗示方法优劣。'],
                note: '生成后需放入真实实验结果，不可用生成内容替代实验图像。',
                recommendedSize: 'landscape',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            },
            {
                id: 'scientific-refinement',
                title: '科研图风格修订',
                description: '改善已有图的排版和可读性，保留科学内容。',
                mode: 'edit',
                tags: ['科研修订', '对齐', '可读性'],
                keywords: ['figure refinement', '论文图', '统一风格'],
                fields: [
                    field('changes', '要调整的部分', '统一字体大小、箭头粗细和模块间距，改善标签遮挡。'),
                    field('preserve', '必须保持的内容', '所有模块名、数值、连线方向和数据点位置。', false),
                    field('style', '目标风格', '白色背景，低饱和蓝绿色配色，细边框。', false)
                ],
                task: '在已有科研图的基础上进行所指定的视觉修订。',
                composition: '优先改善对齐、留白和标注可读性，保留原有内容的相对关系。',
                constraints: [
                    ...faithfulEdit,
                    '不重新生成实验数据，不改动数值、统计标记或科学结论。',
                    '未提供文字替换清单时，保留所有标签原文，不自动翻译或改写。'
                ],
                recommendedSize: 'auto',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            },
            {
                id: 'scientific-labels',
                title: '科研标签与标注修正',
                description: '按替换清单修正标签，保留数据和结构。',
                mode: 'edit',
                tags: ['标签', '标注', '文字修正'],
                keywords: ['labels', 'annotation', '子图'],
                fields: [
                    field(
                        'changes',
                        '位置与替换清单',
                        '左上模块：Feature → Feature Encoder；右下角标签：Output → Prediction。',
                        true,
                        'copy'
                    ),
                    field('preserve', '需要保留的部分', '坐标刻度、单位、数据点、图例和连线。', false)
                ],
                task: '按照明确给出的清单修正科研图中的标签。',
                composition: '保持标签对齐与字号一致，为长词提供足够空间，不挤压数据区域。',
                constraints: [...faithfulEdit, '只替换清单中指定的文字，其余文字、数值和统计标记逐字保留。'],
                recommendedSize: 'auto',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            }
        ]
    },
    {
        id: 'photography',
        label: '摄影与产品',
        description: '产品主图、场景摄影、食物与人像',
        icon: 'Camera',
        prompts: [
            {
                id: 'product-hero',
                title: '干净产品主图',
                description: '突出产品形态、材质和主体轮廓。',
                mode: 'generate',
                tags: ['产品', '主图', '摄影'],
                keywords: ['product', '电商', '商品'],
                fields: [
                    field('subject', '产品及外观', '一只哑光白色陶瓷杯，圆润杯把，无文字。'),
                    field('background', '背景与摆放', '浅灰背景，产品居中，底部保留自然接触阴影。', false),
                    field('details', '重点表现的细节', '杯沿厚度与细腻的陶瓷质感。', false)
                ],
                task: '拍摄风格地呈现所描述产品，制作一张清晰的产品主图。',
                composition: '主体完整入画，使用柔和棚拍光，画面干净，避免道具抢占主体。',
                constraints: photo,
                recommendedSize: 'square',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            },
            {
                id: 'product-lifestyle',
                title: '产品使用场景',
                description: '把产品放入自然、有用途的生活环境。',
                mode: 'generate',
                tags: ['场景', '生活方式', '产品'],
                keywords: ['lifestyle', '场景图'],
                fields: [
                    field('subject', '产品及特征', '一台小巧的米白色台灯，弧形灯杆。'),
                    field('scene', '使用场景', '傍晚的木质书桌，旁边放着一本翻开的书。'),
                    field('mood', '氛围与色调', '温暖安静，柔和的米色和木色。', false)
                ],
                task: '为所给产品构建自然的生活场景摄影画面。',
                composition: '产品是视觉焦点，环境帮助解释使用情境，光线与场景时间一致。',
                constraints: photo,
                recommendedSize: 'landscape',
                recommendedQuality: 'medium',
                recommendedOutputFormat: 'jpeg'
            },
            {
                id: 'food-photo',
                title: '食物与静物摄影',
                description: '明确食材、器皿、光线和拍摄角度。',
                mode: 'generate',
                tags: ['食物', '静物', '自然光'],
                keywords: ['food', 'still life', '餐饮'],
                fields: [
                    field('subject', '食物或静物', '一盘草莓奶油吐司，搭配小碗新鲜草莓。'),
                    field('setting', '器皿、桌面与角度', '白色陶瓷盘，浅色亚麻桌布，四十五度俯拍。', false),
                    field('light', '光线与氛围', '窗边柔和晨光，颜色自然。', false)
                ],
                task: '创作一张质感自然的食物或静物摄影画面。',
                composition: '保持摆放和透视合理，突出真实纹理，避免过度磨皮或夸张高光。',
                constraints: photo,
                recommendedSize: 'square',
                recommendedQuality: 'medium',
                recommendedOutputFormat: 'jpeg'
            },
            {
                id: 'portrait-photo',
                title: '人像摄影',
                description: '描述人物、场景和光线，减少歧义。',
                mode: 'generate',
                tags: ['人像', '光线', '摄影'],
                keywords: ['portrait', '人物'],
                fields: [
                    field('subject', '人物外观、服装与动作', '一位成年女性，短发、浅色衬衫，站在窗边自然微笑。'),
                    field('scene', '环境与构图', '干净的室内背景，半身构图。', false),
                    field('light', '光线与色调', '柔和侧光，肤色自然，低对比度。', false)
                ],
                task: '创作一张符合人物描述的人像摄影画面。',
                composition: '人物表情与肢体自然，五官和手部结构合理，背景简洁，保留适度皮肤纹理。',
                constraints: photo,
                recommendedSize: 'portrait',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'jpeg'
            }
        ]
    },
    {
        id: 'illustration',
        label: '插画创作',
        description: '水彩、绘本和水墨的场景表达',
        icon: 'Palette',
        prompts: [
            {
                id: 'watercolor-scene',
                title: '水彩风景',
                description: '用主体、季节和光线确定画面氛围。',
                mode: 'generate',
                tags: ['水彩', '风景', '柔和'],
                keywords: ['watercolor', '自然', '风景画'],
                fields: [
                    field('subject', '主要场景', '春天的小镇河岸，石桥旁开着樱花。'),
                    field('mood', '时间与氛围', '清晨薄雾，安静温暖。', false),
                    field('palette', '配色偏好', '浅粉、灰蓝和淡绿色。', false)
                ],
                task: '将所给场景绘制成一张柔和的水彩插画。',
                composition: '利用色彩晕染、纸张肌理和适度留白形成层次，主体轮廓清楚，细节有疏有密。',
                constraints: ['保持水彩材质的一致性，不混入写实摄影或塑料质感。', '不添加未指定的文字、签名或水印。'],
                recommendedSize: 'landscape',
                recommendedQuality: 'medium',
                recommendedOutputFormat: 'png'
            },
            {
                id: 'storybook',
                title: '儿童绘本场景',
                description: '让角色、动作和情绪服务一个小故事。',
                mode: 'generate',
                tags: ['绘本', '角色', '温馨'],
                keywords: ['storybook', '儿童', '卡通'],
                fields: [
                    field('subject', '角色与动作', '穿黄色雨衣的小兔子正在跨过一个小水坑。'),
                    field('scene', '故事场景', '雨后的森林小路，水面映着彩虹。'),
                    field('mood', '情绪与色彩', '轻松、好奇，柔和的粉彩色。', false)
                ],
                task: '绘制一张能表达所给故事情境的儿童绘本插画。',
                composition: '角色表情清楚，轮廓简洁，动作自然；用环境细节支持故事，不堆积装饰。',
                constraints: ['角色外观、服装与道具前后一致。', '未提供故事文字时，不自动生成文字、对白或页码。'],
                recommendedSize: 'square',
                recommendedQuality: 'medium',
                recommendedOutputFormat: 'png'
            },
            {
                id: 'ink-minimal',
                title: '水墨留白',
                description: '用少量主体和笔触表达空间与意境。',
                mode: 'generate',
                tags: ['水墨', '留白', '极简'],
                keywords: ['ink', '国风', '东方'],
                fields: [
                    field('subject', '主要意象', '一叶扁舟行驶在薄雾江面，远处有两层山影。'),
                    field('mood', '意境与留白', '清冷安静，画面上方保留大面积空白。', false)
                ],
                task: '根据所给意象创作一张简洁的水墨画。',
                composition: '以墨色浓淡、干湿笔触和少量层次塑造空间；克制用色，让留白参与构图。',
                constraints: ['不填满画面，不加入无关建筑或繁复装饰。', '不添加未指定的题字、印章、签名或水印。'],
                recommendedSize: 'landscape',
                recommendedQuality: 'medium',
                recommendedOutputFormat: 'png'
            }
        ]
    },
    {
        id: 'poster',
        label: '海报与传播',
        description: '视觉焦点、准确文案与清晰排版',
        icon: 'Newspaper',
        prompts: [
            {
                id: 'movie-poster',
                title: '电影感海报',
                description: '用一个强视觉场景表达故事主题。',
                mode: 'generate',
                tags: ['电影', '故事', '海报'],
                keywords: ['cinematic', 'movie poster', '科幻'],
                fields: [
                    field('subject', '故事主题与主要场景', '孤独的宇航员站在荒芜星球，远处一轮巨大行星缓缓升起。'),
                    field('headline', '片名或标题原文', '远方来信', false, 'copy'),
                    field('mood', '色调与气氛', '深蓝与暖橙对比，安静而有张力。', false)
                ],
                task: '设计一张具有电影感的主题海报。',
                composition: '使用明确的视觉焦点与纵向层级，为已提供的标题保留整洁排版空间。',
                constraints: [...layout, '不虚构演职员名单、评分、奖项或上映信息。'],
                recommendedSize: 'portrait',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            },
            {
                id: 'music-poster',
                title: '音乐活动海报',
                description: '把音乐氛围与活动信息组织成清晰层级。',
                mode: 'generate',
                tags: ['音乐', '活动', '排版'],
                keywords: ['music', 'festival', '演出'],
                fields: [
                    field('subject', '音乐风格与视觉方向', '夏日爵士音乐会，暖色抽象节奏图形。'),
                    field('copy', '需要出现的活动文案', '夏夜爵士', false, 'copy'),
                    field('palette', '配色或品牌要求', '米白、深蓝和少量橙色。', false)
                ],
                task: '设计一张主题明确、信息清楚的音乐活动海报。',
                composition: '标题优先，活动信息分组排列，图形表现节奏感；未提供具体文案时预留文字区。',
                constraints: [...layout, '不自行生成日期、地点、票价、二维码或主办方信息。'],
                recommendedSize: 'portrait',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            },
            {
                id: 'information-poster',
                title: '信息与知识卡片',
                description: '把少量要点转成可阅读的信息图。',
                mode: 'generate',
                tags: ['信息图', '知识卡片', '要点'],
                keywords: ['infographic', '社交', '科普'],
                fields: [
                    field('headline', '标题原文', '桌面整理的三个步骤', true, 'copy'),
                    field('points', '需要呈现的要点', '清空桌面；按用途分组；给常用物品固定位置。', true, 'copy'),
                    field('style', '视觉风格', '简洁线条插画，浅色底，温和的绿色点缀。', false)
                ],
                task: '将提供的标题与要点整理成一张易读的信息卡片。',
                composition: '用编号、分组和少量相关图标帮助阅读；每组信息保持足够间距。',
                constraints: layout,
                recommendedSize: 'portrait',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            }
        ]
    },
    {
        id: 'ui-ux',
        label: '界面视觉稿',
        description: '页面结构与组件层级的静态设计',
        icon: 'Monitor',
        prompts: [
            {
                id: 'mobile-dashboard',
                title: '移动端仪表盘',
                description: '按主要任务组织概览、数据和操作。',
                mode: 'generate',
                tags: ['移动端', '仪表盘', '视觉稿'],
                keywords: ['UI', 'dashboard', 'app', '手机'],
                fields: [
                    field('subject', '产品用途与主要任务', '个人健康应用，让用户快速查看今日运动与睡眠。'),
                    field('modules', '必须出现的模块', '今日概览、运动记录、睡眠卡片、底部导航。'),
                    field('style', '风格与配色', '浅色背景，深色正文，绿色强调按钮。', false)
                ],
                task: '设计所给移动应用的静态界面视觉稿。',
                composition: '突出最重要的信息和主要操作，使用清楚的字号层级、合理的触控空间与一致组件。',
                constraints: [...layout, '未提供真实数据时使用中性占位内容，不伪造收益、健康结论或用户评价。'],
                note: '输出为界面图片，可用于讨论视觉方向；不包含可运行的页面代码。',
                recommendedSize: 'portrait',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            },
            {
                id: 'product-landing',
                title: '产品介绍页',
                description: '围绕产品价值组织首屏与功能信息。',
                mode: 'generate',
                tags: ['网页', '产品介绍', '视觉稿'],
                keywords: ['SaaS', 'landing', '着陆页', 'web'],
                fields: [
                    field('subject', '产品与目标用户', '帮助小团队整理会议记录的工具。'),
                    field(
                        'content',
                        '核心内容与主要按钮',
                        '产品名称、会议摘要、任务提取、协作功能；主按钮为“开始体验”。'
                    ),
                    field('style', '品牌与设计方向', '简洁编辑风格，暖白背景与深绿色。', false)
                ],
                task: '为所给产品设计一张桌面端介绍页的静态视觉稿。',
                composition: '首屏清楚说明用途，区分主次按钮；下方按内容需要组织功能说明，避免机械堆叠相同卡片。',
                constraints: [...layout, '不添加虚构客户标志、用户评价、增长数字或认证背书。'],
                note: '输出为静态视觉稿，实际响应式行为需要在页面实现中验证。',
                recommendedSize: 'landscape',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            }
        ]
    },
    {
        id: 'editing',
        label: '图片修改',
        description: '换背景、清理、改文字与延展画面',
        icon: 'Pencil',
        prompts: [
            {
                id: 'replace-background',
                title: '更换背景',
                description: '先说明新背景，再明确主体保留要求。',
                mode: 'edit',
                tags: ['背景', '主体保留'],
                keywords: ['background', '换背景', '产品图'],
                fields: [
                    field('background', '新的背景', '纯白背景，底部保留轻微接触阴影。'),
                    field('preserve', '需要保持的主体特征', '主体轮廓、颜色、材质、文字和摆放角度。', false)
                ],
                task: '为原图更换指定背景，同时保留主体。',
                composition: '处理自然的边缘过渡、接触阴影和光线匹配，不让背景侵入主体。',
                constraints: [...faithfulEdit, '不改变产品标志、人物身份特征或已有文字。'],
                recommendedSize: 'auto',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            },
            {
                id: 'remove-object',
                title: '移除与清理',
                description: '明确位置和对象，避免误改其他区域。',
                mode: 'edit',
                tags: ['清理', '移除', '局部修改'],
                keywords: ['remove', 'cleanup', '去除'],
                fields: [
                    field('changes', '要移除的对象与位置', '移除画面右下角桌面上的纸杯。'),
                    field('fill', '希望如何补全该区域', '自然延续周围的木桌纹理与光照。', false),
                    field('preserve', '不得改变的内容', '桌面上的书本与台灯，以及画面整体构图。', false)
                ],
                task: '仅移除原图中明确指定的对象，并自然修补该区域。',
                composition: '参考周围纹理、透视和光线补全，不新增无关物体。',
                constraints: faithfulEdit,
                recommendedSize: 'auto',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            },
            {
                id: 'restyle-image',
                title: '风格与配色调整',
                description: '保留画面内容，调整材质感和视觉风格。',
                mode: 'edit',
                tags: ['风格', '配色', '构图保留'],
                keywords: ['restyle', 'style', '调色'],
                fields: [
                    field('style', '目标风格或配色', '柔和水彩风格，降低饱和度，增加纸张肌理。'),
                    field('preserve', '必须保留的内容', '原有主体、动作、位置关系和所有文字。', false)
                ],
                task: '按指定方向调整原图的视觉风格。',
                composition: '风格变化在整张图中一致，保留主要形态和可辨识细节。',
                constraints: [...faithfulEdit, '除非明确要求，不改变画面中对象的数量或结构。'],
                recommendedSize: 'auto',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            },
            {
                id: 'replace-text',
                title: '定点替换文字',
                description: '给出位置与新文案，保留其他设计元素。',
                mode: 'edit',
                tags: ['文字', '替换', '海报修订'],
                keywords: ['text', '文字修改', '改字'],
                fields: [
                    field('changes', '位置、原文与新文案', '顶部标题：“夏日活动”改为“秋日相聚”。', true, 'copy'),
                    field('style', '字体或排版要求', '保持原字体风格和居中对齐，新文字完整可读。', false)
                ],
                task: '按照替换清单修改原图中的文字。',
                composition: '匹配周围字号、字重、颜色和透视；新文案较长时合理安排空间。',
                constraints: [...faithfulEdit, '新文案逐字准确，未列出的文字、标志和数字保持原样。'],
                recommendedSize: 'auto',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            },
            {
                id: 'extend-scene',
                title: '延展画面',
                description: '说明延展方向和新增区域内容。',
                mode: 'edit',
                tags: ['延展', '构图', '背景补全'],
                keywords: ['outpaint', 'extend', '扩图'],
                fields: [
                    field('direction', '延展方向与用途', '向左右延展为横向画面，用作文章头图。'),
                    field('fill', '新增区域的内容', '延续原有天空、远山和草地，保持自然过渡。'),
                    field('preserve', '原图中需要保持的部分', '人物的大小、位置和外观。', false)
                ],
                task: '依据指定方向自然延展原图场景。',
                composition: '新增区域的透视、纹理和光照与原图一致；主体保持完整，避免拉伸或机械镜像。',
                constraints: [...faithfulEdit, '不通过重复复制主体或扭曲原有画面来填满空间。'],
                note: '请同时在画面尺寸中选择目标比例，具体延展效果取决于所用模型。',
                recommendedSize: 'landscape',
                recommendedQuality: 'high',
                recommendedOutputFormat: 'png'
            }
        ]
    }
];
