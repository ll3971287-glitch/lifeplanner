<template>
  <div class="task-node">
    <div class="task-row" :class="{ done: todo.completed, overdue: isOverdue }" :style="{ paddingLeft: 6 + depth * 16 + 'px' }" :draggable="dragEnabled" @dragstart="onDragStart($event)" @dragover.prevent="onDragOver" @drop.prevent="onDrop($event)">
      <span v-if="todo.priority" class="pri-bar" :class="'pri-' + todo.priority" />
      <button v-if="hasChildren" type="button" class="mini chev" :aria-label="expanded ? '折叠' : '展开'" @click.stop="expanded = !expanded">
        <Icon :name="expanded ? 'chevronDown' : 'chevronRight'" :size="14" />
      </button>
      <span v-else class="mini chev-spacer" />

      <button
        type="button"
        class="check"
        :class="{ on: todo.completed }"
        :aria-label="todo.completed ? '标记未完成' : '标记完成'"
        @click.stop="store.toggleTodo(todo.id)"
      >
        <Icon v-if="todo.completed" name="check" :size="12" />
      </button>

      <div class="main" role="button" tabindex="0" @click="$emit('open', todo)" @keyup.enter="$emit('open', todo)">
        <div class="title-line">
          <span class="title" :class="{ done: todo.completed }">{{ todo.title }}</span>
          <button v-if="canOneKeyDone" type="button" class="onekey" @click.stop="oneKeyDone">一键完成</button>
        </div>
        <div v-if="timeText || isOverdue || subInfo || todo.tagIds.length || projName" class="meta-line">
          <span v-if="isOverdue" class="late-text">已逾期</span>
          <span v-else-if="timeText" class="time-badge">{{ timeText }}</span>
          <span v-if="subInfo" class="sub-count">{{ subInfo }}</span>
          <span v-if="projName" class="proj-mini" title="所属项目">{{ projName }}</span>
          <TagChips :tag-ids="todo.tagIds" />
        </div>
      </div>

      <button type="button" class="mini focus-btn" title="开始专注" @click.stop="$emit('focus', todo)">
        <Icon name="clock" :size="15" />
      </button>
    </div>

    <div v-if="expanded && hasChildren" class="children">
      <TaskItem v-for="c in children" :key="c.id" :todo="c" :depth="depth + 1" :sort-mode="sortMode" :drag-enabled="dragEnabled" @open="$emit('open', $event)" @focus="$emit('focus', $event)" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { store } from '../../store.js'
import { todoChildren, subtreeStats, todoOverdue, compareTasksByMode } from '../../selectors.js'
import { todoTimeText } from '../../format.js'
import Icon from '../ui/Icon.vue'
import TagChips from '../ui/TagChips.vue'

defineOptions({ name: 'TaskItem' })

const props = defineProps({
  todo: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  sortMode: { type: String, default: 'custom' },
  dragEnabled: { type: Boolean, default: true },
})

defineEmits(['open', 'focus'])

const expanded = ref(true)

const children = computed(() => {
  const list = todoChildren(store.state.todos, props.todo.id)
  if (props.sortMode !== 'custom') list.sort((a, b) => compareTasksByMode(a, b, props.sortMode))
  return list
})
const hasChildren = computed(() => children.value.length > 0)
const stats = computed(() => subtreeStats(store.state.todos, props.todo.id))
const canOneKeyDone = computed(() => stats.value.allDone && !props.todo.completed)
const subInfo = computed(() => (stats.value.total ? `${stats.value.done}/${stats.value.total}` : ''))
const timeText = computed(() => todoTimeText(props.todo))
const isOverdue = computed(() => todoOverdue(props.todo, Date.now()))
const projName = computed(() => {
  if (!props.todo.projectId) return ''
  const p = store.state.projects.find((x) => x.id === props.todo.projectId)
  return p ? p.name : ''
})

function oneKeyDone() {
  store.toggleTodo(props.todo.id, true)
}

function onDragStart(e) {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    try {
      e.dataTransfer.setData('text/plain', props.todo.id)
    } catch (err) {
      /* 某些环境不支持 setData */
    }
  }
}

function onDragOver(e) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDrop(e) {
  let id = null
  try {
    id = e.dataTransfer ? e.dataTransfer.getData('text/plain') : null
  } catch (err) {
    /* ignore */
  }
  if (id && id !== props.todo.id) {
    store.moveTodo(id, { parentId: props.todo.parentId, beforeId: props.todo.id })
  }
}
</script>

<style scoped>
.task-node {
  border-bottom: 1px solid var(--line);
}

.task-node:last-child {
  border-bottom: none;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 10px;
  cursor: pointer;
  position: relative;
}

.task-row:hover {
  background: rgba(0, 0, 0, 0.02);
}

.mini {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  flex: none;
  border-radius: 6px;
}

.chev-spacer {
  width: 22px;
  flex: none;
}

.check {
  width: 21px;
  height: 21px;
  border-radius: 50%;
  border: 2px solid var(--line);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  color: transparent;
  transition: all 0.15s ease;
  background: var(--card);
}

.check.on {
  background: var(--primary-deep);
  border-color: var(--primary-deep);
  color: #fff;
}

.main {
  flex: 1;
  min-width: 0;
  padding: 2px 0;
}

.title-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.title {
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title.done {
  text-decoration: line-through;
  color: var(--text-dim);
}

.meta-line {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 2px;
  flex-wrap: wrap;
}

.time-badge {
  font-size: 11.5px;
  color: var(--text-dim);
  background: rgba(0, 0, 0, 0.04);
  border-radius: 6px;
  padding: 1px 7px;
}

.late-text {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--danger);
}

.sub-count {
  font-size: 11.5px;
  color: var(--primary-deep);
  background: color-mix(in srgb, var(--primary) 40%, transparent);
  border-radius: 6px;
  padding: 1px 7px;
}

.proj-mini {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  border-radius: 6px;
  padding: 1px 7px;
}

.onekey {
  font-size: 11px;
  font-weight: 700;
  color: var(--primary-deep);
  background: var(--primary);
  border-radius: 999px;
  padding: 1px 9px;
  flex: none;
}

.focus-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: var(--accent-deep);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  flex: none;
}

.task-row.overdue > .main .title {
  color: var(--danger);
}

.pri-bar {
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 4px;
  border-radius: 0 3px 3px 0;
}

.pri-bar.pri-high {
  background: #ef4444;
}

.pri-bar.pri-medium {
  background: #eab308;
}

.pri-bar.pri-low {
  background: #3b82f6;
}

.children {
  margin-left: 22px;
  border-left: 1px dashed var(--line);
}
</style>
