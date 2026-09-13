<template>
  <div class="tag-form">
    <div class="row gap8">
      <input v-model="form.name" class="input" placeholder="标签名称，如：学习 / 重要" @keyup.enter="save" />
    </div>
    <div class="field">
      <span class="field-label">颜色</span>
      <div class="color-row">
        <button
          v-for="c in TAG_COLORS"
          :key="c"
          type="button"
          class="color-dot"
          :class="{ on: form.color === c }"
          :style="{ background: c }"
          @click="form.color = c"
        />
      </div>
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
import { TAG_COLORS } from '../../theme.js'
import { showToast } from '../../ui.js'

const props = defineProps({
  tag: { type: Object, default: null },
})

const emit = defineEmits(['close', 'saved'])

const editing = !!props.tag

const form = ref({
  name: props.tag ? props.tag.name : '',
  color: props.tag ? props.tag.color : TAG_COLORS[0],
})

const err = ref('')

function save() {
  const name = form.value.name.trim()
  if (!name) {
    err.value = '请输入标签名称'
    return
  }
  if (store.state.tags.some((t) => t.name === name && t.id !== (props.tag && props.tag.id))) {
    err.value = '已存在同名标签'
    return
  }
  if (editing) {
    store.updateTag(props.tag.id, { name, color: form.value.color })
    showToast('已保存')
  } else {
    store.addTag({ name, color: form.value.color })
    showToast('标签已创建')
  }
  emit('saved')
  emit('close')
}
</script>

<style scoped>
.tag-form {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.color-row {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
}

.color-dot {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid transparent;
}

.color-dot.on {
  border-color: var(--text);
  box-shadow: 0 0 0 3px var(--card), 0 0 0 4px var(--text);
}

.err-text {
  color: var(--danger);
  font-size: 13px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
