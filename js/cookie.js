document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('cookie-banner');
    const modal = document.getElementById('cookie-settings-modal');
    
    const acceptAllBtn = document.getElementById('accept-all');
    const rejectAllBtn = document.getElementById('reject-all');
    const openSettingsBtn = document.getElementById('open-settings');
    const saveSettingsBtn = document.getElementById('save-settings');
    const closeSettingsBtn = document.getElementById('close-settings');

    const essentialCheckbox = document.getElementById('essential-cookies');
    const analyticsCheckbox = document.getElementById('analytics-cookies');

    const CONSENT_COOKIE_NAME = 'user_cookie_preferences'; // 同意設定を保存するCookie名
    // ★★★ あなたのGoogleアナリティクス測定IDをここに記入してください (例: 'G-XXXXXXXXXX') ★★★
    const GA_MEASUREMENT_ID = 'G-FBD5SLNCS6'; 

    // --- Cookie ヘルパー関数 ---
    const setCookie = (name, value, days) => {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/; SameSite=Lax`;
    };

    const getCookie = (name) => {
        const nameEQ = `${name}=`;
        const ca = document.cookie.split(';');
        for(let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    };

    // --- Googleアナリティクス同意モード更新関数 ---
    const updateGtagConsent = (preferences) => {
        if (typeof gtag === 'function') {
            gtag('consent', 'update', {
                'analytics_storage': preferences.analytics ? 'granted' : 'denied',
                'functionality_storage': preferences.essential ? 'granted' : 'denied',
                'security_storage': 'granted', // セキュリティ関連は常に許可
            });
            console.log('Google Tag consent updated:', preferences);
        } else {
            console.warn('gtag関数が見つかりません。Googleアナリティクスが正しく読み込まれているか確認してください。');
        }
    };

    // --- bodyのpaddingを管理する関数（下部余白問題の解消） ---
    const setBodyPadding = (addPadding) => {
        const tempDisplay = banner.style.display;
        const tempVisibility = banner.style.visibility;
        banner.style.visibility = 'hidden';
        banner.style.display = 'block';
        const bannerHeight = banner.offsetHeight;
        banner.style.display = tempDisplay;
        banner.style.visibility = tempVisibility;
        
        if (addPadding) {
            document.body.style.paddingBottom = `${bannerHeight}px`;
        } else {
            document.body.style.paddingBottom = '';
        }
    };

    // --- 同意設定の保存と適用 ---
    const saveAndApplyPreferences = (preferences) => {
        setCookie(CONSENT_COOKIE_NAME, JSON.stringify(preferences), 365);
        updateGtagConsent(preferences);
        banner.style.display = 'none';
        modal.style.display = 'none';
        setBodyPadding(false);
        console.log('Cookie設定が保存され適用されました:', preferences);
    };

    // --- 初期デフォルト設定（必須のみ許可、他は拒否） ---
    const getDefaultPreferences = () => ({
        essential: true,
        analytics: false,
    });

    // --- ページロード時の初期処理 ---
    const initializeConsent = () => {
        const savedPrefs = getCookie(CONSENT_COOKIE_NAME);
        let preferences;

        if (savedPrefs) {
            preferences = JSON.parse(savedPrefs);
            banner.style.display = 'none';
            setBodyPadding(false);
        } else {
            preferences = getDefaultPreferences();
            banner.style.display = 'block';
            setBodyPadding(true);
            console.log('Cookie設定が未検出です。バナーを表示し、デフォルト（すべて拒否）で初期化します。');
        }
        updateGtagConsent(preferences);
    };

    // --- イベントリスナー設定 ---
    acceptAllBtn.addEventListener('click', () => {
        const prefs = { essential: true, analytics: true };
        saveAndApplyPreferences(prefs);
    });

    rejectAllBtn.addEventListener('click', () => {
        const prefs = { essential: true, analytics: false };
        saveAndApplyPreferences(prefs);
    });

    openSettingsBtn.addEventListener('click', () => {
        const savedPrefs = getCookie(CONSENT_COOKIE_NAME);
        const currentPrefs = savedPrefs ? JSON.parse(savedPrefs) : getDefaultPreferences();
        
        analyticsCheckbox.checked = currentPrefs.analytics;
        essentialCheckbox.checked = true;

        modal.style.display = 'flex';
        banner.style.display = 'none';
        setBodyPadding(false);
    });

    saveSettingsBtn.addEventListener('click', () => {
        const prefs = {
            essential: true,
            analytics: analyticsCheckbox.checked,
        };
        saveAndApplyPreferences(prefs);
    });

    closeSettingsBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // ページロード時に初期化を実行
    initializeConsent();
});