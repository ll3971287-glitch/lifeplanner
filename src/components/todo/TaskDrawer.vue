<template>
  <Drawer :open="open" :title="todo ? todo.title : ''" @close="$emit('close')">
    <template v-if="todo">
      <div class="badges">
        <span class="status-chip" :class="statusClass">{{ statusText }}</span>
        <span v-if="todo.priority" class="pri-badge" :class="'pri-' + todo.priority">{{ priorityLabelText }}</span>
        <span v-if="isOverdue" class="status-chip danger">已逾期</span>
        <span v-if="delayActive" class="status-chip warn">已延期 · 延期至 {{ snoozeText }}</span>
      </div>

      <dl class="meta">
        <template v-if="parentTodo">
          <div class="meta-row">
            <dt>父任务</dt>
            <dd>{{ parentTodo.title }}</dd>
          </div>
        </template>
        <div v-if="projectOf" class="meta-row">
          <dt>所属项目</dt>
          <dd>{{ projectOf.name }}</dd>
        </div>
        <div v-if="timeText" class="meta-row">
          <dt>时间</dt>
          <dd>{{ timeText }}</dd>
        </div>
        <div v-if="recurrenceText" class="meta-row">
          <dt>循环</dt>
          <dd>{{ recurrenceText }}（完成后自动生成下一期）</dd>
        </div>
        <div v-if="todo.tagIds.length" class="meta-row">
          <dt>标签</dt>
          <dd><TagChips :tag-ids="todo.tagIds" /></dd>
        </div>
        <div v-if="bpChips.length" class="meta-row">
          <dt>未来蓝图</dt>
          <dd class="row gap4 wrap">
            <button v-for="b in bpChips" :key="b.id" type="button" class="bp-chip" @click="goBlueprints">{{ b.title }}</button>
          </dd>
        </div>
        <div v-if="note" class="meta-row">
          <dt>备注</dt>
          <dd class="note-text">{{ note }}</dd>
        </div>
      </dl>

      <section v-if="children.length" class="block">
        <h4 class="block-title">子任务（{{ doneCount }}/{{ children.length }}）</h4>
        <div class="sub-list">
          <div v-for="c in children" :key="c.id" class="sub-row">
            <button type="button" class="check" :class="{ on: c.completed }" @click="store.toggleTodo(c.id)">
              <Icon v-if="c.completed" name="check" :size="11" />
            </button>
            <span class="sub-title" :class="{ done: c.completed }">{{ c.title }}</span>
            <button type="button" class="mini del" title="删除子任务" @click="removeSub(c)">
              <Icon name="x" :size="13" />
            </button>
          </div>
          <button type="button" class="add-sub" @click="$emit('add-sub', todo)">+ 添加子任务</button>
        </div>
      </section>

      <section class="block">
        <h4 class="block-title">专注记录（{{ sessions.length }}）</h4>
        <div v-if="sessions.length" class="session-list">
          <div v-for="s in sessions" :key="s.id" class="session-row">
            <span class="mode-tag" :class="s.mode">{{ s.mode === 'pomodoro' ? '番茄' : '自由' }}</span>
            <span>{{ fmtDateTime(s.startAt) }}</span>
            <span class="muted">{{ fmtDurationMin(s.durationMin) }}</span>
          </div>
        </div>
        <p v-else class="muted empty-line">还没有专注记录，开始一次番茄试试。</p>
      </section>

      <div class="actions">
        <button v-if="canDelay" type="button" class="btn btn-outline btn-sm" @click="delayOpen = true">
          <Icon name="clock" :size="14" /> {{ delayActive ? '调整推迟' : '推迟（不算逾期）' }}
        </button>
        <button v-if="hasBlueprints" type="button" class="btn btn-outline btn-sm" @click="linkBpOpen = true">
          <Icon name="flag" :size="13" /> 关联蓝图
        </button>
        <button type="button" class="btn btn-outline btn-sm" @click="duplicateTask">
          <Icon name="layers" :size="14" /> 创建副本
        </button>
        <button type="button" class="btn btn-outline btn-sm" @click="$emit('edit', todo)">
          <Icon name="edit" :size="14" /> 编辑
        </button>
        <button type="button" class="btn btn-sm" style="background: var(--primary); color: var(--primary-deep)" @click="$emit('focus', todo)">
          <Icon name="clock" :size="14" /> 开始专注
        </button>
        <button type="button" class="btn btn-danger btn-sm" @click="removeTodo">
          <Icon name="trash" :size="14" /> 删除
        </button>
      </div>
      <BlueprintLinkModal :open="linkBpOpen" mode="todo" target-type="todo" :target-id="todo.id" @close="linkBpOpen = false" />
      <BaseModal :open="delayOpen" title="推迟任务" @close="delayOpen = false">
        <p class="muted" style="margin-bottom: 12px">推迟期间该任务不算逾期，到推迟时刻仍未完成则恢复逾期判定。</p>
        <div class="delay-grid">
          <button v-for="o in delayOptions" :key="o.label" type="button" class="delay-opt" @click="setDelay(o.ts)">
            {{ o.label }}
          </button>
        </div>
        <p v-if="todo.snoozeUntil" class="muted" style="margin: 12px 0 0">当前推迟至：{{ snoozeText }}</p>
        <div class="row gap8" style="margin-top: 14px">
          <button v-if="todo.snoozeUntil" type="button" class="btn btn-outline btn-sm" @click="clearDelay">取消推迟</button>
          <button type="button" class="btn btn-sm" @click="delayOpen = false">关闭</button>
        </div>
      </BaseModal>
    </template>
  </Drawer>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../../store.js'
import { todoChildren, todoOverdue, subtreeStats } from '../../selectors.js'
import { todoTimeText, recurText } from '../../format.js'
import { fmtDateTime, fmtDurationMin, endOfDayTs, startOfDayTs, DAY_MS } from '../../utils/date.js'
import { askConfirm, showToast } from '../../ui.js'
import Drawer from '../ui/Drawer.vue'
import Icon from '../ui/Icon.vue'
import TagChips from '../ui/TagChips.vue'
import BaseModal from '../ui/BaseModal.vue'
import BlueprintLinkModal from '../blueprint/BlueprintLinkModal.vue'

const props = defineProps({
  todoId: { type: String, default: null },
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'edit', 'focus', 'add-sub'])
const router = useRouter()

const todo = computed(() => store.state.todos.find((t) => t.id === props.todoId) || null)
const parentTodo = computed(() => (todo.value && todo.value.parentId ? store.state.todos.find((t) => t.id === todo.value.parentId) || null : null))
const projectOf = computed(() => (todo.value && todo.value.projectId ? store.state.projects.find((p) => p.id === todo.value.projectId) || null : null))
const children = computed(() => (todo.value ? todoChildren(store.state.todos, todo.value.id) : []))
const stats = computed(() => (todo.value ? subtreeStats(store.state.todos, todo.value.id) : { done: 0 }))
const doneCount = computed(() => stats.value.done)
const timeText = computed(() => (todo.value ? todoTimeText(todo.value) : ''))
const recurrenceText = computed(() => (todo.value ? recurText(todo.value.recurrence) : ''))
const note = computed(() => (todo.value ? todo.value.note : ''))
const isOverdue = computed(() => (todo.value ? todoOverdue(todo.value, Date.now()) : false))
const sessions = computed(() =>
  todo.value
    ? store.state.sessions
        .filter((s) => s.targetId === todo.value.id && (s.targetType === 'todo' || s.targetType === 'projectSub'))
        .sort((a, b) => b.startAt - a.startAt)
    : []
)
const statusText = computed(() => (todo.value ? (todo.value.completed ? '已完成' : '未完成') : ''))
const statusClass = computed(() => (todo.value && todo.value.completed ? 'done' : 'open'))
const priorityLabelText = computed(() => ({ high: '高优先级', medium: '中优先级', low: '低优先级' }[todo.value && todo.value.priority] || ''))

const bpChips = computed(() => {
  const ids = (todo.value && (todo.value.blueprintIds || [])) || []
  return store.state.blueprints.filter((b) => ids.includes(b.id))
})
const hasBlueprints = computed(() => store.state.blueprints.length > 0)
const linkBpOpen = ref(false)
const delayOpen = ref(false)
function goBlueprints() {
  emit('close')
  router.push('/blueprints')
}
const delayActive = computed(() => todo.value && todo.value.snoozeUntil != null && !todo.value.completed && Date.now() < todo.value.snoozeUntil)
const snoozeText = computed(() => (todo.value && todo.value.snoozeUntil ? fmtDateTime(todo.value.snoozeUntil) : ''))
const canDelay = computed(() => todo.value && todo.value.timeType !== 'none' && (isOverdue.value || delayActive.value))
const delayOptions = computed(() => {
  const n = Date.now()
  return [
    { label: '1 小时后', ts: n + 3600000 },
    { label: '今晚 23:59', ts: endOfDayTs(n) },
    { label: '明天 09:00', ts: startOfDayTs(n) + DAY_MS + 9 * 3600000 },
    { label: '3 天后', ts: n + 3 * DAY_MS },
    { label: '一周后', ts: n + 7 * DAY_MS },
  ]
})

function setDelay(ts) {
  if (!todo.value) return
  store.updateTodo(todo.value.id, { snoozeUntil: ts })
  delayOpen.value = false
  showToast('已推迟：期间不算逾期')
}

function clearDelay() {
  if (!todo.value) return
  store.updateTodo(todo.value.id, { snoozeUntil: null })
  delayOpen.value = false
  showToast('已取消推迟')
}

function duplicateTask() {
  if (!todo.value) return
  const copy = store.duplicateTodo(todo.value.id)
  if (copy) showToast('已创建副本')
}

async function removeTodo() {
  const n = stats.value.total
  const ok = await askConfirm({
    title: '删除任务',
    message: `确定删除「${todo.value.title}」吗？`,
    detail: n ? `将同时删除 ${n} 个子任务。` : '',
    danger: true,
    okText: '删除',
  })
  if (!ok) return
  store.deleteTodo(todo.value.id)
  showToast('已删除')
  emit('close')
}

async function removeSub(sub) {
  const ok = await askConfirm({ title: '删除子任务', message: `确定删除「${sub.title}」吗？`, danger: true, okText: '删除' })
  if (!ok) return
  store.deleteTodo(sub.id)
}
</script>

<style scoped>
.badges {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.status-chip {
  font-size: 12px;
  font-weight: 700;
  padding: 3px 11px;
  border-radius: 999px;
}

.status-chip.done {
  background: color-mix(in srgb, var(--success) 15%, transparent);
  color: var(--success);
}

.status-chip.open {
  background: color-mix(in srgb, var(--primary) 40%, transparent);
  color: var(--primary-deep);
}

.status-chip.danger {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}

.status-chip.warn {
  background: color-mix(in srgb, var(--warn) 14%, transparent);
  color: var(--warn);
}

.bp-chip {
  font-size: 11.5px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 999px;
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 13%, transparent);
}

.delay-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.delay-opt {
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  font-size: 13px;
  color: var(--text);
}

.delay-opt:active {
  transform: scale(0.97);
}

.pri-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 3px 11px;
  border-radius: 999px;
  color: #fff;
}

.pri-badge.pri-high {
  background: #ef4444;
}

.pri-badge.pri-medium {
  background: #eab308;
  color: #422006;
}

.pri-badge.pri-low {
  background: #3b82f6;
}

.meta {
  margin: 0 0 14px;
}

.meta-row {
  display: flex;
  gap: 10px;
  padding: 5px 0;
  border-bottom: 1px dashed var(--line);
  font-size: 14px;
}

.meta-row dt {
  width: 54px;
  flex: none;
  color: var(--text-dim);
}

.meta-row dd {
  margin: 0;
  min-width: 0;
}

.note-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.block {
  margin-bottom: 16px;
}

.block-title {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-dim);
}

.sub-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sub-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 9px;
}

.check {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--line);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  color: transparent;
  background: var(--card);
}

.check.on {
  background: var(--primary-deep);
  border-color: var(--primary-deep);
  color: #fff;
}

.sub-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.sub-title.done {
  text-decoration: line-through;
  color: var(--text-dim);
}

.mini.del {
  color: var(--text-dim);
  width: 24px;
  height: 24px;
  border-radius: 6px;
}

.add-sub {
  align-self: flex-start;
  font-size: 13px;
  color: var(--primary-deep);
  font-weight: 600;
  padding: 6px 4px;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.session-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 5px 4px;
}

.mode-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 999px;
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  flex: none;
}

.empty-line {
  padding: 6px 0;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  border-top: 1px solid var(--line);
  padding-top: 14px;
}
</style>
