<template>
  <div v-if="tag" class="tag-detail">
    <header class="head-card card">
      <div class="row-between wrap gap8">
        <div class="row gap10">
          <span class="big-dot" :style="{ background: tag.color }" />
          <div>
            <h2 class="t-name">{{ tag.name }}</h2>
            <p class="muted">共 {{ totalCount }} 项关联</p>
          </div>
        </div>
        <div class="row gap6">
          <button type="button" class="btn btn-outline btn-sm" @click="editOpen = true">
            <Icon name="edit" :size="13" /> 编辑
          </button>
          <button type="button" class="btn btn-danger btn-sm" @click="doDelete">
            <Icon name="trash" :size="13" /> 删除标签
          </button>
        </div>
      </div>
    </header>

    <section class="card group-card">
      <h3 class="group-title">待办任务（{{ entities.todos.length }}）</h3>
      <div v-if="entities.todos.length" class="group-list">
        <button v-for="t in entities.todos" :key="t.id" type="button" class="row item" @click="router.push('/todos')">
          <span class="dot" :class="{ done: t.completed }" />
          <span class="item-title" :class="{ done: t.completed }">{{ t.title }}</span>
          <Icon name="chevronRight" :size="15" class="go-icon" />
        </button>
      </div>
      <p v-else class="muted empty-line">暂无关联任务</p>
    </section>

    <section class="card group-card">
      <h3 class="group-title">项目（{{ entities.projects.length }}）</h3>
      <div v-if="entities.projects.length" class="group-list">
        <button v-for="p in entities.projects" :key="p.id" type="button" class="row item" @click="router.push(`/projects/${p.id}`)">
          <span class="type-mini" :class="p.type === '工作' ? 'work' : 'study'">{{ p.type }}</span>
          <span class="item-title">{{ p.name }}</span>
          <Icon name="chevronRight" :size="15" class="go-icon" />
        </button>
      </div>
      <p v-else class="muted empty-line">暂无关联项目</p>
    </section>

    <section class="card group-card">
      <h3 class="group-title">项目任务（{{ entities.subTasks.length }}）</h3>
      <div v-if="entities.subTasks.length" class="group-list">
        <button v-for="s in entities.subTasks" :key="s.id" type="button" class="row item" @click="router.push(`/projects/${s.projectId}`)">
          <span class="dot" :class="{ done: s.completed }" />
          <span class="item-title" :class="{ done: s.completed }">{{ subLabel(s) }}</span>
          <Icon name="chevronRight" :size="15" class="go-icon" />
        </button>
      </div>
      <p v-else class="muted empty-line">暂无关联子任务</p>
    </section>

    <BaseModal :open="editOpen" title="编辑标签" @close="editOpen = false">
      <TagFormModal v-if="editOpen" :tag="tag" @close="editOpen = false" @saved="editOpen = false" />
    </BaseModal>
  </div>

  <EmptyState v-else icon="tag" text="标签不存在或已删除" hint="返回标签列表看看">
    <button type="button" class="btn btn-primary" style="margin-top: 14px" @click="router.push('/tags')">返回标签</button>
  </EmptyState>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store } from '../store.js'
import { tagEntities } from '../selectors.js'
import { tagOf } from '../selectors.js'
import { askConfirm, showToast } from '../ui.js'
import { ref } from 'vue'
import Icon from '../components/ui/Icon.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import TagFormModal from '../components/tag/TagFormModal.vue'

const route = useRoute()
const router = useRouter()

const editOpen = ref(false)

const tag = computed(() => tagOf(store.state, route.params.id))
const entities = computed(() => (tag.value ? tagEntities(store.state, tag.value.id) : { todos: [], projects: [], subTasks: [] }))
const totalCount = computed(() => entities.value.todos.length + entities.value.projects.length + entities.value.subTasks.length)

function subLabel(s) {
  const p = store.state.projects.find((x) => x.id === s.projectId)
  const name = s.title || s.name
  return p ? `${p.name} · ${name}` : name
}

async function doDelete() {
  const ok = await askConfirm({
    title: '删除标签',
    message: `删除「${tag.value.name}」后，将解除它在 ${totalCount.value} 处关联上的标记。`,
    danger: true,
    okText: '删除',
  })
  if (!ok) return
  store.deleteTag(tag.value.id)
  showToast('标签已删除')
  router.push('/tags')
}
</script>

<style scoped>
.tag-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.head-card {
  padding: 16px;
}

.big-dot {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  flex: none;
}

.t-name {
  margin: 0;
  font-size: 20px;
}

.group-card {
  padding: 14px;
}

.group-title {
  margin: 0 0 8px;
  font-size: 14.5px;
}

.group-list {
  display: flex;
  flex-direction: column;
}

.item {
  padding: 9px 2px;
  border-bottom: 1px solid var(--line);
  gap: 10px;
  text-align: left;
  width: 100%;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--primary-deep);
  flex: none;
}

.dot.done {
  background: var(--success);
}

.dot.st-doing {
  background: var(--primary-deep);
}

.dot.st-done {
  background: var(--success);
}

.dot.st-todo {
  background: var(--text-dim);
}

.type-mini {
  font-size: 10.5px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 999px;
  flex: none;
}

.type-mini.study {
  background: color-mix(in srgb, var(--primary) 45%, transparent);
  color: var(--primary-deep);
}

.type-mini.work {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent-deep);
}

.item-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.item-title.done {
  color: var(--text-dim);
  text-decoration: line-through;
}

.go-icon {
  color: var(--text-dim);
  flex: none;
}

.empty-line {
  padding: 4px 0;
}
</style>
