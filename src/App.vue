<template>
  <div class="app-shell">
    <TopBar />
    <main class="page-wrap">
      <RouterView />
    </main>
    <BottomNav />
    <ConfirmDialog />
    <ToastHost />
    <FocusOverlay />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { store } from './store.js'
import TopBar from './components/layout/TopBar.vue'
import BottomNav from './components/layout/BottomNav.vue'
import ConfirmDialog from './components/ui/ConfirmDialog.vue'
import ToastHost from './components/ui/ToastHost.vue'
import FocusOverlay from './components/focus/FocusOverlay.vue'

onMounted(async () => {
  await store.init()
})
</script>
