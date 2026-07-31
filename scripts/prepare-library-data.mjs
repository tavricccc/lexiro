import { createReadStream } from 'node:fs'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const INPUT_DIR = process.env.LEXIRO_INPUT_DIR || 'C:\\temp'
const OUTPUT_DIR = process.env.LEXIRO_OUTPUT_DIR || join(process.cwd(), 'output')
const WORD_BATCH_SIZE = 30

function normalizeWordKey(value) {
  return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

function stableHash(value) {
  const input = JSON.stringify(value)
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function asText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function unique(values) {
  const seen = new Set()
  return values.map(asText).filter(Boolean).filter((value) => {
    const key = value.toLocaleLowerCase()
    if (seen.has(key))
      return false
    seen.add(key)
    return true
  })
}

async function streamJsonArray(filePath, onItem) {
  let buffer = ''
  let started = false
  let ended = false
  for await (const chunk of createReadStream(filePath, { encoding: 'utf8' })) {
    buffer += chunk
    while (true) {
      if (!started) {
        const arrayStart = buffer.indexOf('[')
        if (arrayStart < 0) {
          buffer = buffer.slice(-1)
          break
        }
        buffer = buffer.slice(arrayStart + 1)
        started = true
      }

      buffer = buffer.replace(/^\s*,?\s*/, '')
      if (buffer.startsWith(']')) {
        ended = true
        break
      }
      if (!buffer.startsWith('{'))
        break

      let depth = 0
      let inString = false
      let escaped = false
      let end = -1
      for (let index = 0; index < buffer.length; index += 1) {
        const char = buffer[index]
        if (inString) {
          if (escaped)
            escaped = false
          else if (char === '\\')
            escaped = true
          else if (char === '"')
            inString = false
          continue
        }
        if (char === '"') {
          inString = true
          continue
        }
        if (char === '{')
          depth += 1
        if (char === '}') {
          depth -= 1
          if (depth === 0) {
            end = index + 1
            break
          }
        }
      }
      if (end < 0)
        break

      const raw = buffer.slice(0, end)
      buffer = buffer.slice(end)
      await onItem(JSON.parse(raw))
    }
    if (ended)
      break
  }
  if (!ended)
    throw new Error(`${filePath} 不是完整的 JSON 陣列`)
}

function mergeSense(word, definition, fallback, sourceFile) {
  const pos = asText(definition?.pos || fallback.pos)
  const meaningZh = asText(definition?.zh || fallback.zh)
  if (!pos || !meaningZh)
    return
  const id = `sense-${stableHash({ wordKey: word.wordKey, pos: pos.toLocaleLowerCase(), meaningZh })}`
  const existing = word.senses.find(sense => sense.id === id)
  const examples = unique([...(existing?.examples || []), definition?.ex, fallback.example])
  const next = {
    id,
    pos,
    meaningZh,
    definitionEn: asText(definition?.def || fallback.definition) || undefined,
    examples,
    source: 'import',
    sourceFiles: unique([...(existing?.sourceFiles || []), sourceFile]),
  }
  if (existing)
    Object.assign(existing, next)
  else word.senses.push(next)
}

function upsertWord(words, item, sourceFile, level) {
  const wordKey = normalizeWordKey(item?.word)
  if (!wordKey)
    return null
  const word = words.get(wordKey) || {
    wordKey,
    word: asText(item.word),
    senses: [],
    synonyms: [],
    antonyms: [],
    metadata: { levels: [], cefr: asText(item.cefr), exams: item.exams || [], textbook: Boolean(item.textbook), textbookLabel: asText(item.textbookLabel), textbookTitle: asText(item.textbookTitle) },
  }
  word.metadata.levels = unique([...(word.metadata.levels || []), String(level)])
  if (item.cefr && !word.metadata.cefr)
    word.metadata.cefr = item.cefr
  for (const definition of Array.isArray(item.definitions) ? item.definitions : [item])
    mergeSense(word, definition, item, sourceFile)
  words.set(wordKey, word)
  return wordKey
}

function questionWordKey(raw) {
  return normalizeWordKey(raw?.word)
}

function answerIndex(raw, options) {
  if (Number.isInteger(raw?.answerIndex) && raw.answerIndex >= 0 && raw.answerIndex < options.length)
    return raw.answerIndex
  const answer = asText(raw?.answer)
  const index = options.findIndex(option => option === answer)
  return index >= 0 ? index : -1
}

function senseIdFor(words, wordKey, raw) {
  const word = words.get(wordKey)
  if (!word)
    return undefined
  const pos = asText(raw?.pos)
  return word.senses.find(sense => !pos || sense.pos.toLocaleLowerCase() === pos.toLocaleLowerCase())?.id || word.senses[0]?.id
}

function normalizeChild(raw, words, sourceId) {
  const prompt = asText(raw?.stem || raw?.prompt || raw?.question)
  const wordKey = questionWordKey(raw)
  const senseId = senseIdFor(words, wordKey, raw)
  const options = Array.isArray(raw?.options) ? raw.options.map(asText).filter(Boolean) : []
  const index = answerIndex(raw, options)
  if (options.length === 4 && index >= 0) {
    return {
      id: `child-${stableHash({ sourceId, prompt, options, index })}`,
      kind: 'multipleChoice',
      prompt,
      options,
      answerIndex: index,
      wordKey: wordKey || undefined,
      senseId,
    }
  }
  const answers = Array.isArray(raw?.answers) ? raw.answers.map(asText).filter(Boolean) : unique([raw?.answer, raw?.answer_zh])
  if (prompt && answers.length) {
    return {
      id: `child-${stableHash({ sourceId, prompt, answers })}`,
      kind: 'cloze',
      prompt,
      answers,
      options: options.length ? options : undefined,
      wordKey: wordKey || undefined,
      senseId,
    }
  }
  return null
}

function normalizeQuestion(raw, index, words) {
  const sourceId = `${index}-${stableHash(raw)}`
  const type = asText(raw?.type).toLocaleLowerCase()
  const passage = asText(raw?.passage || raw?.context || raw?.text)
  const isReading = Boolean(passage && (type.includes('comprehension') || Array.isArray(raw?.questions) || raw?.passage))
  if (isReading) {
    const rawChildren = Array.isArray(raw.questions) ? raw.questions : [raw]
    const questions = rawChildren.map(child => normalizeChild(child, words, sourceId)).filter(Boolean)
    if (!questions.length)
      return null
    const wordKeys = unique([raw.word, ...(raw.words || []), ...questions.map(child => child.wordKey)])
      .map(normalizeWordKey)
      .filter(Boolean)
    return {
      id: `reading-${sourceId}`,
      kind: 'reading',
      title: asText(raw.title || raw.topic) || `Reading ${index + 1}`,
      passage,
      wordKeys,
      questions,
      source: 'import',
      sourceType: type || 'reading',
    }
  }

  const child = normalizeChild(raw, words, sourceId)
  if (!child)
    return null
  return {
    id: `question-${sourceId}`,
    ...child,
    source: 'import',
    sourceType: type || child.kind,
  }
}

function chunk(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))
}

async function main() {
  const files = (await readdir(INPUT_DIR)).filter(file => file.endsWith('.json'))
  const levelFiles = files.filter(file => /^level-\d+\.json$/i.test(file)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const questionFile = files.find(file => file.toLowerCase() === 'questions.json')
  const words = new Map()
  const stats = { levelItems: 0, uniqueWords: 0, supportedQuestions: { multipleChoice: 0, cloze: 0, reading: 0 }, skippedQuestions: 0 }

  for (const file of levelFiles) {
    const level = Number(file.match(/(\d+)/)?.[1] || 0)
    await streamJsonArray(join(INPUT_DIR, file), (item) => {
      stats.levelItems += 1
      upsertWord(words, item, file, level)
    })
  }

  const supportedQuestions = []
  if (questionFile) {
    let index = 0
    await streamJsonArray(join(INPUT_DIR, questionFile), (item) => {
      const question = normalizeQuestion(item, index, words)
      index += 1
      if (!question) {
        stats.skippedQuestions += 1
        return
      }
      supportedQuestions.push(question)
      stats.supportedQuestions[question.kind] += 1
    })
  }

  const wordList = Array.from(words.values()).map(word => ({ ...word, updatedAt: new Date().toISOString() }))
  stats.uniqueWords = wordList.length
  const wordChunks = chunk(wordList, WORD_BATCH_SIZE)
  await mkdir(join(OUTPUT_DIR, 'vocab'), { recursive: true })
  await mkdir(join(OUTPUT_DIR, 'questions'), { recursive: true })

  const manifest = { schemaVersion: 1, generatedAt: new Date().toISOString(), inputDir: INPUT_DIR, wordBatchSize: WORD_BATCH_SIZE, stats, files: { vocab: [], questions: [] } }
  for (let index = 0; index < wordChunks.length; index += 1) {
    const batch = index + 1
    const wordBatch = wordChunks[index]
    const fileName = `vocab-${String(batch).padStart(3, '0')}.json`
    await writeFile(join(OUTPUT_DIR, 'vocab', fileName), JSON.stringify({ schemaVersion: 1, kind: 'vocab', batch, words: wordBatch }, null, 2), 'utf8')
    manifest.files.vocab.push(fileName)
  }

  const types = ['multipleChoice', 'cloze', 'reading']
  for (const kind of types) {
    const matching = supportedQuestions.filter(question => question.kind === kind && (kind === 'reading'
      ? question.wordKeys.some(wordKey => words.has(wordKey)) || !question.wordKeys.length
      : Boolean(question.wordKey && words.has(question.wordKey))))
    const questionChunks = chunk(matching, 120)
    for (let index = 0; index < questionChunks.length; index += 1) {
      const fileName = `${kind}-${String(index + 1).padStart(3, '0')}.json`
      await writeFile(join(OUTPUT_DIR, 'questions', fileName), JSON.stringify({ schemaVersion: 1, kind: 'questions', questionKind: kind, questions: questionChunks[index] }, null, 2), 'utf8')
      manifest.files.questions.push(fileName)
    }
  }
  await writeFile(join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  console.log(JSON.stringify(manifest.stats))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
