import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dirname, '..')
const source = join(root, 'src')
const warnings = []
const failures = []

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      visit(path)
      continue
    }
    if (!entry.name.endsWith('.vue'))
      continue
    const lines = readFileSync(path, 'utf8').split(/\r?\n/).length
    const item = `${relative(root, path)}: ${lines} lines`
    if (lines > 400)
      failures.push(item)
    else if (lines >= 350)
      warnings.push(item)
  }
}

visit(source)
for (const warning of warnings)
  console.warn(`[component-size warning] ${warning}`)
if (failures.length) {
  for (const failure of failures)
    console.error(`[component-size error] ${failure}`)
  process.exitCode = 1
}
