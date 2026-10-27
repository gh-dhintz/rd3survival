// Loaded just before d3.min.js. d3's UMD wrapper does `window.d3 = window.d3 || {}` and copies
// itself onto that object, so on a page that already has a d3 (e.g. r2d3's v6) v5 would merge
// into it, and a d3 loaded later would merge into v5. Hide any existing d3 so v5 builds a fresh
// object; d3Survival.js keeps that object private and puts the page's d3 back.
window.__rd3survival_prev_d3 = window.d3;
window.d3 = undefined;
