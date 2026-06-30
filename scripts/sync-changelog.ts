/**
 * Regenerates docs/features.md from git history.
 *
 * Run with: pnpm sync:changelog
 *
 * The changelog is a build artifact — never hand-edit it. The script pulls
 * every merge commit on develop in chronological order, parses the PR number
 * from the merge commit subject (`Merge pull request #N from ...`), looks up
 * the PR's title, files, and diff stats, and emits the file in the same
 * format that's used in the existing entries.
 *
 * Pre-PR commits (the three initial commits from before the PR convention)
 * are detected by their author date and emitted in their original style.
 */

import { execSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(__dirname, '..')
const OUT = resolve(REPO_ROOT, 'docs/features.md')

interface MergeEntry {
  sha: string
  date: string
  prNumber: number | null
  prTitle: string
  files: string[]
  insertions: number
  deletions: number
}

function run(cmd: string): string {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' }).trim()
}

function parseMergeLog(format: string): string {
  return run(`git log origin3/develop --merges --first-parent --pretty=format:"${format}"`)
}

/**
 * Pull every merge on develop. Output per merge (tab-separated):
 *   sha \t isoDate \t subject
 */
function listMerges(): { sha: string; date: string; subject: string }[] {
  const raw = parseMergeLog('%H%x09%cI%x09%s')
  if (!raw) return []
  return raw.split('\n').map((line) => {
    const [sha, date, ...rest] = line.split('\t')
    return { sha, date, subject: rest.join('\t') }
  })
}

/**
 * Parse the PR number from a merge subject like:
 *   "Merge pull request #45 from webnxt-2030/issue-7-sawt-csv-format"
 */
function parsePrNumber(subject: string): number | null {
  const m = subject.match(/^Merge pull request #(\d+)\b/)
  return m ? Number(m[1]) : null
}

/**
 * Fetch the PR title via `gh`. Returns null if the PR can't be reached
 * (e.g. private fork, rate limit).
 */
function fetchPrTitle(prNumber: number): string {
  try {
    const raw = run(
      `gh pr view ${prNumber} --repo webnxt-2030/krunchr --json title --jq .title`
    )
    return raw
  } catch {
    return ''
  }
}

/**
 * For each merge, find the single feature commit (the only non-merge, non-docs
 * commit brought in by that merge) so we can list the files it touched.
 */
function featureCommitForMerge(mergeSha: string): { files: string[]; insertions: number; deletions: number } {
  // For squash-merge PRs, the merge commit's tree IS the result of the PR.
  // Diff the merge commit against its first parent (develop at the time of
  // merge) to get the full set of files + insertion/deletion counts brought
  // in by the PR. This sidesteps the docs(features) commit that typically
  // sits between the feature commit and the merge.
  const nameOnly = run(`git diff ${mergeSha}~1..${mergeSha} --name-only`)
  const files = nameOnly.split('\n').filter(Boolean).filter((f) => f !== mergeSha)

  const numstat = run(`git diff ${mergeSha}~1..${mergeSha} --numstat`)
  let insertions = 0
  let deletions = 0
  for (const line of numstat.split('\n').filter(Boolean)) {
    const m = line.match(/^(\d+)\s+(\d+)\s+/)
    if (!m) continue
    insertions += Number(m[1])
    deletions += Number(m[2])
  }

  return { files, insertions, deletions }
}

interface LegacyEntry {
  sha: string
  date: string
  subject: string
  files: string[]
}

/**
 * Detect the three pre-PR-convention commits (before any PR was opened on
 * the repo) so we can emit them in the original "Commit: <hash>" style.
 */
function legacyCommits(merges: MergeEntry[]): LegacyEntry[] {
  if (merges.length === 0) return []
  // The earliest merge's first parent is the develop tip right before any PR merged.
  const earliestMergeSha = merges[merges.length - 1].sha
  const baseSha = run(`git rev-parse ${earliestMergeSha}~1`).trim()

  const raw = run(
    `git log ${baseSha} --no-merges --pretty=format:"%H%x09%cI%x09%s" --reverse`
  )
  if (!raw) return []
  return raw.split('\n')
    .map((line) => {
      const [sha, date, ...rest] = line.split('\t')
      const subject = rest.join('\t')
      const nameOnly = run(`git show --name-only --format= ${sha}`)
      const files = nameOnly.split('\n').filter(Boolean).filter((f) => f !== sha)
      return { sha: sha.slice(0, 7), date, subject, files }
    })
    .filter((e) => {
      // Skip the docs(features) changelog commits — they describe the
      // changelog itself, not a shipped feature. The PR entries above
      // already cover everything they referenced.
      if (e.subject.startsWith('docs(features):')) return false
      // Skip commits that only touched docs/features.md (no shipped code).
      const shippedFiles = e.files.filter((f) => f !== 'docs/features.md')
      return shippedFiles.length > 0
    })
}

function formatDate(iso: string): string {
  return iso.slice(0, 10)
}

function formatPrTitleForEntry(prTitle: string): string {
  // Strip the conventional-commit prefix (and its optional scope like
  // "feat(sawt):"), any leading "Fix #N: " or "#N: " since the entry
  // header is already labeled with the PR number, and any trailing
  // "(#N)" tag. Collapse newlines to spaces.
  return prTitle
    .replace(/\s+/g, ' ')
    .replace(/^(fix|feat|chore|docs|refactor|test|perf|build|ci|style|revert)(\([^)]+\))?:?\s+/i, '')
    .replace(/^#\d+:?\s+/, '')
    .replace(/\s*\(\s*#\d+\s*\)\s*$/, '')
    .trim()
    || prTitle
}

function renderEntry(entry: MergeEntry): string {
  const date = formatDate(entry.date)
  const heading = entry.prNumber
    ? `### ${date} — PR #${entry.prNumber} — ${formatPrTitleForEntry(entry.prTitle)}`
    : `### ${date} — ${entry.prTitle}`
  const lines: string[] = [heading]
  lines.push(`- PR: \`#${entry.prNumber}\``)
  lines.push(`- What changed: ${entry.prTitle}.`)
  if (entry.files.length > 0) {
    const truncated = entry.files.slice(0, 12)
    const more = entry.files.length - truncated.length
    const suffix = more > 0 ? `, … (+${more} more)` : ''
    lines.push(`- Files touched: \`${truncated.join('\`, \`')}\`${suffix}`)
  }
  return lines.join('\n')
}

function renderLegacy(entry: LegacyEntry): string {
  const date = formatDate(entry.date)
  const lines: string[] = []
  lines.push(`### ${date} — ${entry.subject}`)
  lines.push(`- Commit: \`${entry.sha}\``)
  if (entry.files.length > 0) {
    const truncated = entry.files.slice(0, 8)
    const more = entry.files.length - truncated.length
    const suffix = more > 0 ? `, … (+${more} more)` : ''
    lines.push(`- Files touched: \`${truncated.join('\`, \`')}\`${suffix}`)
  }
  return lines.join('\n')
}

function render(merges: MergeEntry[], legacy: LegacyEntry[]): string {
  const header = [
    '# Features Log',
    '',
    '> **Auto-generated by `pnpm sync:changelog`** — do not hand-edit. After a PR',
    '> merges, run the script and commit the result. See `auto-dev.md` for the',
    '> workflow change that retired the hand-maintained version.',
    '',
    '## Format',
    '',
    'Each entry:',
    '',
    '```markdown',
    '### YYYY-MM-DD — PR #N — Short title',
    '- PR: `#N`',
    '- What changed: one-paragraph summary',
    '- Files touched: `path/to/file.ts`, `path/to/other.ts`',
    '```',
    '',
    '---',
    '',
    '## Entries',
    '',
  ].join('\n')

  // Merges are returned newest-first; we want oldest-first.
  const mergedOldestFirst = [...merges].reverse()
  const legacyOldestFirst = [...legacy].reverse()

  const blocks: string[] = []
  for (const l of legacyOldestFirst) blocks.push(renderLegacy(l))
  for (const m of mergedOldestFirst) blocks.push(renderEntry(m))

  return header + blocks.join('\n\n') + '\n'
}

function main() {
  console.log('> fetching merge history from develop…')
  const merges = listMerges().map((m) => {
    const prNumber = parsePrNumber(m.subject)
    const prTitle = prNumber ? fetchPrTitle(prNumber) : ''
    const feature = prNumber
      ? featureCommitForMerge(m.sha)
      : { files: [], insertions: 0, deletions: 0 }
    return {
      sha: m.sha,
      date: m.date,
      prNumber,
      prTitle: prTitle || m.subject,
      files: feature.files,
      insertions: feature.insertions,
      deletions: feature.deletions,
    }
  })

  const legacy = legacyCommits(merges)
  const out = render(merges, legacy)

  const existing = (() => {
    try { return readFileSync(OUT, 'utf8') } catch { return '' }
  })()

  if (out === existing) {
    console.log('> docs/features.md is already up to date — no changes written.')
    return
  }

  writeFileSync(OUT, out, 'utf8')
  console.log(`> wrote ${OUT}`)
  console.log(`> ${merges.length} PR entries + ${legacy.length} legacy entries`)
}

main()
