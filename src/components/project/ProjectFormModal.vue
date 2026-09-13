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
      <span class="field-label">项目内容</span>
      <textarea v-model="form.desc" class="textarea" rows="3" placeholder="项目目标 / 内容说明（可选）" />
    </div>

    <div class="two-col">
      <div class="field">
        <span class="field-label">总工作量</span>
        <input v-model.number="form.totalWorkload" type="number" min="0" step="0.5" class="input" placeholder="如 40" />
      </div>
      <div class="field">
        <span class="field-label">工作量单位</span>
        <input v-model="form.workloadUnit" class="input" placeholder="小时" />
      </div>
    </div>

    <div class="field">
      <span class="field-label">进度统计规则</span>
      <SegControl
        :model-value="form.progressMode"
        :options="[{ label: '按完成任务数量', value: 'count' }, { label: '按累计时长', value: 'hours' }]"
        @update:model-value="form.progressMode = $event"
      />
      <p v-if="form.progressMode === 'hours'" class="muted rule-tip">按累计时长：请为子任务填写预计时长（小时），总工作量填写总小时数，进度按“已完成子任务时长 ÷ 总时长”计算。</p>
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
import { ref } from 'vue'
import { store } from '../../store.js'
import { fmtDate, parseDateStr } from '../../utils/date.js'
import { showToast } from '../../ui.js'
import SegControl from '../ui/SegControl.vue'
import TagPicker from '../form/TagPicker.vue'

const props = defineProps({
  project: { type: Object, default: null },
})

const emit = defineEmits(['close', 'saved'])

const editing = !!props.project

const form = ref({
  name: props.project ? props.project.name : '',
  type: props.project ? props.project.type : '学习',
  desc: props.project ? props.project.desc : '',
  totalWorkload: props.project ? props.project.totalWorkload ?? 0 : 0,
  workloadUnit: props.project ? props.project.workloadUnit : '小时',
  deadline: props.project ? props.project.deadline : null,
  tagIds: props.project ? [...(props.project.tagIds || [])] : [],
  progressMode: props.project ? props.project.progressMode || 'count' : 'count',
})

const err = ref('')

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
