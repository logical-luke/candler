<template>
  <div class="min-h-screen bg-gray-100 dark:bg-gray-900 py-6 flex flex-col justify-center sm:py-12">
    <div class="relative py-3 sm:mx-auto w-full px-4 sm:px-0 max-w-6xl">
      <div class="relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-xl">
        <CandlestickChart
            :data="chartData"
            :interval="selectedInterval"
            :isLoading="isLoading"
            :importStatus="importStatus"
            @interval-change="handleIntervalChange"
            @date-range-change="handleDateRangeChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import axios from 'axios';
import CandlestickChart from './components/CandlestickChart.vue';

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

const isLoading = ref(true);
const chartData = ref<any[]>([]);
const selectedInterval = ref('1h');
const importStatus = ref<ImportStatus>({
  symbol: '',
  timeframes: {},
  candlestickFilling: false,
  indicatorFilling: false,
  currentlyFillingTimeframe: null,
  currentlyFillingIndicator: null
});

const handleIntervalChange = (newInterval: string) => {
  selectedInterval.value = newInterval;
};

const handleDateRangeChange = async (start: number, end: number) => {
  try {
    isLoading.value = true;
    const response = await axios.get('/api/candlesticks', {
      params: {
        symbol: 'BTC/USDT',
        timeframe: selectedInterval.value,
        startTime: start,
        endTime: end
      }
    });
    chartData.value = response.data.data;
  } catch (error) {
    console.error('Error fetching chart data:', error);
    chartData.value = [];
  } finally {
    isLoading.value = false;
  }
};

const fetchChartData = async () => {
  try {
    isLoading.value = true;
    const response = await axios.get('/api/candlesticks', {
      params: {
        symbol: 'BTC/USDT',
        timeframe: selectedInterval.value
      }
    });
    chartData.value = response.data.data;
  } catch (error) {
    console.error('Error fetching chart data:', error);
    chartData.value = [];
  } finally {
    isLoading.value = false;
  }
};

const fetchImportStatus = async () => {
  try {
    const response = await axios.get('/api/status');
    importStatus.value = response.data.importStatus;
  } catch (error) {
    console.error('Error fetching import status:', error);
  }
};

onMounted(() => {
  fetchChartData();
  fetchImportStatus();
  setInterval(fetchImportStatus, 5000); // Update status every 5 seconds
});

watch(selectedInterval, fetchChartData);
</script>