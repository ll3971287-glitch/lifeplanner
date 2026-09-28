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

// 网络不稳：连接类失败、服务端 5xx、以及被截断的 400 malformed 都退避重试
const NET_TRIES = 6
function retryable(e) {
  if (!e.status) return true
  if (e.status >= 500) return true
  return e.status === 400 && /malformed|timeout|temporar/i.test(e.message || '')
}
async function apiRetry(method, url, body, label) {
  let lastErr
  for (let i = 1; i <= NET_TRIES; i += 1) {
    try {
      return await api(method, url, body)
    } catch (e) {
      lastErr = e
      if (!retryable(e)) throw e
      if (i < NET_TRIES) {
        const wait = 2000 * i
        console.log(`  … ${label} 请求失败（${(e.cause && e.cause.code) || e.status || e.message}），${wait / 1000}s 后重试（${i}/${NET_TRIES}）`)
        await new Promise((r) => setTimeout(r, wait))
      }
    }
  }
  throw lastErr
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
// index.html 最后上传：上传中断时线上仍指向上一版已有资源，避免页面短暂 404
files.sort((a, b) => (a.rel === 'index.html' ? 1 : 0) - (b.rel === 'index.html' ? 1 : 0))
console.log(`待上传 ${files.length} 个文件 → ${BRANCH} 分支`)

for (const f of files) {
  const content = fs.readFileSync(f.abs).toString('base64')
  const enc = f.rel.split('/').map(encodeURIComponent).join('/')
  const body = { message: `deploy ${f.rel}`, content, branch: BRANCH }
  try {
    await apiRetry('PUT', `/repos/${OWNER}/${REPO}/contents/${enc}`, body, f.rel)
    console.log('  ✓', f.rel)
  } catch (e) {
    if (e.status === 422 || e.status === 409) {
      // 已存在：取 sha 后更新
      const cur = await apiRetry('GET', `/repos/${OWNER}/${REPO}/contents/${enc}?ref=${BRANCH}`, null, f.rel)
      body.sha = cur.sha
      await apiRetry('PUT', `/repos/${OWNER}/${REPO}/contents/${enc}`, body, f.rel)
      console.log('  ↻', f.rel, '(更新)')
    } else {
      console.error('  ✗', f.rel, e.message)
      process.exit(1)
    }
  }
}
console.log('✅ 全部上传完成')
console.log('固定网址（开启 Pages 后生效）: https://' + OWNER + '.github.io/' + REPO + '/')
