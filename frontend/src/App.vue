<template>
  <div class="min-h-screen w-full bg-gray-100 dark:bg-gray-900 flex justify-center">
    <CandlestickChart />
    <ToolsSidebar />
  </div>
</template>

<script setup lang="ts">
import CandlestickChart from "./components/CandlestickChart.vue";
import ToolsSidebar from "./components/ToolsSidebar.vue";
</script>