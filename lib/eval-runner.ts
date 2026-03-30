export const DEFAULT_JUDGE_PROMPTS: Record<string, string> = {
  instruction_following: `You are an expert AI evaluator. Your task is to evaluate how well an AI output follows the instructions given in the system prompt.

System Prompt: {{systemPrompt}}

User Input: {{input}}

AI Output: {{output}}

Evaluate how well the output follows the system prompt instructions. Consider:
- Does the output adhere to the tone, format, and style specified?
- Does it follow any explicit rules or constraints in the system prompt?
- Does it avoid doing things prohibited by the system prompt?

Return ONLY a JSON object with this exact format, nothing else:
{"score": <0-100>, "reasoning": "<brief explanation>"}`,

  output_quality: `You are an expert AI evaluator. Your task is to evaluate the overall quality of an AI output.

System Prompt: {{systemPrompt}}

User Input: {{input}}

AI Output: {{output}}

Evaluate the quality of the output based on:
- Coherence: Is the response logically structured and easy to follow?
- Completeness: Does it fully address what was asked?
- Professionalism: Is the writing clear, well-structured, and appropriate?

Return ONLY a JSON object with this exact format, nothing else:
{"score": <0-100>, "reasoning": "<brief explanation>"}`,

  relevance: `You are an expert AI evaluator. Your task is to evaluate how relevant an AI output is to the user's input.

System Prompt: {{systemPrompt}}

User Input: {{input}}

AI Output: {{output}}

Evaluate how relevant the output is to the user's input:
- Does it directly address what the user asked?
- Is the information provided on-topic and useful?
- Does it avoid irrelevant tangents or off-topic content?

Return ONLY a JSON object with this exact format, nothing else:
{"score": <0-100>, "reasoning": "<brief explanation>"}`,
}

export interface EvalInput {
  input: string
  output: string
  systemPrompt: string
}

export interface EvalResult {
  scorerName: string
  score: number
  reasoning: string
  error?: string
}

export async function runEval(
  scorerName: string,
  evalInput: EvalInput,
  judgeModel?: string,
  customJudgePrompt?: string
): Promise<EvalResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      scorerName,
      score: 0,
      reasoning: "",
      error: "ANTHROPIC_API_KEY is not set",
    }
  }

  const promptTemplate = customJudgePrompt ?? DEFAULT_JUDGE_PROMPTS[scorerName]
  if (!promptTemplate) {
    return {
      scorerName,
      score: 0,
      reasoning: "",
      error: `No judge prompt found for scorer: ${scorerName}`,
    }
  }

  const filledPrompt = promptTemplate
    .replace(/\{\{input\}\}/g, evalInput.input)
    .replace(/\{\{output\}\}/g, evalInput.output)
    .replace(/\{\{systemPrompt\}\}/g, evalInput.systemPrompt)

  const model = judgeModel ?? "claude-sonnet-4-6-20250514"

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: filledPrompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        scorerName,
        score: 0,
        reasoning: "",
        error: `Anthropic API error ${response.status}: ${errorText}`,
      }
    }

    const data = await response.json()
    const content = data?.content?.[0]?.text ?? ""

    // Extract JSON from the response (may be wrapped in markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return {
        scorerName,
        score: 0,
        reasoning: "",
        error: `Could not parse JSON from judge response: ${content}`,
      }
    }

    const parsed = JSON.parse(jsonMatch[0])
    const score = Math.min(100, Math.max(0, Math.round(Number(parsed.score))))
    const reasoning = String(parsed.reasoning ?? "")

    return { scorerName, score, reasoning }
  } catch (err) {
    return {
      scorerName,
      score: 0,
      reasoning: "",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
