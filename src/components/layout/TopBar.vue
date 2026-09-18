<template>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="row gap6 head-left">
        <button v-if="!isSettings" type="button" class="top-btn menu-btn" aria-label="打开菜单" @click="openSideMenu">
          <Icon name="menu" :size="19" />
        </button>
        <h1 class="topbar-title">{{ title }}</h1>
      </div>
      <div v-if="isSettings" class="row gap4">
        <button type="button" class="top-btn" aria-label="关系" @click="$router.push('/relations')">
          <Icon name="heart" :size="18" />
        </button>
        <button type="button" class="top-btn" aria-label="未来蓝图" @click="$router.push('/blueprints')">
          <Icon name="flag" :size="18" />
        </button>
        <button class="top-btn" aria-label="标签" @click="$router.push('/tags')">
          <Icon name="tag" :size="18" />
        </button>
        <button class="top-btn" aria-label="复盘" @click="$router.push('/reviews')">
          <Icon name="refresh" :size="18" />
        </button>
        <button class="top-btn" aria-label="设置" @click="$router.push('/settings')">
          <Icon name="settings" :size="18" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../ui/Icon.vue'
import { openSideMenu } from '../../ui.js'

const route = useRoute()
const title = computed(() => route.meta.title || 'Ultimate Life System')
// 设置页保留原有顶部入口不变；其它页面只保留标题 + 左侧菜单按钮
const isSettings = computed(() => route.name === 'settings')
</script>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  background: linear-gradient(100deg, color-mix(in srgb, var(--card) 72%, var(--bg)), color-mix(in srgb, var(--primary) 26%, var(--card)) 55%, color-mix(in srgb, var(--accent) 10%, var(--card)));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}

.topbar-inner {
  max-width: var(--maxw);
  margin: 0 auto;
  height: var(--topbar-h);
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.head-left {
  align-items: center;
  min-width: 0;
}

.menu-btn {
  margin-left: -6px;
}

.topbar-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.topbar-title::before {
  content: '';
  width: 9px;
  height: 22px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--accent), var(--primary-deep));
  flex: none;
}

.top-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  color: var(--text-dim);
}

.top-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text);
}
</style>
