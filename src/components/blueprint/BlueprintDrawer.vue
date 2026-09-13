<template>
  <Drawer :open="open" :title="bp ? bp.title : ''" @close="$emit('close')">
    <div v-if="bp" class="bp-detail">
      <div class="bp-top">
        <span v-if="dimId" class="dim-chip" :style="{ background: dimCss, color: '#fff' }">{{ dimName }}</span>
        <span v-else class="dim-chip none">未分组</span>
        <span class="goal-line muted">
          <Icon name="flag" :size="13" />
          {{ goalText }}
        </span>
      </div>

      <div class="status-row">
        <button
          v-for="k in statusOrder"
          :key="k"
          type="button"
          class="st-btn"
          :class="[stCls(k), { on: bp.status === k }]"
          @click="store.updateBlueprint(bp.id, { status: k })"
        >
          {{ statusOf(k).label }}
        </button>
      </div>

      <div class="block">
        <h4 class="block-title">描述</h4>
        <p v-if="bp.desc" class="desc-text">{{ bp.desc }}</p>
        <p v-else class="muted empty-line">还没有详细描述。</p>
      </div>

      <div class="block">
        <h4 class="block-title">笔记区（想法 · 顾虑 · 感悟）</h4>
        <textarea
          v-model="notesBuf"
          class="notes-ta"
          rows="5"
          placeholder="记录灵感、顾虑、阶段感悟…（自动保存）"
          @input="saveNotes"
        />
      </div>

      <div class="block">
        <div class="row-between">
          <h4 class="block-title">关联（{{ relItems.length }}）</h4>
          <button type="button" class="btn btn-outline btn-sm" @click="linkOpen = true">
            <Icon name="pin" :size="13" /> 关联
          </button>
        </div>
        <div v-if="relItems.length" class="rel-list">
          <div v-for="it in relItems" :key="it.type + it.id" class="rel-row">
            <Icon :name="it.type === 'project' ? 'briefcase' : 'todo'" :size="14" />
            <button type="button" class="rel-title" @click="goTo(it)">{{ it.title }}</button>
            <button type="button" class="mini del" title="解除关联" @click="unlink(it)">
              <Icon name="x" :size="13" />
            </button>
          </div>
        </div>
        <p v-else class="muted empty-line">还没有绑定项目或任务。可以在这里关联，或直接用「拆解」一键创建。</p>
      </div>

      <div class="actions col">
        <button type="button" class="btn btn-accent" @click="breakProject">
          <Icon name="briefcase" :size="15" /> 拆解为新项目
        </button>
        <button type="button" class="btn btn-primary" @click="breakTodo">
          <Icon name="todo" :size="15" /> 拆解为待办任务
        </button>
        <div class="row gap8">
          <button type="button" class="btn btn-outline btn-sm" @click="$emit('edit', bp)">编辑</button>
          <button type="button" class="btn btn-danger btn-sm" @click="remove">删除</button>
        </div>
      </div>

      <BlueprintLinkModal :open="linkOpen" mode="blueprint" :blueprint-id="bp.id" @close="linkOpen = false" />
    </div>
  </Drawer>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../../store.js'
import { BLUEPRINT_STATUS, STATUS_ORDER, dimLabel, dimColor, goalStart, goalEnd } from '../../blueprintMeta.js'
import { fmtDate } from '../../utils/date.js'
import { askConfirm, showToast } from '../../ui.js'
import Drawer from '../ui/Drawer.vue'
import Icon from '../ui/Icon.vue'
import BlueprintLinkModal from './BlueprintLinkModal.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  bpId: { type: String, default: null },
})
const emit = defineEmits(['close', 'edit'])

const router = useRouter()
const statusOf = (k) => BLUEPRINT_STATUS[k] || BLUEPRINT_STATUS.idea
const statusOrder = STATUS_ORDER
const stCls = (k) => statusOf(k).cls

const bp = computed(() => store.state.blueprints.find((b) => b.id === props.bpId))
const dimName = computed(() => (bp.value ? dimLabel(bp.value.dimension, store.state.settings.blueprintDims) : ''))
const dimId = computed(() => (bp.value && bp.value.dimension ? bp.value.dimension : ''))
const dimCss = computed(() => dimColor(bp.value && bp.value.dimension, store.state.settings.blueprintDims))

const goalText = computed(() => {
  if (!bp.value) return ''
  const startTs = goalStart(bp.value)
  const endTs = goalEnd(bp.value)
  const parts = []
  if (endTs != null) {
    parts.push(startTs != null ? `${fmtDate(startTs)} ~ ${fmtDate(endTs)}` : `${fmtDate(endTs)} 前`)
  }
  if (bp.value.goalText) parts.push(bp.value.goalText)
  return parts.length ? `期望 ${parts.join(' · ')}` : '期望时间未定'
})

const relItems = computed(() => {
  if (!bp.value) return []
  return (bp.value.related || [])
    .map((r) => {
      const pool = r.type === 'project' ? store.state.projects : store.state.todos
      const obj = pool.find((x) => x.id === r.id)
      return obj ? { type: r.type, id: r.id, title: obj.title || obj.name } : null
    })
    .filter(Boolean)
})

const notesBuf = ref('')
watch(
  () => [props.bpId, props.open],
  () => {
    notesBuf.value = bp.value ? bp.value.notes || '' : ''
  },
  { immediate: true }
)

let notesTimer = null
function saveNotes() {
  clearTimeout(notesTimer)
  notesTimer = setTimeout(() => {
    if (bp.value) store.updateBlueprint(bp.value.id, { notes: notesBuf.value })
  }, 600)
}

const linkOpen = ref(false)

function unlink(it) {
  if (!bp.value) return
  store.syncRelated(
    bp.value.id,
    (bp.value.related || []).filter((r) => !(r.type === it.type && r.id === it.id))
  )
  showToast('已解除关联')
}

function goTo(it) {
  emit('close')
  router.push(it.type === 'project' ? `/projects/${it.id}` : '/todos')
}

function breakProject() {
  const p = store.breakdownProject(bp.value.id)
  if (!p) return
  emit('close')
  showToast('已拆解为新项目并自动关联')
  router.push(`/projects/${p.id}`)
}

function breakTodo() {
  const t = store.breakdownTodo(bp.value.id)
  if (!t) return
  emit('close')
  showToast('已拆解为待办任务并自动关联')
  router.push('/todos')
}

async function remove() {
  const ok = await askConfirm({ title: '删除蓝图', message: `删除「${bp.value.title}」？蓝图只保留构想本身，不会影响已拆解出的项目/任务。`, danger: true, okText: '删除' })
  if (!ok) return
  store.deleteBlueprint(bp.value.id)
  showToast('已删除')
  emit('close')
}
</script>

<style scoped>
.bp-detail {
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.bp-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dim-chip {
  font-size: 12px;
  font-weight: 700;
  padding: 3px 11px;
  border-radius: 999px;
}

.dim-chip.none {
  background: var(--line);
  color: var(--muted);
}

.goal-line {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
}

.status-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.st-btn {
  font-size: 12.5px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--muted);
}

.st-btn.on {
  color: var(--text);
}

.st-btn.idea.on {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 18%, transparent);
}

.st-btn.doing.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}

.st-btn.paused.on {
  border-color: var(--muted);
  background: var(--line);
}

.st-btn.done.on {
  border-color: var(--success);
  background: color-mix(in srgb, var(--success) 18%, transparent);
}

.block-title {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--muted);
}

.desc-text {
  margin: 0;
  line-height: 1.6;
  white-space: pre-wrap;
}

.empty-line {
  margin: 0;
  font-size: 13px;
}

.notes-ta {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
  line-height: 1.6;
  resize: vertical;
}

.rel-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rel-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 4px;
  border-bottom: 1px dashed var(--line);
}

.rel-title {
  flex: 1;
  text-align: left;
  font-size: 14px;
  color: var(--text);
}

.del {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  color: var(--muted);
}

.del:hover {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}

.actions.col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
