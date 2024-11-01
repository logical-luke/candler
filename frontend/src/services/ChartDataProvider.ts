import {useChartStore} from "@/stores/chart";

export class ChartDataProvider {
    private store = useChartStore();

    fetchChartData(start?: number, end?: number) {
        return this.store.fetchChartData(start, end);
    }

    fetchImportStatus() {
        return this.store.fetchImportStatus();
    }
}