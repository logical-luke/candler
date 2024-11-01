<script setup lang="ts">
import {ref, watch, onMounted} from "vue";

const isDarkTheme = ref(false);

const setDarkTheme = (value: boolean) => {
  isDarkTheme.value = value;
  localStorage.setItem("darkTheme", value.toString());
  if (value) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  emit('theme-changed', value);
};

const initializeTheme = () => {
  const storedTheme = localStorage.getItem("darkTheme");
  if (storedTheme !== null) {
    setDarkTheme(storedTheme === "true");
  } else {
    const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
    ).matches;
    setDarkTheme(prefersDark);
  }
};

const toggleTheme = () => {
  setDarkTheme(!isDarkTheme.value);
};

onMounted(() => {
  initializeTheme();
});

watch(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    (newValue) => {
      if (localStorage.getItem("darkTheme") === null) {
        setDarkTheme(newValue);
      }
    },
);

const emit = defineEmits(['theme-changed']);
</script>

<template>
  <button
      type="button"
      aria-label="Toggle Theme"
      class="flex items-center justify-center w-8 h-8  border border-gray-300 dark:border-gray-600 rounded-full p-5"
      @click="toggleTheme"
  >
    <span class="relative w-6 h-6 -ml-2 mt-2">
      <i v-if="!isDarkTheme"
         class="pi text-black pi-sun absolute inset-0 w-full h-full transition-opacity duration-300 ease-in-out"></i>
      <i v-else
         class="pi pi-moon text-white absolute inset-0 w-full h-full transition-opacity duration-300 ease-in-out"></i>
    </span>
  </button>
</template>