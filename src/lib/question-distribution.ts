export type DailyQuestionQuotas = [standard: number, fillBlank: number, reading: number]

export function allocateDailyQuestionQuotas(target: number): DailyQuestionQuotas {
  const total = Math.max(0, Math.floor(target))
  const weights = [0.4, 0.4, 0.2]
  const quotas = weights.map(weight => Math.floor(total * weight))
  let remaining = total - quotas.reduce((sum, quota) => sum + quota, 0)
  const order = weights
    .map((weight, index) => ({ index, remainder: total * weight - quotas[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  for (let index = 0; index < order.length && remaining > 0; index += 1) {
    quotas[order[index].index] += 1
    remaining -= 1
  }

  return quotas as DailyQuestionQuotas
}
