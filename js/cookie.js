// ./js/cookie.js

document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('cookie-banner');
    const modal = document.getElementById('cookie-settings-modal');
    
    const acceptAllBtn = document.getElementById('accept-all');
    const rejectAllBtn = document.getElementById('reject-all');
    const openSettingsBtn = document.getElementById('open-settings');
    const saveSettingsBtn = document.getElementById('save-settings');
    // ↓ ↓ ↓ ここ、document.getElementById が抜けていたので修正しました ↓ ↓ ↓
    const closeSettingsBtn = document.getElementById('close-settings'); 

    const essentialCheckbox = document.getElementById('essential-cookies');
    const analyticsCheckbox = document.getElementById('analytics-cookies');

    const CONSENT_COOKIE_NAME = 'user_cookie_preferences';
    const GA_MEASUREMENT_ID = 'G-FBD5SLNCS6'; 

    // ★★★追加: gtag('config')が既に呼び出されたかを追跡するフラグ★★★
    let gtagConfigCalled = false; 

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

            // ★★★変更点: analytics_storageがgrantedになったらgtag('config')を呼び出す★★★
            // gtag('config')は一度だけ呼び出すようにする
            if (preferences.analytics && !gtagConfigCalled) {
                gtag('config', GA_MEASUREMENT_ID);
                console.log("gtag config call attempted.");
                gtagConfigCalled = true; // フラグを立てて、二重呼び出しを防ぐ
                console.log('gtag config called for analytics_storage: granted');
            }
            // ★★★変更点ここまで★★★

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
        updateGtagConsent(preferences); // 同意状況を更新
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
            // Cookieがない場合はバナーを表示し、デフォルト設定を適用
            preferences = getDefaultPreferences();
            banner.style.display = 'block';
            setBodyPadding(true);
            console.log('Cookie設定が未検出です。バナーを表示し、デフォルト（すべて拒否）で初期化します。');
        }
        
        // ★★★変更点: 初期ロード時にgtag('config')は呼び出さない。
        //           同意状況のアップデートのみ行う。
        updateGtagConsent(preferences);
        // もし保存された同意がanalytics: granted であれば、
        // 上記のupdateGtagConsent内でconfigが呼び出されるはず。
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
        essentialCheckbox.checked = true; // 必須は常にチェック

        modal.style.display = 'flex';
        banner.style.display = 'none';
        setBodyPadding(false);
    });

    saveSettingsBtn.addEventListener('click', () => {
        const prefs = {
            essential: true, // 必須は常にtrue
            analytics: analyticsCheckbox.checked,
        };
        saveAndApplyPreferences(prefs);
    });

    closeSettingsBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        // モーダルを閉じる際に、バナーが非表示のままならpaddingを解除
        if (banner.style.display === 'none') {
            setBodyPadding(false);
        }
    });

    // ページロード時に初期化を実行
    initializeConsent();
});