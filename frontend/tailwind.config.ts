import tailwindcss_primeui from "tailwindcss-primeui";

/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  darkMode: ["selector"],
    theme: {
        extend: {},
    },
    plugins: [tailwindcss_primeui]
};
