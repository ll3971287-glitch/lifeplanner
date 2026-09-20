<template>
  <div class="settings">
    <section class="card s-card">
      <h2 class="s-title"><Icon name="settings" :size="16" /> 外观主题</h2>

      <div class="field">
        <span class="field-label">主题配色</span>
        <div class="theme-grid">
          <button
            v-for="t in PALETTE_LIST"
            :key="t.id"
            type="button"
            class="theme-card"
            :class="{ on: store.state.settings.theme === t.id }"
            @click="store.setSetting('theme', t.id)"
          >
            <span class="sw-row">
              <i class="sw big" :style="{ background: t.primary }" />
              <i class="sw big" :style="{ background: t.accent }" />
              <i class="sw mid" :style="{ background: t.deep }" />
              <i class="sw mid" :style="{ background: t.adeep }" />
            </span>
            <span class="theme-name">{{ t.name }}</span>
          </button>
        </div>
      </div>

      <div class="field">
        <span class="field-label">明暗模式</span>
        <SegControl :model-value="store.state.settings.mode || 'light'" :options="[{ label: '☀ 浅色', value: 'light' }, { label: '🌙 深色', value: 'dark' }]" @update:model-value="store.setSetting('mode', $event)" />
      </div>
    </section>

    <section class="card s-card">
      <h2 class="s-title"><Icon name="clock" :size="16" /> 专注计时</h2>
      <div class="param-row">
        <div class="field">
          <span class="field-label">短休息（分钟）</span>
          <input v-model.number="breakMin" type="number" min="1" max="60" class="input" @change="applyFocusSettings" />
        </div>
        <div class="field">
          <span class="field-label">每日专注目标（分钟）</span>
          <input v-model.number="goalMin" type="number" min="0" class="input" @change="applyFocusSettings" />
        </div>
      </div>
      <p class="muted tip-line">番茄专注时长已移到「专注」页顶部右上角，可直接调整；修改在下次开始计时时生效。</p>
    </section>

    <section class="card s-card">
      <h2 class="s-title"><Icon name="home" :size="16" /> 首页内容</h2>
      <div class="row-between opt-row">
        <div class="opt-text">
          <span class="opt-name">在首页显示项目进度</span>
          <p class="muted opt-desc">关闭后首页不再显示“项目进度”板块，可在首页该板块点“隐藏”或随时在此恢复。</p>
        </div>
        <Switch
          :model-value="store.state.settings.showProjectsOnHome !== false"
          @update:model-value="store.setSetting('showProjectsOnHome', $event)"
        />
      </div>
    </section>

    <section class="card s-card">
      <h2 class="s-title"><Icon name="clock" :size="16" /> 专注提醒</h2>
      <div class="row-between opt-row">
        <div class="opt-text">
          <span class="opt-name">计时结束提示音</span>
          <p class="muted opt-desc">专注到点、休息结束、专注链倒计时结束时会响铃提醒（程序合成音，离线可用）。</p>
        </div>
        <Switch
          :model-value="store.state.settings.soundOn !== false"
          @update:model-value="store.setSetting('soundOn', $event)"
        />
      </div>
    </section>

    <section class="card s-card">
      <h2 class="s-title"><Icon name="flag" :size="16" /> 未来蓝图</h2>
      <div class="row-between opt-row">
        <div class="opt-text">
          <span class="opt-name">日历中提示带时间的蓝图</span>
          <p class="muted opt-desc">默认关闭：蓝图不做待办，不会出现在日历。开启后日历仅在期望达成日以虚线样式提示展示（不含已搁置 / 已完成）。</p>
        </div>
        <Switch
          :model-value="!!store.state.settings.showBlueprintsOnCalendar"
          @update:model-value="store.setSetting('showBlueprintsOnCalendar', $event)"
        />
      </div>
    </section>

    <section class="card s-card">
      <h2 class="s-title"><Icon name="layers" :size="16" /> 数据备份</h2>
      <p class="muted desc">
        所有数据只保存在本机浏览器中。清理浏览器数据或更换设备可能丢失，建议定期导出备份。
        当前数据约 {{ sizeText }}。
      </p>
      <div class="row gap8 wrap">
        <button type="button" class="btn btn-primary btn-sm" @click="openExportPanel">
          <Icon name="download" :size="14" /> 导出全部数据
        </button>
        <button type="button" class="btn btn-outline btn-sm" @click="fileInput.click()">
          <Icon name="upload" :size="14" /> 导入备份
        </button>
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="doImport" />
        <button type="button" class="btn btn-outline btn-sm" @click="openPasteImport">
          <Icon name="upload" :size="14" /> 粘贴导入
        </button>
        <button type="button" class="btn btn-danger btn-sm" @click="clearOpen = true">
          <Icon name="alert" :size="14" /> 清空全部数据
        </button>
      </div>
      <p class="muted desc">若浏览器拦截下载，可在导出面板里选「复制全部数据」或「分享文件」。</p>
    </section>

    <BaseModal :open="exportOpen" title="导出数据" @close="exportOpen = false">
      <div class="export-box">
        <p class="muted desc">JSON 备份当前约 {{ sizeText }}。下载被拦截时，复制或分享一样可以带走数据：</p>
        <div class="row gap8 wrap">
          <button type="button" class="btn btn-primary btn-sm" @click="doExport">
            <Icon name="download" :size="14" /> 直接下载
          </button>
          <button type="button" class="btn btn-outline btn-sm" @click="copyExport">
            <Icon name="check" :size="14" /> 复制全部数据
          </button>
          <button v-if="canShare" type="button" class="btn btn-outline btn-sm" @click="shareExport">
            <Icon name="upload" :size="14" /> 分享文件
          </button>
        </div>
        <textarea ref="exportTa" class="export-ta" readonly rows="6" :value="exportText" @click="selectAllText" placeholder="点「复制全部数据」即可带走 JSON…" />
        <template v-if="chunks.length > 1">
          <p class="muted desc">当前数据较大（{{ exportText.length }} 字符）。部分内置浏览器粘贴会截断，请改用<b>分片复制</b>：逐段复制下面每一段，再到目标设备「粘贴导入」里逐段添加：</p>
          <div class="chunk-row" v-for="(ch, i) in chunks" :key="i">
            <span class="muted mini">第 {{ i + 1 }}/{{ chunks.length }} 段（{{ ch.length }} 字符）</span>
            <button type="button" class="btn btn-outline btn-sm" @click="copyChunk(ch)">复制本段</button>
          </div>
        </template>
        <template v-else>
          <p class="muted desc">数据较小，直接点上方「复制全部数据」即可。</p>
        </template>
      </div>
    </BaseModal>

    <section class="card s-card">
      <h2 class="s-title"><Icon name="checkCircle" :size="16" /> 关于</h2>
      <p class="muted desc">
        Ultimate Life System v3.1.2 · 本地任务与项目管理<br />
        数据存放于本机 IndexedDB，无需账号，离线可用。
      </p>
    </section>

    <BaseModal :open="pasteOpen" title="粘贴导入备份" @close="pasteOpen = false">
      <div class="export-box">
        <p class="muted desc">
          把「复制全部数据」得到的 JSON 粘贴到下面点「加入」，即可导入恢复（缺失的数据块会自动置空）。
          若粘贴被截断，请在来源设备用<b>分片复制</b>，把每一段依次粘贴并点「加入」，最后合并导入。
        </p>
        <textarea v-model="pasteBuf" class="export-ta" rows="6" :placeholder="addHint" />
        <div class="row gap8">
          <button type="button" class="btn btn-outline btn-sm" @click="appendPasteChunk">加入此段</button>
          <span class="muted mini">已加入 {{ pasteRows.length }} 段 · {{ totalPasteChars }} 字符</span>
        </div>
        <div v-if="pasteRows.length" class="chunk-list">
          <div v-for="(row, i) in pasteRows" :key="i" class="chunk-row">
            <span class="muted mini">第 {{ i + 1 }} 段（{{ row.length }} 字符）</span>
            <button type="button" class="mini del" title="移除" @click="pasteRows.splice(i, 1)">
              <Icon name="x" :size="12" />
            </button>
          </div>
        </div>
        <div class="row gap8" style="justify-content: flex-end">
          <button type="button" class="btn btn-outline btn-sm" @click="pasteOpen = false">取消</button>
          <button type="button" class="btn btn-primary btn-sm" :disabled="!pasteRows.length" @click="doPasteImport">合并并导入</button>
        </div>
      </div>
    </BaseModal>

    <BaseModal :open="clearOpen" title="清空全部数据" @close="clearOpen = false">
      <div class="clear-box">
        <p>此操作将删除全部任务、项目、打卡、复盘与专注记录，且不可恢复（执行前会自动备份当前数据到本地槽位）。</p>
        <p class="muted">请输入「清空」以确认：</p>
        <input v-model="confirmWord" class="input" placeholder="清空" />
        <div class="actions">
          <button type="button" class="btn btn-ghost" @click="clearOpen = false">取消</button>
          <button type="button" class="btn btn-danger" :disabled="confirmWord.trim() !== '清空'" @click="doClear">清空全部</button>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { store } from '../store.js'
import { PALETTE_LIST } from '../theme.js'
import SegControl from '../components/ui/SegControl.vue'
import { showToast } from '../ui.js'
import { askConfirm } from '../ui.js'
import { fileDateStamp } from '../format.js'
import Icon from '../components/ui/Icon.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import Switch from '../components/ui/Switch.vue'


const focusMin = ref(store.state.settings.pomodoroFocusMin)
const breakMin = ref(store.state.settings.pomodoroBreakMin)
const goalMin = ref(store.state.settings.dailyFocusGoalMin)

const fileInput = ref(null)
const clearOpen = ref(false)
const confirmWord = ref('')

const sizeText = computed(() => {
  const bytes = new Blob([JSON.stringify(store.exportData())]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
})

function applyFocusSettings() {
  store.setSetting('pomodoroBreakMin', Math.max(1, Math.min(60, Math.round(breakMin.value) || 5)))
  store.setSetting('dailyFocusGoalMin', Math.max(0, Math.round(goalMin.value) || 0))
  showToast('计时设置已保存')
}

const exportOpen = ref(false)
const exportText = ref('')
const exportTa = ref(null)
const canShare = ref(false)
if (typeof navigator !== 'undefined' && navigator.canShare) {
  canShare.value = navigator.canShare({ files: [] })
}

function openExportPanel() {
  exportText.value = JSON.stringify(store.exportData(), null, 2)
  exportOpen.value = true
}

function selectAllText() {
  if (exportTa.value) exportTa.value.select()
}

async function copyExport() {
  if (!exportText.value) return
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(exportText.value)
    } else {
      // 剪贴板 API 不可用时的降级：选中文本提示手动复制
      if (exportTa.value) exportTa.value.select()
      showToast('已选中全部内容，请手动复制')
      return
    }
    showToast('备份数据已复制')
  } catch (err) {
    showToast('复制失败，请长按文本框手动选择复制', 'err')
  }
}

async function shareExport() {
  if (!exportText.value || !navigator.share) return
  try {
    const file = new File([exportText.value], `ultimate-life-system-backup-${fileDateStamp()}.json`, { type: 'application/json' })
    await navigator.share({ title: 'LifePlanner 数据备份', text: '请用「保存到文件/发送」接收备份', files: [file] })
  } catch (err) {
    if (err && err.name === 'AbortError') return
    showToast('分享失败：' + (err && err.message ? err.message : '未知错误'), 'err')
  }
}

const pasteOpen = ref(false)
const pasteBuf = ref('')
const pasteRows = ref([])
const CHUNK_LEN = 3000

const chunks = computed(() => {
  if (!exportText.value) return []
  const out = []
  for (let i = 0; i < exportText.value.length; i += CHUNK_LEN) out.push(exportText.value.slice(i, i + CHUNK_LEN))
  return out
})
const addHint = computed(() => (pasteRows.value.length ? `粘贴第 ${pasteRows.value.length + 1} 段内容…` : '粘贴 JSON 第 1 段 / 完整内容…'))
const totalPasteChars = computed(() => pasteRows.value.reduce((a, r) => a + r.length, 0))

async function copyChunk(ch) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(ch)
      showToast('已复制本段，去目标设备粘贴')
    } else {
      if (exportTa.value) exportTa.value.select()
      showToast('请在文本框中手动选择复制本段')
    }
  } catch (err) {
    showToast('复制失败，请长按文本框手动复制', 'err')
  }
}

function openPasteImport() {
  pasteBuf.value = ''
  pasteRows.value = []
  pasteOpen.value = true
}

function appendPasteChunk() {
  const t = pasteBuf.value.trim()
  if (!t) return
  pasteRows.value.push(t)
  pasteBuf.value = ''
}

async function doPasteImport() {
  const text = pasteRows.value.join('').trim()
  if (!text) return
  try {
    const data = JSON.parse(text)
    const missing = await store.importData(data)
    pasteOpen.value = false
    focusMin.value = store.state.settings.pomodoroFocusMin
    breakMin.value = store.state.settings.pomodoroBreakMin
    goalMin.value = store.state.settings.dailyFocusGoalMin
    if (missing && missing.length) {
      showToast(`导入完成，但缺少数据块：${missing.join('、')}（已置空）`)
    } else {
      showToast('导入成功')
    }
  } catch (err) {
    const msg = err && err.message ? err.message : '不是有效的 JSON'
    showToast(`导入失败：${msg}。请确认粘贴的是「复制全部数据」得到的完整 JSON（以 { 开头以 } 结尾）`, 'err')
  }
}

function doExport() {
  // 面板保留不关闭：若下载被浏览器拦截，用户可立刻改用「复制/分享」带走同一份数据
  const data = store.exportData()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ultimate-life-system-backup-${fileDateStamp()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showToast('已导出备份文件')
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

async function doImport(e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  try {
    const text = await readFileAsText(file)
    const data = JSON.parse(text)
    const missing = await store.importData(data)
    focusMin.value = store.state.settings.pomodoroFocusMin
    breakMin.value = store.state.settings.pomodoroBreakMin
    goalMin.value = store.state.settings.dailyFocusGoalMin
    if (missing && missing.length) {
      showToast(`导入完成，但缺少数据块：${missing.join('、')}（已置空）`)
    } else {
      showToast('导入成功')
    }
  } catch (err) {
    showToast('导入失败：' + (err && err.message ? err.message : '文件格式不正确'), 'err')
  }
}

async function doClear() {
  const ok = await askConfirm({
    title: '最后确认',
    message: '即将清空全部数据。当前数据会先自动备份，但仍建议先导出文件。继续？',
    danger: true,
    okText: '清空',
  })
  if (!ok) return
  await store.clearAll()
  focusMin.value = store.state.settings.pomodoroFocusMin
  breakMin.value = store.state.settings.pomodoroBreakMin
  goalMin.value = store.state.settings.dailyFocusGoalMin
  clearOpen.value = false
  confirmWord.value = ''
  showToast('已清空全部数据')
}
</script>

<style scoped>
.export-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chunk-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px dashed var(--line);
}

.chunk-list {
  display: flex;
  flex-direction: column;
}

.mini.del {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  color: var(--muted);
}

.mini.del:hover {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}

.export-ta {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  font-family: monospace;
  font-size: 11px;
  line-height: 1.5;
  resize: vertical;
}
.settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.s-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.s-title {
  margin: 0;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 7px;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}

.theme-card {
  border: 2px solid transparent;
  border-radius: 12px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  transition: border-color 0.15s ease;
}

.theme-card.on {
  border-color: var(--primary-deep);
  background: color-mix(in srgb, var(--primary) 18%, transparent);
}

.sw-row {
  display: flex;
  gap: 6px;
}

.sw {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: inline-block;
}

.sw.mid {
  width: 18px;
  height: 18px;
  border-radius: 6px;
}

.theme-name {
  font-size: 12.5px;
  font-weight: 700;
}

.param-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.tip-line {
  margin: 0;
  font-size: 12.5px;
}

.desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
}

.opt-row {
  gap: 12px;
  padding: 2px 0;
}

.opt-text {
  min-width: 0;
}

.opt-name {
  font-size: 14px;
  font-weight: 700;
}

.opt-desc {
  margin: 3px 0 0;
  font-size: 12px;
}

.hidden {
  display: none;
}

.clear-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.clear-box p {
  margin: 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
