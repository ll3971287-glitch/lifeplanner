import fs from 'fs'
import path from 'path'

const OWNER = 'll3971287-glitch'
const REPO = 'lifeplanner'
const BRANCH = process.env.BRANCH || "gh-pages"
const DIST = process.env.HOME + '/workspace/lifeplanner/dist'
const API = 'https://api.github.com'

const cred = fs.readFileSync(process.env.HOME + '/.aicode/git-credentials', 'utf8')
const m = cred.match(/https:\/\/([^:\s]+):([^@\s]+)@github\.com/)
if (!m) { console.error('未找到 github.com 凭据'); process.exit(1) }
const TOKEN = m[2]

async function api(method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aicode-deploy',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    const err = new Error(`${method} ${url} -> ${res.status} ${text.slice(0, 200)}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

function walk(dir, rel = '') {
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name)
    const r = rel ? `${rel}/${name}` : name
    if (fs.statSync(abs).isDirectory()) out.push(...walk(abs, r))
    else out.push({ abs, rel: r })
  }
  return out
}

const files = walk(DIST)
console.log(`待上传 ${files.length} 个文件 → ${BRANCH} 分支`)

for (const f of files) {
  const content = fs.readFileSync(f.abs).toString('base64')
  const enc = f.rel.split('/').map(encodeURIComponent).join('/')
  const body = { message: `deploy ${f.rel}`, content, branch: BRANCH }
  try {
    await api('PUT', `/repos/${OWNER}/${REPO}/contents/${enc}`, body)
    console.log('  ✓', f.rel)
  } catch (e) {
    if (e.status === 422 || e.status === 409) {
      // 已存在：取 sha 后更新
      const cur = await api('GET', `/repos/${OWNER}/${REPO}/contents/${enc}?ref=${BRANCH}`)
      body.sha = cur.sha
      await api('PUT', `/repos/${OWNER}/${REPO}/contents/${enc}`, body)
      console.log('  ↻', f.rel, '(更新)')
    } else {
      console.error('  ✗', f.rel, e.message)
      process.exit(1)
    }
  }
}
console.log('✅ 全部上传完成')
console.log('固定网址（开启 Pages 后生效）: https://' + OWNER + '.github.io/' + REPO + '/')
