<template>
  <div class="flex items-center space-x-4">
    <div class="flex gap-2 items-center w-20">
      <i class="pi pi-calendar text-gray-500 dark:text-gray-400"></i>
      <span class="text-sm font-medium text-gray-500 dark:text-gray-400">Range:</span>
    </div>
    <SelectButton v-model="selectedRange" :options="availableRangeOptions" optionLabel="label"
                  option-disabled="disabled"
                  class="border border-gray-300 dark:border-gray-600"/>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import SelectButton from 'primevue/selectbutton';
import { type Interval, useChartStore } from "@/stores/chart";

const chartStore = useChartStore();

const allRangeOptions = [
  { label: '15m', value: 15 * 60 * 1000 },
  { label: '1h', value: 60 * 60 * 1000 },
  { label: '4h', value: 4 * 60 * 60 * 1000 },
  { label: '1d', value: 24 * 60 * 60 * 1000 },
  { label: '1w', value: 7 * 24 * 60 * 60 * 1000 },
  { label: '1M', value: 30 * 24 * 60 * 60 * 1000 },
  { label: '3M', value: 3 * 30 * 24 * 60 * 60 * 1000 },
  { label: '6M', value: 6 * 30 * 24 * 60 * 60 * 1000 },
  { label: '1Y', value: 365 * 24 * 60 * 60 * 1000 },
];

const getMinAllowedRange = (interval: Interval): number => {
  switch (interval) {
    case '1m':
    case '3m':
    case '5m':
      return 15 * 60 * 1000; // 15 minutes
    case '15m':
      return 60 * 60 * 1000; // 1 hour
    case '1h':
    case '4h':
      return 4 * 60 * 60 * 1000; // 4 hours
    case '1d':
    case '1w':
      return 7 * 24 * 60 * 60 * 1000; // 1 week
    case '1M':
      return 3 * 30 * 24 * 60 * 60 * 1000; // 3 months
    default:
      return 15 * 60 * 1000; // 15 minutes as default
  }
};

const getMaxAllowedRange = (interval: Interval): number => {
  switch (interval) {
    case '1m':
    case '3m':
    case '5m':
    case '15m':
      return 24 * 60 * 60 * 1000; // 1 day
    case '1h':
      return 7 * 24 * 60 * 60 * 1000; // 1 week
    case '4h':
      return 7 * 24 * 60 * 60 * 1000; // 1 week
    case '1d':
      return 3 * 30 * 24 * 60 * 60 * 1000; // 3 months
    case '1w':
      return 6 * 30 * 24 * 60 * 60 * 1000; // 6 months
    case '1M':
      return 365 * 24 * 60 * 60 * 1000; // 1 year
    default:
      return 365 * 24 * 60 * 60 * 1000; // 1 year as default
  }
};

const availableRangeOptions = computed(() => {
  const minAllowedRange = getMinAllowedRange(chartStore.selectedInterval as Interval);
  const maxAllowedRange = getMaxAllowedRange(chartStore.selectedInterval as Interval);

  return allRangeOptions.filter(option =>
    option.value >= minAllowedRange && option.value <= maxAllowedRange
  );
});

const getDefaultRange = () => {
  const validOptions = availableRangeOptions.value;
  // Choose the middle option as default
  return validOptions[Math.floor(validOptions.length / 2)] || allRangeOptions[3];
};

const selectedRange = ref(getDefaultRange());

watch(() => selectedRange.value,
    (newValue) => {
      if (newValue) {
        const now = new Date();
        const start = new Date(now.getTime() - newValue.value);
        chartStore.handleDateRangeChange(start.getTime(), now.getTime());
      } else {
        selectedRange.value = getDefaultRange();
      }
    },
    {immediate: true, flush: 'post'}
);

watch(() => chartStore.selectedInterval, () => {
  const defaultRange = getDefaultRange();
  if (defaultRange.value !== selectedRange.value.value) {
    selectedRange.value = defaultRange;
  }
});

onMounted(() => {
  selectedRange.value = getDefaultRange();
  const now = new Date();
  const start = new Date(now.getTime() - selectedRange.value.value);
  chartStore.handleDateRangeChange(start.getTime(), now.getTime());
});
</script>