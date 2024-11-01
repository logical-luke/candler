<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';

interface ImportStatus {
  symbol: string;
  timeframes: {
    [key: string]: {
      latestTimestamp: number;
      count: number;
    }
  };
}

const isLoading = ref(true);
const isDataFilling = ref(false);
const importStatus = ref<ImportStatus>({ symbol: '', timeframes: {} });

const totalTimeframes = 9; // Assuming 9 timeframes: 1m, 3m, 5m, 15m, 1h, 4h, 1d, 1w, 1M

const progress = computed(() => {
  const completedTimeframes = Object.keys(importStatus.value.timeframes).length;
  return (completedTimeframes / totalTimeframes) * 100;
});

const checkBackendStatus = async () => {
  try {
    const response = await axios.get('/api/status');
    isDataFilling.value = response.data.isDataFilling;
    importStatus.value = response.data.importStatus;
    isLoading.value = false;
    setTimeout(checkBackendStatus, 5000);
  } catch (error) {
    console.error('Error checking backend status:', error);
    setTimeout(checkBackendStatus, 5000);
  }
};

onMounted(() => {
  checkBackendStatus();
});
</script>

<template>
  <div class="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
    <div class="relative py-3 sm:max-w-xl sm:mx-auto w-full px-4 sm:px-0">
      <div class="absolute inset-0 bg-gradient-to-r from-cyan-400 to-light-blue-500 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
      <div class="relative bg-white shadow-lg sm:rounded-3xl sm:p-20 p-6">
        <div class="max-w-md mx-auto">
          <div class="divide-y divide-gray-200">
            <div class="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
              <h2 class="text-3xl font-extrabold text-gray-900">Binance Futures Data Import</h2>
              <div v-if="isLoading" class="flex items-center justify-center space-x-2">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p>Loading status, please wait...</p>
              </div>
              <div v-else>
                <div class="mb-4">
                  <p class="text-xl font-bold mb-2">Overall Progress:</p>
                  <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div class="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out" :style="{ width: `${progress}%` }"></div>
                  </div>
                  <p class="text-sm mt-1">{{ Math.round(progress) }}% Complete</p>
                </div>
                <div v-if="isDataFilling" class="flex items-center space-x-2 text-blue-600 mb-4">
                  <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span class="text-xl font-bold">Data is currently being filled...</span>
                </div>
                <p v-else class="text-xl font-bold mb-4 text-green-600">Data import complete</p>
                <p class="text-xl font-bold mb-4">Import Status:</p>
                <div v-for="(status, timeframe) in importStatus.timeframes" :key="timeframe" class="mb-4 p-4 bg-gray-50 rounded-lg shadow transition-all duration-300 hover:shadow-md">
                  <p class="font-semibold text-lg">{{ timeframe }}</p>
                  <p>Latest: {{ new Date(status.latestTimestamp).toLocaleString() }}</p>
                  <p>Count: {{ status.count.toLocaleString() }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>