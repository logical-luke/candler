<template>
  <div class="flex items-center space-x-4">
    <div class="flex gap-2 items-center w-20">
      <i class="pi pi-clock text-gray-500 dark:text-gray-400"></i>
      <span class="text-sm font-medium text-gray-500 dark:text-gray-400">Interval:</span>
    </div>
    <SelectButton v-model="selectedInterval" :options="intervals"
                  optionLabel="label"
                  class="border border-gray-300 dark:border-gray-600"/>
  </div>
</template>

<script setup lang="ts">
import {ref, watch} from 'vue';
import SelectButton from 'primevue/selectbutton';
import {useChartStore} from "@/stores/chart";

const chartStore = useChartStore();
const intervals = [
  {label: '1m', value: '1m'},
  {label: '3m', value: '3m'},
  {label: '5m', value: '5m'},
  {label: '15m', value: '15m'},
  {label: '1h', value: '1h'},
  {label: '4h', value: '4h'},
  {label: '1d', value: '1d'},
  {label: '1w', value: '1w'},
  {label: '1M', value: '1M'}
];

const selectedInterval = ref(intervals.find(i => i.value === chartStore.selectedInterval) || intervals[0]);
const lastValidInterval = ref(selectedInterval.value);

watch(() => selectedInterval.value,
    (newValue) => {
      if (newValue) {
        chartStore.setInterval(newValue.value);
        lastValidInterval.value = newValue;
      } else {
        selectedInterval.value = lastValidInterval.value;
      }
    },
{immediate: true, flush: 'post'}
);
</script>