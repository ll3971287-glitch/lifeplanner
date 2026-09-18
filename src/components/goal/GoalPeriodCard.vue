<template>
  <div class="gp-card card">
    <div class="row-between gp-head">
      <strong class="gp-title">{{ title }}</strong>
      <span class="gp-progress" :class="{ done: progress.total > 0 && progress.done === progress.total }">
        {{ progress.done }}/{{ progress.total }}
      </span>
    </div>

    <!-- 周期日历 -->
    <div class="gp-cals" :class="{ multi: months.length > 1 }">
      <div v-for="m in months" :key="m" class="gp-cal">
        <span v-if="months.length > 1" class="cal-month-label">{{ m + 1 }} 月</span>
        <div class="cal-grid">
          <span v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w" class="cal-wh">{{ w }}</span>
          <span
            v-for="day in cellsOf(m)"
            :key="day"
            class="cal-day"
            :class="{ out: !inMonth(day, m), today: isToday(day) }"
          >
            {{ new Date(day).getDate() }}
          </span>
        </div>
      </div>
    </div>

    <!-- 目标清单 -->
    <div class="gp-list">
      <div v-for="g in goals" :key="g.id" class="gp-item">
        <template v-if="editingId !== g.id">
          <button type="button" class="tick" :class="{ on: g.done }" @click="store.toggleGoalDone(g.id)">
            <Icon v-if="g.done" name="check" :size="11" />
          </button>
          <div class="gp-main">
            <span class="gp-name" :class="{ done: g.done }">{{ g.name }}</span>
            <span v-if="g.desc" class="gp-desc">{{ g.desc }}</span>
          </div>
          <button type="button" class="mini op" title="编辑" @click="startEdit(g)">
            <Icon name="edit" :size="12" />
          </button>
          <button type="button" class="mini op danger" title="删除" @click="removeGoal(g)">
            <Icon name="x" :size="12" />
          </button>
        </template>
        <template v-else>
          <div class="edit-box">
            <input v-model="editBuf.name" class="gp-input" placeholder="目标名称" />
            <input v-model="editBuf.desc" class="gp-input" placeholder="详情描述（可选）" />
            <div class="row gap6" style="justify-content: flex-end">
              <button type="button" class="mini op" @click="editingId = null"><Icon name="x" :size="12" /></button>
              <button type="button" class="mini op ok" @click="saveEdit(g)"><Icon name="check" :size="12" /></button>
            </div>
          </div>
        </template>
      </div>

      <!-- 新增目标 -->
      <template v-if="adding">
        <div class="edit-box add-box">
          <input v-model="addBuf.name" class="gp-input" placeholder="目标名称，回车添加" @keyup.enter="confirmAdd" />
          <input v-model="addBuf.desc" class="gp-input" placeholder="详情描述（可选）" />
          <div class="row gap6" style="justify-content: flex-end">
            <button type="button" class="mini op" @click="cancelAdd"><Icon name="x" :size="12" /></button>
            <button type="button" class="mini op ok" @click="confirmAdd"><Icon name="check" :size="12" /></button>
          </div>
        </div>
      </template>
      <button v-else type="button" class="add-goal" @click="adding = true">
        <Icon name="plus" :size="12" /> 添加目标
      </button>
    </div>

    <!-- 自由文本区 -->
    <textarea
      v-model="noteBuf"
      class="gp-note"
      rows="3"
      placeholder="这个周期的想法、备注…（随时编辑，自动保存）"
      @input="onNoteInput"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { store } from '../../store.js'
import { goalsOf, goalProgress, goalNoteOf } from '../../selectors.js'
import { periodTitle, periodMonths } from '../../goalMeta.js'
import { monthGridTs } from '../../utils/date.js'
import { showToast } from '../../ui.js'
import Icon from '../ui/Icon.vue'

const props = defineProps({
  year: { type: Number, required: true },
  scope: { type: String, required: true },
  index: { type: Number, required: true },
})
const emit = defineEmits(['changed'])

const title = computed(() => periodTitle(props.year, props.scope, props.index))
const months = computed(() => periodMonths(props.scope, props.index))
const goals = computed(() => goalsOf(store.state, props.year, props.scope, props.index))
const progress = computed(() => goalProgress(store.state, props.year, props.scope, props.index))

// 日历
const cellsOf = (m) => monthGridTs(props.year, m)
function inMonth(day, m) {
  return day >= new Date(props.year, m, 1).getTime() && day < new Date(props.year, m + 1, 1).getTime()
}
function isToday(day) {
  const d = new Date()
  return day === new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// 目标：新增 / 编辑 / 删除
const adding = ref(false)
const addBuf = reactive({ name: '', desc: '' })
const editingId = ref(null)
const editBuf = reactive({ name: '', desc: '' })

function confirmAdd() {
  const name = addBuf.name.trim()
  if (!name) return
  store.addGoal({ year: props.year, scope: props.scope, index: props.index, name, desc: addBuf.desc.trim() })
  addBuf.name = ''
  addBuf.desc = ''
  emit('changed')
}
function cancelAdd() {
  adding.value = false
  addBuf.name = ''
  addBuf.desc = ''
}
function startEdit(g) {
  editingId.value = g.id
  editBuf.name = g.name
  editBuf.desc = g.desc || ''
}
function saveEdit(g) {
  const name = editBuf.name.trim()
  if (!name) return
  store.updateGoal(g.id, { name, desc: editBuf.desc.trim() })
  editingId.value = null
}
function removeGoal(g) {
  store.deleteGoal(g.id)
  showToast('已删除目标')
  emit('changed')
}

// 自由文本区（500ms 防抖保存）
const noteBuf = ref(goalNoteOf(store.state, props.year, props.scope, props.index))
let noteTimer = null
function onNoteInput() {
  clearTimeout(noteTimer)
  noteTimer = setTimeout(() => {
    store.setGoalNote(props.year, props.scope, props.index, noteBuf.value)
  }, 500)
}
watch(
  () => [props.year, props.scope, props.index],
  () => {
    noteBuf.value = goalNoteOf(store.state, props.year, props.scope, props.index)
    adding.value = false
    editingId.value = null
  }
)
onBeforeUnmount(() => clearTimeout(noteTimer))
</script>

<style scoped>
.gp-card {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gp-head {
  align-items: center;
}

.gp-title {
  font-size: 14px;
}

.gp-progress {
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
  background: var(--line);
  border-radius: 999px;
  padding: 1px 9px;
}

.gp-progress.done {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 16%, transparent);
}

.gp-cals {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gp-cal {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cal-month-label {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--muted);
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.cal-wh {
  text-align: center;
  font-size: 9px;
  color: var(--muted);
}

.cal-day {
  text-align: center;
  font-size: 10px;
  padding: 2px 0;
  border-radius: 4px;
  background: color-mix(in srgb, var(--bg) 55%, transparent);
}

.cal-day.out {
  opacity: 0.32;
}

.cal-day.today {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  font-weight: 800;
  color: var(--accent-deep);
}

.gp-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gp-item {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 5px 2px;
  border-bottom: 1px dashed var(--line);
}

.tick {
  width: 17px;
  height: 17px;
  border-radius: 6px;
  border: 1.5px solid var(--line);
  background: var(--panel);
  display: grid;
  place-items: center;
  color: #fff;
  flex: none;
  margin-top: 1px;
}

.tick.on {
  background: var(--success);
  border-color: var(--success);
}

.gp-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.gp-name {
  font-size: 13px;
  line-height: 1.35;
  word-break: break-word;
}

.gp-name.done {
  text-decoration: line-through;
  opacity: 0.6;
}

.gp-desc {
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.4;
  word-break: break-word;
}

.mini.op {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  color: var(--muted);
  display: grid;
  place-items: center;
  flex: none;
}

.mini.op:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.mini.op.danger:hover {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}

.mini.op.ok:hover {
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: var(--success);
}

.edit-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.add-box {
  padding: 4px 0;
}

.gp-input {
  width: 100%;
  padding: 6px 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  font-size: 12.5px;
}

.add-goal {
  align-self: flex-start;
  font-size: 12px;
  color: var(--accent-deep);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 2px;
}

.gp-note {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  font-size: 12.5px;
  line-height: 1.5;
  resize: vertical;
}
</style>
