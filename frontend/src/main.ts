import { createApp } from 'vue';
import App from './App.vue';
import './index.css';
import "primeicons/primeicons.css";
import PrimeVue from "primevue/config";
import Lara from '@primevue/themes/lara';
import Tooltip from 'primevue/tooltip';

const app = createApp(App);

app.use(PrimeVue, {
    theme: {
        preset: Lara,
        options: {
            darkModeSelector: '.dark',
            cssLayer: {
                name: 'primevue',
                order: 'tailwind-base, primevue, tailwind-utilities',
            }
        }
    }
});

app.directive('tooltip', Tooltip);

app.mount('#app');