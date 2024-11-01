import {defineStore} from "pinia";
import axios from 'axios';

export type Interval = '1m' | '3m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';

export interface ImportStatus {
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

export const useChartStore = defineStore('chart', {
    state: () => ({
        chartData: [],
        selectedInterval: '1m',
        isLoading: true,
        startTime: Date.now() - 24 * 60 * 60 * 1000,
        endTime: Date.now(),
        importStatus: {
            symbol: '',
            timeframes: {},
            candlestickFilling: false,
            indicatorFilling: false,
            currentlyFillingTimeframe: null,
            currentlyFillingIndicator: null
        } as ImportStatus,
    }),
    actions: {
        async fetchChartData(start?: number, end?: number) {
            try {
                this.isLoading = true;
                const response = await axios.get('/api/candlesticks', {
                    params: {
                        symbol: 'BTC/USDT',
                        timeframe: this.selectedInterval,
                        startTime: start,
                        endTime: end
                    }
                });
                this.chartData = response.data.data;
            } catch (error) {
                console.error('Error fetching chart data:', error);
                this.chartData = [];
            } finally {
                this.isLoading = false;
            }
        },
        async fetchImportStatus() {
            try {
                const response = await axios.get('/api/status');
                this.importStatus = response.data.importStatus;
            } catch (error) {
                console.error('Error fetching import status:', error);
            }
        },
        async setInterval(interval: string) {
            this.selectedInterval = interval;
            await this.fetchChartData();
        },
        async handleDateRangeChange(start: number, end: number) {
            this.startTime = start;
            this.endTime = end;
            await this.fetchChartData(start, end);
        },
    },
});