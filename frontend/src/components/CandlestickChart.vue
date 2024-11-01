<template>
  <div
      class="relative w-full h-[800px] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div
        class="absolute top-0 left-0 right-0 z-10 bg-white dark:bg-gray-800 p-4 flex gap-2 flex-wrap items-center justify-between border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center space-x-4 mb-2 sm:mb-0">
        <i class="pi pi-clock text-gray-500 dark:text-gray-400"></i>
        <span class="text-sm font-medium text-gray-500 dark:text-gray-400">Interval:</span>
        <SelectButton v-model="selectedInterval" :options="intervals"
                      @change="$emit('interval-change', selectedInterval.value)" optionLabel="label"
                      class="border border-gray-300 dark:border-gray-600"/>
      </div>
      <div class="flex items-center space-x-4 mb-2 sm:mb-0">
        <i class="pi pi-calendar text-gray-500 dark:text-gray-400"></i>
        <span class="text-sm font-medium text-gray-500 dark:text-gray-400">Range:</span>
        <SelectButton v-model="selectedRange" :options="rangeOptions" @change="handleRangeChange" optionLabel="label"
                      class="border border-gray-300 dark:border-gray-600"/>
      </div>
      <div class="flex items-center space-x-4">
        <Button :icon="isDataFilling ? 'pi pi-spin pi-spinner' : 'pi pi-check'"
                :class="isDataFilling ? 'p-button-warning' : 'p-button-success'"
                class="p-button-rounded border border-gray-300 dark:border-gray-600"
                v-tooltip.bottom="getStatusTooltip()"/>
        <ThemeToggle @theme-changed="updateChartTheme"/>
      </div>
    </div>
    <div ref="chartContainer" class="w-full h-full pt-20">
      <div v-if="!formattedData.length" class="flex items-center justify-center h-full">
        <div class="text-center text-gray-500 dark:text-gray-400">
          <i class="pi pi-chart-bar text-4xl mb-2"></i>
          <p class="text-lg font-medium">No data available</p>
          <p class="text-sm">Try changing the interval or date range</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted, watch, onUnmounted, type PropType} from 'vue';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  ColorType,
  type Time
} from 'lightweight-charts';
import SelectButton from 'primevue/selectbutton';
import Button from 'primevue/button';
import DatePicker from 'primevue/datepicker';
import ThemeToggle from "./ThemeToggle.vue";

interface ImportStatus {
  symbol: string;
  timeframes: {
    [key: string]: {
      latestTimestamp: number;
      count: number;
    }
  };
  candlestickFilling: boolean;
  indicatorFilling: boolean;
  currentlyFillingTimeframe: string | null;
  currentlyFillingIndicator: string | null;
}

const props = defineProps({
  data: {
    type: Array as PropType<any[]>,
    default: () => []
  },
  interval: {
    type: String,
    default: '1h'
  },
  isLoading: Boolean,
  importStatus: {
    type: Object as PropType<ImportStatus>,
    default: () => ({
      symbol: '',
      timeframes: {},
      candlestickFilling: false,
      indicatorFilling: false,
      currentlyFillingTimeframe: null,
      currentlyFillingIndicator: null
    })
  }
});

const emit = defineEmits(['interval-change', 'date-range-change']);

const chartContainer = ref<HTMLElement | null>(null);
const selectedInterval = ref({label: props.interval, value: props.interval});
const selectedRange = ref({label: 'Last 1h', value: '1h'});
let chart: IChartApi;
let candleSeries: ISeriesApi<"Candlestick">;

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

const rangeOptions = [
  {label: 'Last 15m', value: '15m'},
  {label: '1h', value: '1h'},
  {label: '4h', value: '4h'},
  {label: '1d', value: '1d'},
  {label: '1w', value: '1w'},
  {label: '1M', value: '1M'},
];

const isDataFilling = computed(() => {
  return props.importStatus.candlestickFilling ||
      props.importStatus.indicatorFilling ||
      Object.values(props.importStatus.timeframes).some(tf => tf.count === 0) ||
      props.importStatus.currentlyFillingTimeframe !== null;
});

function getStatusTooltip() {
  let tooltip = 'Import Status:\n';
  if (props.importStatus.candlestickFilling) {
    tooltip += 'Filling Candlesticks\n';
  }
  if (props.importStatus.indicatorFilling) {
    tooltip += 'Filling Indicators\n';
  }
  if (props.importStatus.currentlyFillingTimeframe) {
    tooltip += `Filling Timeframe: ${props.importStatus.currentlyFillingTimeframe}\n`;
  }
  if (props.importStatus.currentlyFillingIndicator) {
    tooltip += `Filling Indicator: ${props.importStatus.currentlyFillingIndicator}\n`;
  }
  Object.entries(props.importStatus.timeframes).forEach(([timeframe, status]) => {
    tooltip += `${timeframe}: ${new Date(status.latestTimestamp).toLocaleString()} (${status.count})\n`;
  });
  return tooltip.trim();
}

function updateChartTheme(isDark: boolean) {
  if (chart && candleSeries) {
    chart.applyOptions({
      layout: {
        background: {type: ColorType.Solid, color: isDark ? '#1e1e1e' : '#ffffff'},
        textColor: isDark ? '#d1d4dc' : 'rgba(33, 56, 77, 1)',
      },
      grid: {
        vertLines: {color: isDark ? '#2B2B43' : 'rgba(197, 203, 206, 0.5)'},
        horzLines: {color: isDark ? '#2B2B43' : 'rgba(197, 203, 206, 0.5)'},
      },
      rightPriceScale: {
        borderColor: isDark ? '#2B2B43' : 'rgba(197, 203, 206, 0.8)',
      },
    });

    candleSeries.applyOptions({
      upColor: isDark ? '#26a69a' : '#4CAF50',
      downColor: isDark ? '#ef5350' : '#FF5252',
      wickUpColor: isDark ? '#26a69a' : '#4CAF50',
      wickDownColor: isDark ? '#ef5350' : '#FF5252',
    });
  }
}

function handleRangeChange(event: { value: { value: string } }) {
  const now = new Date();
  const start = new Date(now.getTime() - parseTimeToMilliseconds(event.value.value));
  emit('date-range-change', start.getTime(), now.getTime());
}

function parseTimeToMilliseconds(timeString: string): number {
  const value = parseInt(timeString.slice(0, -1));
  const unit = timeString.slice(-1);
  switch (unit) {
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'w':
      return value * 7 * 24 * 60 * 60 * 1000;
    case 'M':
      return value * 30 * 24 * 60 * 60 * 1000; // Approximate
    default:
      return 0;
  }
}

onMounted(() => {
  if (chartContainer.value) {
    chart = createChart(chartContainer.value, {
      width: chartContainer.value.clientWidth,
      height: chartContainer.value.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    candleSeries = chart.addCandlestickSeries();
    updateChartData();
    updateChartTheme(document.documentElement.classList.contains('dark'));

    window.addEventListener('resize', handleResize);
  }
});

const formattedData = computed(() => {
  return props.data
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(item => {
        const candlestickDate: CandlestickData = {
          time: item.timestamp / 1000 as Time,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close
        };
        return candlestickDate;
      });
});

watch(() => formattedData.value, updateChartData, {deep: true});
watch(() => props.interval, (newInterval) => {
  selectedInterval.value = {label: newInterval, value: newInterval};
  updateChartData();
});

function updateChartData() {
  if (candleSeries && Array.isArray(formattedData.value)) {
    candleSeries.setData(formattedData.value);
  } else {
    console.error('Invalid data provided to CandlestickChart:', formattedData.value);
  }
}

function handleResize() {
  if (chartContainer.value && chart) {
    chart.applyOptions({
      width: chartContainer.value.clientWidth,
      height: chartContainer.value.clientHeight
    });
  }
}

onUnmounted(() => {
  if (chart) {
    chart.remove();
  }
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.p-selectbutton {
  display: flex;
  flex-grow: 1;
}

.p-selectbutton .p-button {
  flex: 1;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>