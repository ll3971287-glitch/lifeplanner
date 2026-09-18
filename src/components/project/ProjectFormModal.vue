<template>
  <div class="project-form">
    <div class="field">
      <span class="field-label">项目名称 *</span>
      <input v-model="form.name" class="input" placeholder="如：毕业论文 / 官网改版" />
    </div>

    <div class="field">
      <span class="field-label">类型</span>
      <SegControl v-model="form.type" :options="[{ label: '学习', value: '学习' }, { label: '工作', value: '工作' }]" />
    </div>

    <div class="field">
      <span class="field-label">分类（列表页的分类标签）</span>
      <SegControl v-model="form.category" :options="catOptions" />
    </div>

    <div class="field">
      <span class="field-label">项目内容</span>
      <textarea v-model="form.desc" class="textarea" rows="3" placeholder="项目目标 / 内容说明（可选）" />
    </div>

    <div class="two-col">
      <div class="field">
        <span class="field-label">{{ form.progressMode === 'hours' ? '总工作量' : '总任务数（预设量）' }}</span>
        <input
          v-model.number="form.totalWorkload"
          type="number"
          min="0"
          step="0.5"
          class="input"
          :placeholder="form.progressMode === 'hours' ? '如 40' : '如 10'"
        />
      </div>
      <div class="field">
        <span class="field-label">{{ form.progressMode === 'hours' ? '工作量单位' : '单位' }}</span>
        <input v-model="form.workloadUnit" class="input" :placeholder="form.progressMode === 'hours' ? '小时' : '个'" />
      </div>
    </div>
    <p v-if="form.progressMode === 'count'" class="muted rule-tip">
      先设定这个项目一共计划做多少件事（总任务数），进度 = 已完成任务数 ÷ 总任务数。留空则按当前已建任务数计算。
    </p>

    <div class="field">
      <span class="field-label">进度统计规则</span>
      <SegControl
        :model-value="form.progressMode"
        :options="[{ label: '按任务数量统计', value: 'count' }, { label: '按预计时长统计', value: 'hours' }]"
        @update:model-value="form.progressMode = $event"
      />
      <p v-if="form.progressMode === 'count'" class="muted rule-tip">按任务数量统计：进度 = 已完成的任务数 ÷ 全部任务数（默认方式，随时可改）。</p>
      <p v-else class="muted rule-tip">按预计时长统计：请为任务填写预计时长（小时），总工作量填写总小时数，进度按“已完成任务时长 ÷ 总时长”计算。</p>
    </div>

    <div class="field">
      <span class="field-label">截止日期</span>
      <input type="date" class="input" :value="dateStr(form.deadline)" @change="form.deadline = $event.target.value ? parseDateStr($event.target.value) : null" />
    </div>

    <div class="field">
      <span class="field-label">标签</span>
      <TagPicker v-model="form.tagIds" />
    </div>

    <div v-if="err" class="err-text">{{ err }}</div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" @click="$emit('close')">取消</button>
      <button type="button" class="btn btn-primary" @click="save">保存</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { store } from '../../store.js'
import { fmtDate, parseDateStr } from '../../utils/date.js'
import { showToast } from '../../ui.js'
import SegControl from '../ui/SegControl.vue'
import { PROJECT_CATS, catOf } from '../../projectMeta.js'
import TagPicker from '../form/TagPicker.vue'

const props = defineProps({
  project: { type: Object, default: null },
  // 面板每次打开时重新装载数据（项目详情页 / 列表页共用，支持反复修改）
  open: { type: Boolean, default: true },
})

const emit = defineEmits(['close', 'saved'])

const editing = !!props.project

const catOptions = PROJECT_CATS.map((c) => ({ label: c.label, value: c.key }))

function buildForm(src) {
  return {
    name: src ? src.name : '',
    type: src ? src.type : '学习',
    category: src ? catOf(src) : 'project',
    desc: src ? src.desc : '',
    totalWorkload: src ? src.totalWorkload ?? 0 : 0,
    workloadUnit: src ? src.workloadUnit : '小时',
    deadline: src ? src.deadline : null,
    tagIds: src ? [...(src.tagIds || [])] : [],
    progressMode: src ? src.progressMode || 'count' : 'count',
  }
}

const form = ref(buildForm(props.project))
const err = ref('')

// 每次打开（或切换编辑对象）都重新装载，保证「二次修改」能看到最新数据
watch(
  () => [props.open, props.project],
  ([open]) => {
    if (!open) return
    form.value = buildForm(props.project)
    err.value = ''
  }
)

function dateStr(ts) {
  return ts == null ? '' : fmtDate(ts)
}

function save() {
  const name = form.value.name.trim()
  if (!name) {
    err.value = '请填写项目名称'
    return
  }
  const payload = {
    name,
    type: form.value.type,
    category: form.value.category,
    desc: form.value.desc,
    totalWorkload: Number(form.value.totalWorkload) || 0,
    workloadUnit: form.value.workloadUnit.trim() || '小时',
    deadline: form.value.deadline,
    tagIds: form.value.tagIds,
    progressMode: form.value.progressMode,
  }
  if (editing) {
    store.updateProject(props.project.id, payload)
    showToast('已保存')
  } else {
    store.addProject(payload)
    showToast('已创建项目')
  }
  emit('saved')
  emit('close')
}
</script>

<style scoped>
.project-form {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.err-text {
  color: var(--danger);
  font-size: 13px;
}

.rule-tip {
  margin: 6px 0 0;
  font-size: 12.5px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
