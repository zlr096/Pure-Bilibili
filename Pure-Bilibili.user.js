// ==UserScript==
// @name         Pure Bilibili
// @name:zh-CN   B站纯净模式
// @namespace    https://github.com/zlr096/Pure-Bilibili
// @version      1.7.1
// @description  Blocks all non-video content, eliminates ads, enhances video playback, and provides silent preloading for a smooth, elegant Bilibili experience.
// @description:zh-CN  屏蔽一切非视频卡片，让b站不再充斥牛皮藓广告，视频增强，无感预加载，回归优雅丝滑体验。
// @author       ZLR & Assistant
// @license      MIT
// @match        https://www.bilibili.com/*
// @grant        none
// @run-at       document-start
// @downloadURL https://update.greasyfork.org/scripts/587162/Pure%20Bilibili.user.js
// @updateURL https://update.greasyfork.org/scripts/587162/Pure%20Bilibili.meta.js
// ==/UserScript==

// =========================================
//  📌 用户配置区域
//  修改后刷新页面即可生效
// =========================================
const CONFIG = {
    // ---------- 屏蔽开关 ----------
    block: {
        // true=移除顶部轮播图，false=保留
        carousel: true,
    },

    // ---------- 播放增强 ----------
    player: {
        // true=自动切换宽屏，false=不切换
        auto_widescreen: true,
        // true=自动网页全屏，false=不切换
        auto_web_fullscreen: false,
        // true=自动全屏，false=不切换
        auto_fullscreen: false,
        // true=自动播放，false=不自动播放
        auto_play: false,
        // 按 J 键快进秒数（跳过片头用）
        jump_op: 85,
        // 按逗号/句号逐帧步长（秒），0.016≈1帧
        frame_step: 0.016,
        // Shift+逗号/句号 变速步长（倍速）
        speed_step: 0.25,
    },

    // ---------- 预加载 ----------
    preload: {
        // true=启用预加载，false=关闭
        enabled: true,
        // 首次加载批数（每批约6-8个视频），数字越大首屏越饱满
        initial_rounds: 2,
        // 首次加载每批间隔（毫秒），太小可能被限制
        initial_interval: 600,
        // 距离底部多少像素时开始预加载（越大越早触发）
        scroll_threshold: 1200,
        // 滚动触发后连续加载批数
        scroll_rounds: 3,
        // 滚动加载每批间隔（毫秒）
        scroll_interval: 300,
    },
};

let cleanTimer = null;

(function() {
    const style = document.createElement('style');
    style.textContent = `
        .recommended-swipe { display: none !important; }
        .bili-live-card,
        .bili-live-card__wrap { display: none !important; }
    `;
    document.documentElement.appendChild(style);
})();

function getGridItem(element) {
    let container = element.closest('.feed-card');
    if (container) return container;
    container = element.closest('.bili-feed-card') ||
                element.closest('.floor-single-card') ||
                element.closest('.bili-video-card') ||
                element.closest('.bili-live-card');
    if (container) return container;
    return element.parentElement && element.parentElement.children.length === 1 && element.parentElement.children[0] === element
        ? element.parentElement
        : element;
}

function isNormalVideo(card) {
    return !!card.querySelector('a[href*="/video/"]');
}

function isEventCard(card) {
    const title = card.querySelector('.floor-title');
    return title && title.textContent.trim() === '赛事';
}

function shouldHideCard(card) {
    if (isNormalVideo(card) && !isEventCard(card)) {
        return false;
    }
    return true;
}

const processedSet = new WeakSet();

function hideCardIfNeeded(card) {
    if (card.querySelector('.bili-video-card__skeleton, .bili-live-card__skeleton')) return;
    if (processedSet.has(card)) return;
    processedSet.add(card);
    const container = getGridItem(card);
    if (container) {
        container.style.display = shouldHideCard(card) ? 'none' : '';
    }
}

function cleanAll() {
    if (CONFIG.block.carousel) {
        document.querySelector('.recommended-swipe')?.remove();
    }
    document.querySelectorAll('.bili-video-card, .bili-live-card, .bili-live-card__wrap, .floor-single-card')
        .forEach(card => hideCardIfNeeded(card));
}

function hideNonVideos() {
    if (CONFIG.block.carousel) {
        document.querySelector('.recommended-swipe')?.remove();
    }
    const selector = '.bili-video-card, .bili-live-card, .bili-live-card__wrap, .floor-single-card';
    document.querySelectorAll(selector).forEach(card => {
        if (card.querySelector('.bili-video-card__skeleton, .bili-live-card__skeleton')) return;
        const container = getGridItem(card);
        container.style.display = shouldHideCard(card) ? 'none' : '';
    });
}

function processNewNodes(nodes) {
    const selector = '.bili-video-card, .bili-live-card, .bili-live-card__wrap, .floor-single-card';
    let hasNewCards = false;
    for (const node of nodes) {
        if (node.nodeType !== 1) continue;
        let cards = [];
        if (node.matches && node.matches(selector)) {
            cards = [node];
        } else if (node.querySelectorAll) {
            cards = node.querySelectorAll(selector);
        }
        for (const card of cards) {
            const container = getGridItem(card);
            container.style.display = 'none';
            hasNewCards = true;
        }
    }
    if (hasNewCards) {
        clearTimeout(cleanTimer);
        cleanTimer = setTimeout(hideNonVideos, 100);
    }
}

let isLoading = false;

function triggerLoad() {
    const anchor = document.querySelector('.load-more-anchor');
    if (!anchor) return false;
    const oldStyle = anchor.getAttribute('style') || '';
    anchor.style.setProperty('position', 'fixed', 'important');
    anchor.style.setProperty('top', '50%', 'important');
    anchor.style.setProperty('left', '50%', 'important');
    anchor.style.setProperty('z-index', '-9999', 'important');
    anchor.style.setProperty('visibility', 'visible', 'important');
    window.dispatchEvent(new Event('scroll'));
    setTimeout(() => {
        anchor.setAttribute('style', oldStyle);
    }, 100);
    return true;
}

function loadMore(rounds, interval) {
    if (isLoading || rounds < 1) return;
    isLoading = true;
    let count = 0;
    function next() {
        if (count >= rounds) {
            isLoading = false;
            return;
        }
        count++;
        if (!triggerLoad()) {
            isLoading = false;
            return;
        }
        setTimeout(next, interval);
    }
    next();
}

function initialPreload() {
    if (!CONFIG.preload.enabled) return;
    setTimeout(() => loadMore(CONFIG.preload.initial_rounds, CONFIG.preload.initial_interval), 1000);
}

let scrollTimer = null;
function onScroll() {
    if (!CONFIG.preload.enabled) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
        const { scrollY, innerHeight } = window;
        const docHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
        if (docHeight - (scrollY + innerHeight) < CONFIG.preload.scroll_threshold) {
            loadMore(CONFIG.preload.scroll_rounds, CONFIG.preload.scroll_interval);
        }
    }, 100);
}

let playerReady = false;
function applyPlayer() {
    if (playerReady) return;
    const video = document.querySelector('video');
    if (!video) return;
    playerReady = true;
    const p = CONFIG.player;
    function tryClick(ariaLabel, expectedState) {
        let attempts = 0;
        const maxAttempts = 10;
        const interval = 200;
        function check() {
            const btn = document.querySelector(`[aria-label="${ariaLabel}"]`);
            if (btn) {
                const label = btn.getAttribute('aria-label') || '';
                if (expectedState && label.includes(expectedState)) return true;
                btn.click();
                return true;
            }
            attempts++;
            if (attempts < maxAttempts) setTimeout(check, interval);
            return false;
        }
        check();
    }
    if (p.auto_widescreen) tryClick('宽屏', '退出');
    if (p.auto_web_fullscreen) tryClick('网页全屏', '退出');
    if (p.auto_fullscreen) tryClick('全屏', '退出');
    if (p.auto_play) {
        const playBtn = document.querySelector('.bpx-player-ctrl-btn.bpx-player-ctrl-play');
        if (playBtn && playBtn.getAttribute('aria-label').includes('播放')) playBtn.click();
    }
    document.addEventListener('keydown', e => {
        const video = document.querySelector('video');
        if (!video || e.target.closest('input, textarea, [contenteditable="true"]')) return;
        switch (e.code) {
            case 'KeyJ':
                e.preventDefault();
                video.currentTime += p.jump_op;
                break;
            case 'Comma':
                e.preventDefault();
                if (e.shiftKey) video.playbackRate = Math.max(0.1, video.playbackRate - p.speed_step);
                else video.currentTime -= p.frame_step;
                break;
            case 'Period':
                e.preventDefault();
                if (e.shiftKey) video.playbackRate = Math.min(4, video.playbackRate + p.speed_step);
                else video.currentTime += p.frame_step;
                break;
        }
    });
}

function watchPlayer() {
    if (!location.pathname.includes('/video/')) return;
    [300, 800, 1500, 3000, 5000].forEach(d => setTimeout(applyPlayer, d));
    const observer = new MutationObserver(() => {
        if (!playerReady && document.querySelector('video')) applyPlayer();
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

let inited = false;
let earlyCleaned = false;

function earlyClean() {
    if (earlyCleaned) return;
    earlyCleaned = true;
    if (CONFIG.block.carousel) document.querySelector('.recommended-swipe')?.remove();
    cleanAll();
}

const bodyObserver = new MutationObserver(() => {
    if (document.body) {
        bodyObserver.disconnect();
        earlyClean();
        init();
    }
});
bodyObserver.observe(document.documentElement, { childList: true });

function init() {
    if (inited) return;
    inited = true;
    if (!earlyCleaned) earlyClean();
    initialPreload();
    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            if (m.addedNodes.length) {
                processNewNodes(m.addedNodes);
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    setInterval(cleanAll, 10000);
    watchPlayer();
}
