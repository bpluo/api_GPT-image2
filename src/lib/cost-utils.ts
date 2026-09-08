export type ApiUsage = {
    input_tokens_details?: {
        text_tokens?: number;
        image_tokens?: number;
    };
    output_tokens?: number;
};

export type CostDetails = {
    estimated_cost_usd: number;
    text_input_tokens: number;
    image_input_tokens: number;
    image_output_tokens: number;
};

// Pricing for gpt-image-1
const GPT_IMAGE_1_TEXT_INPUT_COST_PER_TOKEN = 0.000005; // $5.00/1M
const GPT_IMAGE_1_IMAGE_INPUT_COST_PER_TOKEN = 0.00001; // $10.00/1M
const GPT_IMAGE_1_IMAGE_OUTPUT_COST_PER_TOKEN = 0.00004; // $40.00/1M

// Pricing for gpt-image-1-mini
const GPT_IMAGE_1_MINI_TEXT_INPUT_COST_PER_TOKEN = 0.000002; // $2.00/1M
const GPT_IMAGE_1_MINI_IMAGE_INPUT_COST_PER_TOKEN = 0.0000025; // $2.50/1M
const GPT_IMAGE_1_MINI_IMAGE_OUTPUT_COST_PER_TOKEN = 0.000008; // $8.00/1M

// Pricing for gpt-image-1.5
const GPT_IMAGE_1_5_TEXT_INPUT_COST_PER_TOKEN = 0.000005; // $5.00/1M
const GPT_IMAGE_1_5_IMAGE_INPUT_COST_PER_TOKEN = 0.000008; // $8.00/1M
const GPT_IMAGE_1_5_IMAGE_OUTPUT_COST_PER_TOKEN = 0.000032; // $32.00/1M

// Pricing for gpt-image-2
const GPT_IMAGE_2_TEXT_INPUT_COST_PER_TOKEN = 0.000005; // $5.00/1M
const GPT_IMAGE_2_IMAGE_INPUT_COST_PER_TOKEN = 0.000008; // $8.00/1M
const GPT_IMAGE_2_IMAGE_OUTPUT_COST_PER_TOKEN = 0.00003; // $30.00/1M

// gpt-image-1/2 series plus relay-station models (pie-xian's agnes series, gwlink's 4K variant).
// Relay models fall back to gpt-image-1 rates below — actual billing is decided by the station.
export type GptImageModel =
    | 'gpt-image-1'
    | 'gpt-image-1-mini'
    | 'gpt-image-1.5'
    | 'gpt-image-2'
    | 'gpt-image-2-高质量4k'
    | 'agnes-image-2.5-flash'
    | 'agnes-image-2.1-flash';

export type ModelRates = {
    textInputPerToken: number;
    imageInputPerToken: number;
    imageOutputPerToken: number;
    textInputPerMillion: number;
    imageInputPerMillion: number;
    imageOutputPerMillion: number;
};

export function getModelRates(model: GptImageModel): ModelRates {
    if (model === 'gpt-image-1-mini') {
        return {
            textInputPerToken: GPT_IMAGE_1_MINI_TEXT_INPUT_COST_PER_TOKEN,
            imageInputPerToken: GPT_IMAGE_1_MINI_IMAGE_INPUT_COST_PER_TOKEN,
            imageOutputPerToken: GPT_IMAGE_1_MINI_IMAGE_OUTPUT_COST_PER_TOKEN,
            textInputPerMillion: 2,
            imageInputPerMillion: 2.5,
            imageOutputPerMillion: 8
        };
    }
    if (model === 'gpt-image-1.5') {
        return {
            textInputPerToken: GPT_IMAGE_1_5_TEXT_INPUT_COST_PER_TOKEN,
            imageInputPerToken: GPT_IMAGE_1_5_IMAGE_INPUT_COST_PER_TOKEN,
            imageOutputPerToken: GPT_IMAGE_1_5_IMAGE_OUTPUT_COST_PER_TOKEN,
            textInputPerMillion: 5,
            imageInputPerMillion: 8,
            imageOutputPerMillion: 32
        };
    }
    if (model === 'gpt-image-2') {
        return {
            textInputPerToken: GPT_IMAGE_2_TEXT_INPUT_COST_PER_TOKEN,
            imageInputPerToken: GPT_IMAGE_2_IMAGE_INPUT_COST_PER_TOKEN,
            imageOutputPerToken: GPT_IMAGE_2_IMAGE_OUTPUT_COST_PER_TOKEN,
            textInputPerMillion: 5,
            imageInputPerMillion: 8,
            imageOutputPerMillion: 30
        };
    }
    return {
        textInputPerToken: GPT_IMAGE_1_TEXT_INPUT_COST_PER_TOKEN,
        imageInputPerToken: GPT_IMAGE_1_IMAGE_INPUT_COST_PER_TOKEN,
        imageOutputPerToken: GPT_IMAGE_1_IMAGE_OUTPUT_COST_PER_TOKEN,
        textInputPerMillion: 5,
        imageInputPerMillion: 10,
        imageOutputPerMillion: 40
    };
}

/**
 * Estimates the cost of a GPT image model API call based on token usage.
 * @param usage - The usage object from the OpenAI API response.
 * @param model - The model used.
 * @returns CostDetails object or null if usage data is invalid.
 */
export function calculateApiCost(
    usage: ApiUsage | undefined | null,
    model: GptImageModel = 'gpt-image-2'
): CostDetails | null {
    if (!['gpt-image-1', 'gpt-image-1-mini', 'gpt-image-1.5', 'gpt-image-2'].includes(model)) return null;
    if (!usage?.input_tokens_details || usage.output_tokens === undefined || usage.output_tokens === null) return null;
    const text = usage.input_tokens_details.text_tokens ?? 0;
    const image = usage.input_tokens_details.image_tokens ?? 0;
    const output = usage.output_tokens;
    if ([text, image, output].some((tokens) => typeof tokens !== 'number' || !Number.isFinite(tokens) || tokens < 0))
        return null;
    const rates = getModelRates(model);
    return {
        estimated_cost_usd:
            Math.round(
                (text * rates.textInputPerToken +
                    image * rates.imageInputPerToken +
                    output * rates.imageOutputPerToken) *
                    10000
            ) / 10000,
        text_input_tokens: text,
        image_input_tokens: image,
        image_output_tokens: output
    };
}
