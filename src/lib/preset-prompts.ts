import type { ImageMode, ImageSettings } from './image-settings';
import { templateCategories } from './prompt-template-data';

export type PromptField = {
    id: string;
    label: string;
    example: string;
    placeholder?: string;
    required?: boolean;
    kind?: 'text' | 'copy';
};

export type PromptTemplateSource = {
    id: string;
    title: string;
    description: string;
    mode: ImageMode;
    tags: string[];
    keywords?: string[];
    fields: PromptField[];
    task: string;
    composition: string;
    constraints: string[];
    note?: string;
    emptyFieldRule?: { field: string; instruction: string };
    recommendedSize?: Exclude<ImageSettings['size'], 'custom'>;
    recommendedQuality?: ImageSettings['quality'];
    recommendedOutputFormat?: ImageSettings['output_format'];
};

export type PromptTemplate = PromptTemplateSource & {
    text: string;
    categoryId: string;
    categoryLabel: string;
    useCases: ImageMode[];
};
export type PromptCategorySource = {
    id: string;
    label: string;
    description: string;
    icon: string;
    prompts: PromptTemplateSource[];
};
export type PromptCategory = Omit<PromptCategorySource, 'prompts'> & { prompts: PromptTemplate[] };

export const presetPromptCategories: PromptCategory[] = templateCategories.map((category) => ({
    ...category,
    prompts: category.prompts.map((template) => ({
        ...template,
        categoryId: category.id,
        categoryLabel: category.label,
        useCases: [template.mode],
        text: [
            template.task,
            ...template.fields.map((field) => `${field.label}：{{${field.id}}}`),
            `画面要求：${template.composition}`
        ].join('\n')
    }))
}));

export const academicPromptCategory = presetPromptCategories.find((category) => category.id === 'academic')!;
export const allPromptTemplates = presetPromptCategories.flatMap((category) => category.prompts);

export function getPromptCategoriesForMode(mode: ImageMode): PromptCategory[] {
    return presetPromptCategories
        .map((category) => ({
            ...category,
            prompts: category.prompts.filter((template) => template.useCases.includes(mode))
        }))
        .filter((category) => category.prompts.length > 0);
}

export function getAcademicPromptsForMode(mode: ImageMode): PromptTemplate[] {
    return academicPromptCategory.prompts.filter((template) => template.useCases.includes(mode));
}

export function getAllPresetPrompts(): { title: string; text: string; categoryLabel: string }[] {
    return allPromptTemplates.map(({ title, text, categoryLabel }) => ({ title, text, categoryLabel }));
}

export function findPromptTemplates(mode: ImageMode, query = '', categoryId = 'all'): PromptTemplate[] {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return allPromptTemplates.filter((template) => {
        if (!template.useCases.includes(mode) || (categoryId !== 'all' && template.categoryId !== categoryId))
            return false;
        const searchable = [
            template.title,
            template.description,
            template.categoryLabel,
            ...template.tags,
            ...(template.keywords || [])
        ]
            .join(' ')
            .toLocaleLowerCase();
        return terms.every((term) => searchable.includes(term));
    });
}
