import { createReadStream } from 'node:fs'
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises'
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

function containsHan(value) {
  return /[\u3400-\u9FFF]/u.test(value)
}

const PART_OF_SPEECH_ALIASES = {
  'n': 'n.',
  'n.': 'n.',
  'noun': 'n.',
  'v': 'v.',
  'v.': 'v.',
  'verb': 'v.',
  'adj': 'adj.',
  'adj.': 'adj.',
  'adjective': 'adj.',
  'adv': 'adv.',
  'adv.': 'adv.',
  'adverb': 'adv.',
  'pron': 'pron.',
  'pron.': 'pron.',
  'pronoun': 'pron.',
  'prep': 'prep.',
  'prep.': 'prep.',
  'preposition': 'prep.',
  'conj': 'conj.',
  'conj.': 'conj.',
  'conjunction': 'conj.',
  'interj': 'interj.',
  'interj.': 'interj.',
  'interjection': 'interj.',
  'det': 'det.',
  'det.': 'det.',
  'determiner': 'det.',
  'aux': 'aux.',
  'aux.': 'aux.',
  'auxiliary': 'aux.',
  'modal v': 'modal v.',
  'modal v.': 'modal v.',
  'modal verb': 'modal v.',
  'phr v': 'phr. v.',
  'phr. v.': 'phr. v.',
  'phrasal verb': 'phr. v.',
  'phr': 'phr.',
  'phr.': 'phr.',
  'phrase': 'phr.',
}

function normalizePartOfSpeech(value) {
  const normalized = asText(value).toLocaleLowerCase().replace(/\s+/g, ' ')
  return PART_OF_SPEECH_ALIASES[normalized] || ''
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

function mergeSense(word, definition) {
  const pos = normalizePartOfSpeech(definition?.pos)
  const meaningZh = asText(definition?.zh)
  if (!pos || !meaningZh)
    return
  const id = `sense-${stableHash({ wordKey: word.wordKey, pos, meaningZh })}`
  const existing = word.senses.find(sense => sense.id === id)
  const examples = unique([...(existing?.examples || []), definition?.ex])
  const next = {
    id,
    pos,
    meaningZh,
    examples,
  }
  if (existing)
    Object.assign(existing, next)
  else word.senses.push(next)
}

function upsertWord(words, item) {
  if (!item || typeof item !== 'object' || !Array.isArray(item.definitions))
    return null
  const wordKey = normalizeWordKey(item.word)
  if (!wordKey || !asText(item.word))
    return null
  const word = words.get(wordKey) || {
    wordKey,
    word: asText(item.word),
    senses: [],
  }
  for (const definition of item.definitions)
    mergeSense(word, definition)
  if (!word.senses.length)
    return null
  words.set(wordKey, word)
  return wordKey
}

function questionWordKey(raw) {
  return normalizeWordKey(typeof raw?.word === 'string' ? raw.word : '')
}

function answerIndex(raw, options) {
  return Number.isInteger(raw?.answerIndex) && raw.answerIndex >= 0 && raw.answerIndex < options.length
    ? raw.answerIndex
    : -1
}

function senseIdFor(words, wordKey, raw) {
  const word = words.get(wordKey)
  if (!word)
    return undefined
  const pos = normalizePartOfSpeech(raw?.pos)
  return pos ? word.senses.find(sense => sense.pos === pos)?.id : undefined
}

function normalizeChild(raw, words, sourceId) {
  const prompt = asText(raw?.stem)
  const wordKey = questionWordKey(raw)
  const senseId = senseIdFor(words, wordKey, raw)
  const options = Array.isArray(raw?.options) ? raw.options.map(asText).filter(Boolean) : []
  const index = answerIndex(raw, options)
  if (!prompt || options.length !== 4 || index < 0 || !wordKey || !senseId || containsHan(prompt) || options.some(containsHan))
    return null
  const questionStyle = prompt.includes('_____') ? 'fillBlank' : 'standard'
  const difficulty = raw?.difficulty
  if (difficulty !== 1 && difficulty !== 2 && difficulty !== 3)
    return null
  return {
    id: `question-${stableHash({ sourceId, wordKey, senseId, questionStyle, difficulty, prompt, options, index })}`,
    kind: 'multipleChoice',
    questionStyle,
    difficulty,
    prompt,
    options,
    answerIndex: index,
    wordKey,
    senseId,
  }
}

function toReadingChild(question) {
  return {
    id: question.id,
    kind: 'multipleChoice',
    prompt: question.prompt,
    options: question.options,
    answerIndex: question.answerIndex,
    wordKey: question.wordKey,
    senseId: question.senseId,
  }
}

function normalizeQuestion(raw, index, words) {
  const sourceId = `${index}-${stableHash(raw)}`
  const type = asText(raw?.type).toLocaleLowerCase()
  const passage = asText(raw?.passage)
  const difficulty = raw?.difficulty
  if (difficulty !== 1 && difficulty !== 2 && difficulty !== 3)
    return null
  const isReading = Boolean(passage && type === 'comprehension')
  if (isReading) {
    if (!Array.isArray(raw.questions))
      return null
    const rawChildren = raw.questions
    const questions = rawChildren.map(child => normalizeChild(child, words, sourceId)).filter(Boolean).map(toReadingChild)
    if (!questions.length)
      return null
    const wordKeys = unique([...(Array.isArray(raw.wordKeys) ? raw.wordKeys : []), ...questions.map(child => child.wordKey)])
      .map(normalizeWordKey)
      .filter(Boolean)
    const title = asText(raw.title)
    if (!wordKeys.length || !wordKeys.every(wordKey => words.has(wordKey)) || !title)
      return null
    return {
      id: `reading-${sourceId}`,
      kind: 'reading',
      difficulty,
      title,
      passage,
      wordKeys,
      questions,
    }
  }

  const child = normalizeChild(raw, words, sourceId)
  if (!child)
    return null
  return {
    id: `question-${sourceId}`,
    ...child,
  }
}

function questionFingerprint(question) {
  if (question.kind === 'reading') {
    return `fingerprint-${stableHash({
      kind: 'reading',
      difficulty: question.difficulty,
      explanation: question.explanation,
      title: question.title,
      passage: question.passage,
      wordKeys: question.wordKeys,
      questions: question.questions.map(({ id: _id, ...child }) => child),
    })}`
  }
  return `fingerprint-${stableHash({
    kind: 'multipleChoice',
    wordKey: question.wordKey,
    senseId: question.senseId,
    difficulty: question.difficulty,
    questionStyle: question.questionStyle,
    prompt: question.prompt,
    options: question.options,
    answerIndex: question.answerIndex,
    explanation: question.explanation,
    trap: question.trap,
    whyWrong: question.whyWrong,
  })}`
}

function finalizeQuestion(question, generatedAt) {
  return {
    ...question,
    fingerprint: questionFingerprint(question),
    createdAt: generatedAt,
    updatedAt: generatedAt,
  }
}

function chunk(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))
}

async function clearJsonFiles(directory) {
  const files = await readdir(directory)
  await Promise.all(files
    .filter(file => file.endsWith('.json'))
    .map(file => unlink(join(directory, file))))
}

async function main() {
  const generatedAt = new Date().toISOString()
  const files = (await readdir(INPUT_DIR)).filter(file => file.endsWith('.json'))
  const levelFiles = files.filter(file => /^level-\d+\.json$/i.test(file)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const questionFile = files.find(file => file.toLowerCase() === 'questions.json')
  const words = new Map()
  const stats = { levelItems: 0, uniqueWords: 0, supportedQuestions: { standard: 0, fillBlank: 0, reading: 0 }, skippedQuestions: 0 }

  for (const file of levelFiles) {
    await streamJsonArray(join(INPUT_DIR, file), (item) => {
      stats.levelItems += 1
      upsertWord(words, item)
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
      const finalized = finalizeQuestion(question, generatedAt)
      supportedQuestions.push(finalized)
      stats.supportedQuestions[finalized.kind === 'reading' ? 'reading' : finalized.questionStyle] += 1
    })
  }

  const wordList = Array.from(words.values()).map(word => ({ ...word, updatedAt: generatedAt }))
  stats.uniqueWords = wordList.length
  const wordChunks = chunk(wordList, WORD_BATCH_SIZE)
  const vocabOutputDir = join(OUTPUT_DIR, 'vocab')
  const questionOutputDir = join(OUTPUT_DIR, 'questions')
  await mkdir(vocabOutputDir, { recursive: true })
  await mkdir(questionOutputDir, { recursive: true })
  await clearJsonFiles(vocabOutputDir)
  await clearJsonFiles(questionOutputDir)

  const manifest = { schemaVersion: 1, generatedAt, wordBatchSize: WORD_BATCH_SIZE, stats, files: { vocab: [], questions: [] } }
  for (let index = 0; index < wordChunks.length; index += 1) {
    const batch = index + 1
    const wordBatch = wordChunks[index]
    const fileName = `vocab-${String(batch).padStart(3, '0')}.json`
    await writeFile(join(vocabOutputDir, fileName), JSON.stringify({ schemaVersion: 1, kind: 'words', batch, words: wordBatch }, null, 2), 'utf8')
    manifest.files.vocab.push(fileName)
  }

  const types = ['standard', 'fillBlank', 'reading']
  for (const kind of types) {
    const matching = supportedQuestions.filter(question => (kind === 'reading' ? question.kind === 'reading' : question.kind === 'multipleChoice' && question.questionStyle === kind) && (kind === 'reading'
      ? question.wordKeys.length > 0 && question.wordKeys.every(wordKey => words.has(wordKey))
      : Boolean(question.wordKey && words.has(question.wordKey))))
    const questionChunks = chunk(matching, 120)
    for (let index = 0; index < questionChunks.length; index += 1) {
      const fileName = `${kind}-${String(index + 1).padStart(3, '0')}.json`
      await writeFile(join(questionOutputDir, fileName), JSON.stringify({ schemaVersion: 1, kind: 'questions', questions: questionChunks[index] }, null, 2), 'utf8')
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
