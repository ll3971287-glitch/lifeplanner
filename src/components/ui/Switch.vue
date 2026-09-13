<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    class="switch"
    :class="{ on: modelValue }"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span class="knob" />
  </button>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.switch {
  width: 44px;
  height: 26px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.12);
  position: relative;
  transition: background 0.18s ease;
  flex: none;
}

.switch.on {
  background: var(--primary-deep);
}

.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.25);
  transition: transform 0.18s ease;
}

.switch.on .knob {
  transform: translateX(18px);
}
</style>
