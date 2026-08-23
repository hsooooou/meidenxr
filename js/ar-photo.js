/**
 * シンプル写真撮影Webアプリ + 日時タイポグラフィ焼き込み + AR.js (Hiroマーカー)
 * 構成: index.html / style.css / script.js
 */

/**
 * AR.jsのコンテキストオブジェクトを安全に取得
 */
function getArContext(scene) {
  if (!scene) return null;
  if (scene.components && scene.components.arjs) {
    const c = scene.components.arjs;
    if (c._arToolkitContext) return c._arToolkitContext;
    if (c.arToolkitContext) return c.arToolkitContext;
  }
  if (scene.systems && scene.systems.arjs) {
    const s = scene.systems.arjs;
    if (s._arToolkitContext) return s._arToolkitContext;
    if (s.arToolkitContext) return s.arToolkitContext;
  }
  return null;
}

/**
 * AR.jsのソースオブジェクトを安全に取得
 */
function getArSource(scene) {
  if (!scene) return null;
  if (scene.components && scene.components.arjs) {
    const c = scene.components.arjs;
    if (c._arToolkitSource) return c._arToolkitSource;
    if (c.arToolkitSource) return c.arToolkitSource;
  }
  if (scene.systems && scene.systems.arjs) {
    const s = scene.systems.arjs;
    if (s._arToolkitSource) return s._arToolkitSource;
    if (s.arToolkitSource) return s.arToolkitSource;
  }
  return null;
}

/**
 * 実カメラ映像の物理入力Orientation（'portrait' | 'landscape'）を取得
 */
function getCameraInputOrientation(video) {
  if (!video || !video.videoWidth || !video.videoHeight) return 'landscape';
  return video.videoWidth < video.videoHeight ? 'portrait' : 'landscape';
}

/**
 * 画面表示 / ViewportのOrientation（'portrait' | 'landscape'）を取得
 */
function getDisplayOrientation() {
  if (window.screen && window.screen.orientation && window.screen.orientation.type) {
    return window.screen.orientation.type.startsWith('portrait') ? 'portrait' : 'landscape';
  }
  return window.innerWidth < window.innerHeight ? 'portrait' : 'landscape';
}

/**
 * 実カメラ映像と画面のOrientationをAR.jsのARControllerおよびArToolkitSourceと完全に同期
 */
function syncArOrientation(scene, video) {
  if (!scene || !video || !video.videoWidth || !video.videoHeight) return;

  const vW = video.videoWidth;
  const vH = video.videoHeight;
  const camInputOrientation = getCameraInputOrientation(video);
  const isPortrait = (camInputOrientation === 'portrait');

  // 1. ArToolkitSource のパラメータと内部状態の同期
  const arSource = getArSource(scene);
  if (arSource) {
    if (arSource.parameters) {
      if (isPortrait) {
        if (arSource.parameters.sourceWidth > arSource.parameters.sourceHeight) {
          const temp = arSource.parameters.sourceWidth;
          arSource.parameters.sourceWidth = arSource.parameters.sourceHeight;
          arSource.parameters.sourceHeight = temp;
        }
      } else {
        if (arSource.parameters.sourceWidth < arSource.parameters.sourceHeight) {
          const temp = arSource.parameters.sourceWidth;
          arSource.parameters.sourceWidth = arSource.parameters.sourceHeight;
          arSource.parameters.sourceHeight = temp;
        }
      }
    }
    if (typeof arSource.onResizeElement === 'function') {
      try {
        arSource.onResizeElement();
      } catch (e) {
        // ignore
      }
    }
  }

  // 2. AR.js の ARController の同期
  const arContext = getArContext(scene);
  if (arContext && arContext.arController) {
    const controller = arContext.arController;

    // orientation の同期
    if (typeof controller.setOrientation === 'function') {
      try {
        controller.setOrientation(camInputOrientation);
      } catch (e) {
        console.warn('arController.setOrientation failed:', e);
      }
    } else {
      controller.orientation = camInputOrientation;
    }
    if (controller.options) {
      controller.options.orientation = camInputOrientation;
    }

    // ARController の内部 videoWidth / videoHeight
    controller.videoWidth = vW;
    controller.videoHeight = vH;

    // ArToolkitSource から ARController の検出 canvas へサイズ同期
    if (arSource && typeof arSource.copyElementSizeTo === 'function' && controller.canvas) {
      try {
        arSource.copyElementSizeTo(controller.canvas);
      } catch (e) {
        // ignore
      }
    }

    // 検出 Canvas の縦横比を入力 Orientation と厳密に一致させる（非等方歪みの根本解消）
    if (controller.canvas) {
      if (isPortrait) {
        if (controller.canvas.width > controller.canvas.height) {
          const temp = controller.canvas.width;
          controller.canvas.width = controller.canvas.height;
          controller.canvas.height = temp;
        }
      } else {
        if (controller.canvas.width < controller.canvas.height) {
          const temp = controller.canvas.width;
          controller.canvas.width = controller.canvas.height;
          controller.canvas.height = temp;
        }
      }
    }
  }
}

/**
 * AR.jsのProjection MatrixとThree.js Cameraを安全に同期
 */
function syncArProjection(scene, video) {
  if (!scene || !scene.camera || !video || !video.videoWidth || !video.videoHeight) return;

  const vW = video.videoWidth;
  const vH = video.videoHeight;
  const cameraAspect = vW / vH;

  // Three.js Camera の aspect をカメラ生比率に設定
  scene.camera.aspect = cameraAspect;

  const arContext = getArContext(scene);
  if (arContext && typeof arContext.getProjectionMatrix === 'function') {
    const pMat = arContext.getProjectionMatrix();
    if (pMat && pMat.elements) {
      scene.camera.projectionMatrix.copy(pMat);

      if (scene.camera.projectionMatrixInverse) {
        scene.camera.projectionMatrixInverse.copy(scene.camera.projectionMatrix).invert();
      }
      return;
    }
  }

  scene.camera.updateProjectionMatrix();
}

/**
 * カメラ映像（AR.js Source）と A-Frame WebGL Canvas の座標系・cover表示領域を完全に同期
 */
function syncArCanvasAndVideo() {
  const scene = document.querySelector('a-scene');
  if (!scene) return;

  const arSource = getArSource(scene);
  const video = (arSource && arSource.domElement) || getActiveVideo();
  const aCanvas = (scene && scene.canvas) || document.querySelector('.a-canvas');
  if (!video || !video.videoWidth || !video.videoHeight || !aCanvas) return;

  const sW = window.innerWidth;
  const sH = window.innerHeight;
  const vW = video.videoWidth;
  const vH = video.videoHeight;

  // AR.js cover計算（カメラ生解像度のアスペクト比を完全維持）
  const scale = Math.max(sW / vW, sH / vH);
  const scaledW = Math.round(vW * scale);
  const scaledH = Math.round(vH * scale);
  const marginLeft = Math.round((sW - scaledW) / 2);
  const marginTop = Math.round((sH - scaledH) / 2);

  // VideoとCanvasのCSS配置・サイズ・マージンを完全一致
  video.style.position = 'absolute';
  video.style.top = '0px';
  video.style.left = '0px';
  video.style.width = scaledW + 'px';
  video.style.height = scaledH + 'px';
  video.style.marginLeft = marginLeft + 'px';
  video.style.marginTop = marginTop + 'px';

  aCanvas.style.position = 'absolute';
  aCanvas.style.top = '0px';
  aCanvas.style.left = '0px';
  aCanvas.style.width = scaledW + 'px';
  aCanvas.style.height = scaledH + 'px';
  aCanvas.style.marginLeft = marginLeft + 'px';
  aCanvas.style.marginTop = marginTop + 'px';

  // WebGL renderer drawingBuffer を Canvas CSS 表示比率に正確に一致させる
  if (scene.renderer) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    scene.renderer.setSize(scaledW, scaledH, false);
    scene.renderer.setPixelRatio(dpr);
  }

  // 実カメラOrientationとAR.js内部状態を同期
  syncArOrientation(scene, video);

  // Three.js Camera と AR.js Projection Matrix を実カメラ解像度・アスペクト比に同期
  syncArProjection(scene, video);

  // カメラズーム（Software Zoom）のCSS transformを反映
  applyCameraZoomToPreview();
}

/**
 * プレビュー用カメラ映像およびAR Canvasへカメラズーム（Software Zoom）のTransformを適用
 */
function applyCameraZoomToPreview() {
  const scene = document.querySelector('a-scene');
  const arSource = scene ? getArSource(scene) : null;
  const video = (arSource && arSource.domElement) || getActiveVideo();
  const aCanvas = (scene && scene.canvas) || document.querySelector('.a-canvas');

  const isUser = (currentFacingMode === 'user');
  const mirrorPart = isUser ? 'scaleX(-1) ' : '';
  const zoomPart = `scale(${cameraZoom})`;
  const transformVal = mirrorPart + zoomPart;

  if (video) {
    video.style.transform = transformVal;
    video.style.transformOrigin = 'center center';
  }
  if (aCanvas) {
    aCanvas.style.transform = zoomPart;
    aCanvas.style.transformOrigin = 'center center';
  }
}

/**
 * ズームHUD（1.0×〜3.0×）を表示し、一定時間後に自動で非表示化
 * 1.0× / 2.0× / 3.0× のみ大型表示（28px）
 * 1.0×のときのみ黄色系（#FFD84D）で強調し、基準値へ戻ったことを明確化
 * 中間値（1.5×, 1.9×, 2.1×等）は通常サイズ（18px）
 */
function showZoomHud(zoomValue) {
  if (!zoomIndicator || !zoomIndicatorText) return;

  // 表示値（小数点第1位に丸めた値）を基準にして判定と表示を完全一致させる
  const roundedZoom = Math.round(zoomValue * 10) / 10;
  const isBaseZoom = (roundedZoom === 1.0);
  const isDoubleZoom = (roundedZoom === 2.0);
  const isTripleZoom = (roundedZoom === 3.0);
  const isMilestone = isBaseZoom || isDoubleZoom || isTripleZoom;

  zoomIndicatorText.textContent = `${roundedZoom.toFixed(1)}×`;

  // 1.0× / 2.0× / 3.0× は大型表示
  if (isMilestone) {
    zoomIndicatorText.classList.add('is-milestone');
  } else {
    zoomIndicatorText.classList.remove('is-milestone');
  }

  // 1.0× のみ黄色アクセント
  if (isBaseZoom) {
    zoomIndicatorText.classList.add('is-base-zoom');
  } else {
    zoomIndicatorText.classList.remove('is-base-zoom');
  }

  zoomIndicator.classList.remove('hidden');

  if (zoomHudHideTimeout) {
    clearTimeout(zoomHudHideTimeout);
  }
  zoomHudHideTimeout = setTimeout(() => {
    if (zoomIndicator) {
      zoomIndicator.classList.add('hidden');
    }
  }, 1000);
}

/**
 * カメラズーム倍率をセット（1.0x 〜 3.0xの範囲でクランプしプレビューに反映）
 */
function setCameraZoom(newZoom, showHud = true) {
  cameraZoom = Math.min(MAX_CAMERA_ZOOM, Math.max(MIN_CAMERA_ZOOM, newZoom));
  applyCameraZoomToPreview();
  if (showHud) {
    showZoomHud(cameraZoom);
  }
}

/**
 * A-Frameのデフォルトリサイズ処理（windowサイズでdrawingBufferを歪める処理）をオーバーライド
 */
function hookSceneResizeHandler() {
  const scene = document.querySelector('a-scene');
  if (!scene) return;
  scene.resize = syncArCanvasAndVideo;

  const triggerSync = () => {
    scene.resize = syncArCanvasAndVideo;
    syncArCanvasAndVideo();
  };

  if (scene.hasLoaded) {
    triggerSync();
  } else {
    scene.addEventListener('loaded', triggerSync, { once: true });
    scene.addEventListener('render-target-loaded', triggerSync, { once: true });
  }

  // AR.js / A-Frame のライフサイクルイベントフック
  scene.addEventListener('camera-init', triggerSync);
  scene.addEventListener('arjs-video-loaded', triggerSync);
  window.addEventListener('arjs-video-loaded', triggerSync);
}

// DOM要素の取得
const cameraContainer = document.getElementById('camera-container');
const captureFrame = document.getElementById('capture-frame');
const photoPreview = document.getElementById('photo-preview');
const canvas = document.getElementById('photo-canvas');
const flashEffect = document.getElementById('flash-effect');
const statusMessage = document.getElementById('status-message');
const statusText = document.getElementById('status-text');
const retryCameraBtn = document.getElementById('retry-camera-btn');
const hiroMarker = document.getElementById('hiro-marker');
const kanjiMarker = document.getElementById('kanji-marker');
const arScene = document.getElementById('ar-scene');

// タイポグラフィCanvas要素（画面表示＆撮影共通レイヤー）
const typographyCanvas = document.getElementById('typography-canvas');

// メイン操作バー要素（5ボタン構成）
const captureControls = document.getElementById('capture-controls');
const reviewControls = document.getElementById('review-controls');
const shutterBtn = document.getElementById('shutter-btn');
const switchCameraBtn = document.getElementById('switch-camera-btn');
const resetArBtn = document.getElementById('reset-ar-btn');
const adjustBtn = document.getElementById('adjust-btn');
const helpBtn = document.getElementById('help-btn');

// サブメニュー要素
const resetSubmenu = document.getElementById('reset-submenu');
const adjustSubmenu = document.getElementById('adjust-submenu');
const resetArItem = document.getElementById('reset-ar-item');
const resetAdjustItem = document.getElementById('reset-adjust-item');
const resetSpecialItem = document.getElementById('reset-special-item');
const resetTextItem = document.getElementById('reset-text-item');
const closeResetSubmenuBtn = document.getElementById('close-reset-submenu-btn');
const adjustCameraItem = document.getElementById('adjust-camera-item');
const adjustSpecialItem = document.getElementById('adjust-special-item');
const adjustTextItem = document.getElementById('adjust-text-item');
const adjustCaptureSettingsItem = document.getElementById('adjust-capture-settings-item');
const closeAdjustSubmenuBtn = document.getElementById('close-adjust-submenu-btn');
const ratioOptionButtons = document.querySelectorAll('.ratio-opt-btn');
const timerOptionButtons = document.querySelectorAll('.timer-opt-btn');
const gridOptionButtons = document.querySelectorAll('.grid-opt-btn');
const timerSegmentedControl = document.querySelector('.timer-segmented-control');
const timerSegmentedIndicator = document.getElementById('timer-segmented-indicator');
const gridSegmentedControl = document.querySelector('.grid-segmented-control');
const gridSegmentedIndicator = document.getElementById('grid-segmented-indicator');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');

// 撮影ガイドオーバーレイ（構図グリッド・水平ガイド）
const cameraGuideOverlay = document.getElementById('camera-guide-overlay');
const cameraGridOverlay = document.getElementById('camera-grid-overlay');
const levelGuideOverlay = document.getElementById('level-guide-overlay');
const levelRollBar = document.getElementById('level-roll-bar');

// 撮影設定ボトムシート要素
const captureSettingsSheet = document.getElementById('capture-settings-sheet');
const captureSettingsDragHandleBtn = document.getElementById('capture-settings-drag-handle-btn');
const closeCaptureSettingsSheetBtn = document.getElementById('close-capture-settings-sheet-btn');

// 加工ボトムシート要素
const adjustmentSheet = document.getElementById('adjustment-sheet');
const sheetDragHandleBtn = document.getElementById('sheet-drag-handle-btn');
const closeAdjustmentSheetBtn = document.getElementById('close-adjustment-sheet-btn');
const btnResetAdjustment = document.getElementById('btn-reset-adjustment');
const sheetCurrentItemName = document.getElementById('sheet-current-item-name');
const sheetCurrentItemVal = document.getElementById('sheet-current-item-val');
const adjustmentSlider = document.getElementById('adjustment-slider');
const sliderBoundMinLabel = document.getElementById('slider-bound-min-label');
const sliderBoundMaxLabel = document.getElementById('slider-bound-max-label');
const sliderCenterMark = document.getElementById('slider-center-mark');
const sheetTabButtons = document.querySelectorAll('.sheet-tab-btn');
const specialPreviewCanvas = document.getElementById('special-preview-canvas');
const vignetteOverlay = document.getElementById('vignette-overlay');
const specialFxOverlay = document.getElementById('special-fx-overlay');
const noiseOverlayCanvas = document.getElementById('noise-overlay-canvas');

// リアルタイムSVGフィルタ要素
const feChromaRed = document.getElementById('fe-chroma-red');
const feChromaBlue = document.getElementById('fe-chroma-blue');
const feMosaicFlood = document.getElementById('fe-mosaic-flood');
const feMosaicComp = document.getElementById('fe-mosaic-comp');
const feMosaicMorph = document.getElementById('fe-mosaic-morph');

// 特殊加工ボトムシート要素
const specialAdjustmentSheet = document.getElementById('special-adjustment-sheet');
const specialSheetDragHandleBtn = document.getElementById('special-sheet-drag-handle-btn');
const closeSpecialSheetBtn = document.getElementById('close-special-sheet-btn');
const closeSpecialEmptyBtn = document.getElementById('close-special-empty-btn');
const btnResetSpecialEmpty = document.getElementById('btn-reset-special-empty');
const btnResetSpecialFx = document.getElementById('btn-reset-special-fx');
const specialEmptyContainer = document.getElementById('special-empty-container');
const specialActiveContainer = document.getElementById('special-active-container');
const specialCurrentItemName = document.getElementById('special-current-item-name');
const specialCurrentItemVal = document.getElementById('special-current-item-val');
const specialAdjustmentSlider = document.getElementById('special-adjustment-slider');
const specialTabsContainer = document.getElementById('special-tabs-container');
const specialTabButtons = document.querySelectorAll('#special-tabs-container .sheet-tab-btn');

// 文字編集ボトムシート要素
const typographySheet = document.getElementById('typography-sheet');
const typographyDragHandleBtn = document.getElementById('typography-drag-handle-btn');
const closeTypographySheetBtn = document.getElementById('close-typography-sheet-btn');
const btnResetTypography = document.getElementById('btn-reset-typography');
const typographyHeaderTitle = document.getElementById('typography-header-title');
const typographyCurrentFontName = document.getElementById('typography-current-font-name');
const fontCardsContainer = document.getElementById('font-cards-container');
const typographySizeContainer = document.getElementById('typography-size-container');
const typographySizeSlider = document.getElementById('typography-size-slider');
const typographyColorContainer = document.getElementById('typography-color-container');
const typeTabNone = document.getElementById('type-tab-none');
const typeTabFont = document.getElementById('type-tab-font');
const typeTabSize = document.getElementById('type-tab-size');
const typeTabColor = document.getElementById('type-tab-color');
const typeTabAlign = document.getElementById('type-tab-align');
const typographyAnchorContainer = document.getElementById('typography-anchor-container');

// 使い方全画面オーバーレイ要素（新規独立UI基盤）
const usageOverlay = document.getElementById('usage-overlay');
const usageCloseBtn = document.getElementById('usage-close-btn');

// ズームHUD要素
const zoomIndicator = document.getElementById('zoom-indicator');
const zoomIndicatorText = document.getElementById('zoom-indicator-text');

// レビュー操作バー要素
const retakeBtn = document.getElementById('retake-btn');
const shareBtn = document.getElementById('share-btn');
const saveBtn = document.getElementById('save-btn');

// アプリ状態
let currentFacingMode = 'environment'; // 'environment' (背面) または 'user' (前面)
let selectedRatio = '3:4'; // '3:4', '9:16', '1:1'
let cameraZoom = 1.0; // カメラズーム倍率 (1.0x 〜 3.0x、AR scaleとは完全に独立)
const MIN_CAMERA_ZOOM = 1.0;
const MAX_CAMERA_ZOOM = 3.0;
let zoomHudHideTimeout = null;
let capturedImageDataUrl = null;
let activeSubmenu = null; // null | 'reset' | 'adjust'
let clockIntervalId = null;
let currentTimerSeconds = 0; // 0 (OFF), 3 (3s), 5 (5s), 10 (10s)
let isCountingDown = false; // カウントダウン中フラグ（二重撮影防止）
let countdownIntervalId = null;

// 構図グリッド・自動水平ガイド状態
let currentGridMode = 'off'; // 'off' | 'rule-of-thirds'
let isOrientationListening = false;
let isMotionListening = false;
let hasReceivedOrientationData = false;
let smoothRollAngle = 0;
let isLevelGuideActive = false; // 傾き検知による自動表示アクティブフラグ
let isLevelAligned = false;
let levelAlignedStartTime = null;
let isLevelDismissed = false; // 水平維持フェードアウト後の抑制フラグ

// 文字デザイン（字体）定義（一元管理スキーマ・フォント補正値含む）
const FONT_CONFIGS = [
  {
    id: 'default',
    name: 'Default',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontWeight: { day: 800, monthYear: 700, time: 500 },
    letterSpacing: { day: -0.025, monthYear: 0.12, time: 0.08 },
    dayScale: 1.0,
    monthYearScale: 1.0,
    timeScale: 1.0,
    dayToMyGap: 1.0,
    myToTimeGap: 1.0,
    previewDayScale: 1.0
  },
  {
    id: 'sans',
    name: 'Sans',
    fontFamily: 'Montserrat, "Arial Black", "Trebuchet MS", sans-serif',
    fontWeight: { day: 800, monthYear: 700, time: 600 },
    letterSpacing: { day: -0.01, monthYear: 0.10, time: 0.06 },
    dayScale: 0.94,
    monthYearScale: 0.94,
    timeScale: 0.94,
    dayToMyGap: 0.86,
    myToTimeGap: 0.98,
    previewDayScale: 1.0
  },
  {
    id: 'condensed',
    name: 'Condensed',
    fontFamily: '"Bebas Neue", "Impact", "Arial Narrow", sans-serif',
    fontWeight: { day: 700, monthYear: 700, time: 600 },
    letterSpacing: { day: 0.04, monthYear: 0.16, time: 0.08 },
    dayScale: 1.10,
    monthYearScale: 1.06,
    timeScale: 1.06,
    dayToMyGap: 0.74,
    myToTimeGap: 0.92,
    previewDayScale: 1.0
  },
  {
    id: 'modern',
    name: 'Modern',
    fontFamily: 'Cinzel, "Times New Roman", "Baskerville", serif',
    fontWeight: { day: 800, monthYear: 700, time: 600 },
    letterSpacing: { day: 0.02, monthYear: 0.16, time: 0.08 },
    dayScale: 1.03,
    monthYearScale: 0.98,
    timeScale: 0.98,
    dayToMyGap: 0.22,
    myToTimeGap: 0.98,
    previewDayScale: 1.0
  },
  {
    id: 'display',
    name: 'Display',
    fontFamily: 'Righteous, "Arial Black", sans-serif',
    fontWeight: { day: 700, monthYear: 700, time: 600 },
    letterSpacing: { day: 0.01, monthYear: 0.12, time: 0.06 },
    dayScale: 0.95,
    monthYearScale: 0.94,
    timeScale: 0.94,
    dayToMyGap: 0.85,
    myToTimeGap: 0.98,
    previewDayScale: 1.0
  },
  {
    id: 'mono',
    name: 'Mono',
    fontFamily: 'Space Mono, ui-monospace, "SF Mono", "Roboto Mono", monospace',
    fontWeight: { day: 700, monthYear: 700, time: 700 },
    letterSpacing: { day: 0, monthYear: 0.08, time: 0.04 },
    dayScale: 0.96,
    monthYearScale: 0.92,
    timeScale: 0.92,
    dayToMyGap: 0.78,
    myToTimeGap: 0.94,
    previewDayScale: 1.0
  },
  {
    id: 'serif',
    name: 'Serif',
    fontFamily: 'Playfair Display, Georgia, "Times New Roman", serif',
    fontWeight: { day: 700, monthYear: 700, time: 600 },
    letterSpacing: { day: -0.01, monthYear: 0.10, time: 0.06 },
    dayScale: 1.01,
    monthYearScale: 0.98,
    timeScale: 0.98,
    dayToMyGap: 0.84,
    myToTimeGap: 0.98,
    previewDayScale: 1.0
  },
  {
    id: 'elegant',
    name: 'Elegant',
    fontFamily: '"Cormorant Garamond", Georgia, "Times New Roman", serif',
    fontWeight: { day: 700, monthYear: 700, time: 600 },
    letterSpacing: { day: 0.02, monthYear: 0.14, time: 0.08 },
    dayScale: 1.12,
    monthYearScale: 1.05,
    timeScale: 1.05,
    dayToMyGap: 0.18,
    myToTimeGap: 0.94,
    previewDayScale: 1.0
  },
  {
    id: 'hand',
    name: 'Hand',
    fontFamily: 'Yomogi, "Klee One", "Comic Sans MS", cursive, sans-serif',
    fontWeight: { day: 700, monthYear: 700, time: 600 },
    letterSpacing: { day: -0.01, monthYear: 0.10, time: 0.06 },
    dayScale: 1.0,
    monthYearScale: 1.0,
    timeScale: 1.0,
    dayToMyGap: 1.0,
    myToTimeGap: 1.0,
    previewDayScale: 1.0
  },
  {
    id: 'round',
    name: 'Round',
    fontFamily: '"Zen Maru Gothic", "M PLUS Rounded 1c", sans-serif',
    fontWeight: { day: 700, monthYear: 700, time: 600 },
    letterSpacing: { day: -0.01, monthYear: 0.10, time: 0.06 },
    dayScale: 1.0,
    monthYearScale: 1.0,
    timeScale: 1.0,
    dayToMyGap: 1.0,
    myToTimeGap: 1.0,
    previewDayScale: 1.0
  },
  {
    id: 'mincho',
    name: 'Mincho',
    fontFamily: '"Shippori Mincho", "Noto Serif JP", "Yu Mincho", serif',
    fontWeight: { day: 700, monthYear: 700, time: 600 },
    letterSpacing: { day: -0.01, monthYear: 0.10, time: 0.06 },
    dayScale: 1.0,
    monthYearScale: 1.0,
    timeScale: 1.0,
    dayToMyGap: 1.0,
    myToTimeGap: 1.0,
    previewDayScale: 1.0
  },
  {
    id: 'classic',
    name: 'Classic',
    fontFamily: '"Zen Old Mincho", "Shippori Mincho", "Yu Mincho", serif',
    fontWeight: { day: 700, monthYear: 700, time: 600 },
    letterSpacing: { day: 0.02, monthYear: 0.12, time: 0.08 },
    dayScale: 1.0,
    monthYearScale: 1.0,
    timeScale: 1.0,
    dayToMyGap: 1.0,
    myToTimeGap: 1.0,
    previewDayScale: 1.0
  },
  {
    id: 'youth',
    name: 'Youth',
    fontFamily: '"Zen Kurenaido", "Klee One", "Yomogi", cursive, sans-serif',
    fontWeight: { day: 400, monthYear: 400, time: 400 },
    letterSpacing: { day: -0.01, monthYear: 0.10, time: 0.06 },
    dayScale: 1.0,
    monthYearScale: 1.0,
    timeScale: 1.0,
    dayToMyGap: 1.0,
    myToTimeGap: 1.0,
    previewDayScale: 1.0
  },
  {
    id: 'youth_hand',
    name: 'Youth Hand',
    fontFamily: '"Hachi Maru Pop", "Zen Kurenaido", "Yomogi", cursive, sans-serif',
    fontWeight: { day: 400, monthYear: 400, time: 400 },
    letterSpacing: { day: -0.01, monthYear: 0.08, time: 0.05 },
    dayScale: 1.0,
    monthYearScale: 1.0,
    timeScale: 1.0,
    dayToMyGap: 1.0,
    myToTimeGap: 1.0,
    previewDayScale: 1.0
  },
  {
    id: 'klee',
    name: 'Klee',
    fontFamily: '"Klee One", "Zen Maru Gothic", sans-serif',
    fontWeight: { day: 600, monthYear: 600, time: 600 },
    letterSpacing: { day: -0.01, monthYear: 0.10, time: 0.06 },
    dayScale: 1.0,
    monthYearScale: 1.0,
    timeScale: 1.0,
    dayToMyGap: 1.0,
    myToTimeGap: 1.0,
    previewDayScale: 1.0
  }
];

const FONT_CONFIGS_MAP = {};
FONT_CONFIGS.forEach((cfg) => {
  FONT_CONFIGS_MAP[cfg.id] = cfg;
});

let currentTypographyEnabled = true; // 文字表示の有効/無効（「文字なし」対応）
let currentSelectedFontId = 'default';
let currentTypographyScale = 1.0; // 0.50 ～ 1.50 (100%)
let currentTypographyColor = '#FFFFFF'; // 初期値 White (#FFFFFF)
let currentTypographyAnchor = 'bottom-right'; // 初期値 下右 (bottom-right)
let currentTypographySubtab = 'font'; // 'font' | 'size' | 'color' | 'align'

// 9点アンカー定義（一元管理スキーマ・1列9個 3グループ）
const ANCHOR_CONFIGS = [
  // Group 1: 上段 (Top)
  { id: 'top-left', name: '上左', group: 'top', groupLabel: '上段', row: 0, col: 0, h: 'left', v: 'top' },
  { id: 'top-center', name: '上中央', group: 'top', groupLabel: '上段', row: 0, col: 1, h: 'center', v: 'top' },
  { id: 'top-right', name: '上右', group: 'top', groupLabel: '上段', row: 0, col: 2, h: 'right', v: 'top' },

  // Group 2: 中央 (Center)
  { id: 'center-left', name: '中央左', group: 'center', groupLabel: '中央', row: 1, col: 0, h: 'left', v: 'center' },
  { id: 'center-center', name: '中央中央', group: 'center', groupLabel: '中央', row: 1, col: 1, h: 'center', v: 'center' },
  { id: 'center-right', name: '中央右', group: 'center', groupLabel: '中央', row: 1, col: 2, h: 'right', v: 'center' },

  // Group 3: 下段 (Bottom)
  { id: 'bottom-left', name: '下左', group: 'bottom', groupLabel: '下段', row: 2, col: 0, h: 'left', v: 'bottom' },
  { id: 'bottom-center', name: '下中央', group: 'bottom', groupLabel: '下段', row: 2, col: 1, h: 'center', v: 'bottom' },
  { id: 'bottom-right', name: '下右', group: 'bottom', groupLabel: '下段', row: 2, col: 2, h: 'right', v: 'bottom' } // Default
];

// 文字色定義（一元管理スキーマ・9色）
const COLOR_CONFIGS = [
  { id: 'white', name: 'White', hex: '#FFFFFF', checkColor: '#1A1A1A' },
  { id: 'black', name: 'Black', hex: '#111111', checkColor: '#FFFFFF' },
  { id: 'red', name: 'Red', hex: '#E5484D', checkColor: '#FFFFFF' },
  { id: 'orange', name: 'Orange', hex: '#F59E0B', checkColor: '#FFFFFF' },
  { id: 'yellow', name: 'Yellow', hex: '#EAB308', checkColor: '#1A1A1A' },
  { id: 'green', name: 'Green', hex: '#22C55E', checkColor: '#FFFFFF' },
  { id: 'blue', name: 'Blue', hex: '#3B82F6', checkColor: '#FFFFFF' },
  { id: 'purple', name: 'Purple', hex: '#8B5CF6', checkColor: '#FFFFFF' },
  { id: 'pink', name: 'Pink', hex: '#EC4899', checkColor: '#FFFFFF' }
];

// 画像加工パラメータ定義（一元管理スキーマ・10項目）
const ADJUSTMENT_CONFIGS = [
  {
    id: 'exposure',
    name: '露出',
    icon: 'exposure',
    min: -1.0,
    max: 1.0,
    step: 0.01,
    default: 0,
    hasCenterZero: true,
    format: (v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2))
  },
  {
    id: 'contrast',
    name: 'コントラスト',
    icon: 'contrast',
    min: -100,
    max: 100,
    step: 1,
    default: 0,
    hasCenterZero: true,
    format: (v) => (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`)
  },
  {
    id: 'saturation',
    name: '彩度',
    icon: 'palette',
    min: -100,
    max: 100,
    step: 1,
    default: 0,
    hasCenterZero: true,
    format: (v) => (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`)
  },
  {
    id: 'highlights',
    name: 'ハイライト',
    icon: 'brightness_high',
    min: -100,
    max: 100,
    step: 1,
    default: 0,
    hasCenterZero: true,
    format: (v) => (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`)
  },
  {
    id: 'shadows',
    name: 'シャドウ',
    icon: 'brightness_low',
    min: -100,
    max: 100,
    step: 1,
    default: 0,
    hasCenterZero: true,
    format: (v) => (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`)
  },
  {
    id: 'temperature',
    name: '色温度',
    icon: 'thermostat',
    min: -100,
    max: 100,
    step: 1,
    default: 0,
    hasCenterZero: true,
    format: (v) => (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`)
  },
  {
    id: 'tint',
    name: '色合い',
    icon: 'color_lens',
    min: -100,
    max: 100,
    step: 1,
    default: 0,
    hasCenterZero: true,
    format: (v) => (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`)
  },
  {
    id: 'sharpness',
    name: 'シャープ',
    icon: 'details',
    min: -100,
    max: 100,
    step: 1,
    default: 0,
    hasCenterZero: true,
    format: (v) => (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`)
  },
  {
    id: 'fade',
    name: 'フェード',
    icon: 'blur_on',
    min: -100,
    max: 100,
    step: 1,
    default: 0,
    hasCenterZero: true,
    format: (v) => (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`)
  },
  {
    id: 'vignette',
    name: 'ビネット',
    icon: 'vignette',
    min: 0,
    max: 100,
    step: 1,
    default: 0,
    hasCenterZero: false,
    format: (v) => `${Math.round(v)}`
  }
];

// ID引き用マップ
const ADJUSTMENT_CONFIGS_MAP = {};
ADJUSTMENT_CONFIGS.forEach((cfg) => {
  ADJUSTMENT_CONFIGS_MAP[cfg.id] = cfg;
});

// 現在の加工パラメータ値（初期状態はすべて0）
const adjustmentValues = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  highlights: 0,
  shadows: 0,
  temperature: 0,
  tint: 0,
  sharpness: 0,
  fade: 0,
  vignette: 0
};

let currentSelectedAdjustment = 'exposure';

// 特殊加工パラメータ定義（一元管理スキーマ・6項目・0〜100）
const SPECIAL_CONFIGS = [
  {
    id: 'threshold',
    name: '二階調',
    icon: 'contrast',
    min: 0,
    max: 100,
    step: 1,
    default: 0
  },
  {
    id: 'mosaic',
    name: 'モザイク',
    icon: 'grid_view',
    min: 0,
    max: 100,
    step: 1,
    default: 0
  },
  {
    id: 'blur',
    name: 'ブラー',
    icon: 'blur_on',
    min: 0,
    max: 100,
    step: 1,
    default: 0
  },
  {
    id: 'chromaticAberration',
    name: '色収差',
    icon: 'colorize',
    min: 0,
    max: 100,
    step: 1,
    default: 0
  },
  {
    id: 'posterize',
    name: 'ポスタライズ',
    icon: 'palette',
    min: 0,
    max: 100,
    step: 1,
    default: 0
  },
  {
    id: 'noise',
    name: 'ノイズ',
    icon: 'grain',
    min: 0,
    max: 100,
    step: 1,
    default: 0
  }
];

// 特殊加工ID引き用マップ
const SPECIAL_CONFIGS_MAP = {};
SPECIAL_CONFIGS.forEach((cfg) => {
  SPECIAL_CONFIGS_MAP[cfg.id] = cfg;
});

// 現在の特殊加工パラメータ値（初期状態はすべて0）
const specialEffectValues = {
  threshold: 0,
  mosaic: 0,
  blur: 0,
  chromaticAberration: 0,
  posterize: 0,
  noise: 0
};

// 各特殊加工項目がユーザーによって一度でも選択・操作されたかの管理（初回選択時の初期値50 vs 2個目以降の0判定）
const specialEffectTouched = {
  threshold: false,
  mosaic: false,
  blur: false,
  chromaticAberration: false,
  posterize: false,
  noise: false
};

let currentSelectedSpecial = null; // 開いた直後は null（未選択）

// 月名称（英語3文字）
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * 写真比率設定クラスマップ
 */
const RATIO_CLASSES = {
  '3:4': 'ratio-3-4',
  '9:16': 'ratio-9-16',
  '1:1': 'ratio-1-1'
};

/**
 * 現在アクティブなビデオ要素を取得（AR.jsのソースビデオを最優先で特定）
 */
function getActiveVideo() {
  const scene = document.querySelector('a-scene');
  const arSource = getArSource(scene);
  if (arSource && arSource.domElement) {
    return arSource.domElement;
  }
  return document.getElementById('arjs-video') ||
         document.getElementById('camera-feed') ||
         document.querySelector('video');
}

/**
 * 現在日時のパーツを取得
 */
function getCurrentDateTimeParts(dateObj = new Date()) {
  const day = String(dateObj.getDate());
  const month = MONTH_NAMES[dateObj.getMonth()];
  const year = String(dateObj.getFullYear());
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');

  return {
    day,
    month,
    year,
    monthYear: `${month} ${year}`,
    time: `${hours}:${minutes}`,
    dateObj
  };
}

/**
 * タイポグラフィCanvas（画面表示＆撮影共通レイヤー）への描画関数
 * 画面上のリアルタイム表示と撮影画像の合成で全く同一の描画ロジックを使用
 */
function renderTypographyToCanvas(targetCanvas, dateParts) {
  if (!targetCanvas || !captureFrame) return;
  const ctx = targetCanvas.getContext('2d');
  
  // 1. CSS表示サイズ（撮影フレーム基準）と devicePixelRatio の明確な分離
  const frameRect = captureFrame.getBoundingClientRect();
  const cssW = frameRect.width || (targetCanvas.width / (window.devicePixelRatio || 1));
  const cssH = frameRect.height || (targetCanvas.height / (window.devicePixelRatio || 1));
  const dpr = targetCanvas.width / cssW || (window.devicePixelRatio || 1);

  if (cssW <= 0 || cssH <= 0) return;

  // 内部ピクセルクリア（全解像度）
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  ctx.restore();

  // 「文字なし」設定時はクリア状態のまま終了（プレビューおよび撮影Canvas合成の両方で文字を非表示化）
  if (!currentTypographyEnabled) {
    return;
  }

  // 2. 高DPIトランスフォーム（CSSピクセル空間を基準に描画）
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 3. CSSピクセル基準でのデザイン値の厳密な計算（元のCSSデザインと1:1完全一致）
  const cssMinDim = Math.min(cssW, cssH);
  const padRight = Math.max(14, Math.min(0.052 * cssMinDim, 48));
  const padBottom = Math.max(14, Math.min(0.052 * cssMinDim, 48));

  // Day: font-size: clamp(54px, 24cqmin, 180px), line-height: 0.82, letter-spacing: -0.05em
  const dayFontSize = Math.max(54, Math.min(0.24 * cssMinDim, 180));

  // Sub Container: gap: clamp(2px, 0.8cqmin, 6px)
  const subGap = Math.max(2, Math.min(0.008 * cssMinDim, 6));

  // Month / Year: font-size: clamp(11px, 4.5cqmin, 28px), font-weight: 700, letter-spacing: 0.12em
  const myFontSize = Math.max(11, Math.min(0.045 * cssMinDim, 28));

  // Time: font-size: clamp(10px, 4.0cqmin, 24px), font-weight: 500, letter-spacing: 0.08em
  const timeFontSize = Math.max(10, Math.min(0.040 * cssMinDim, 24));

  const fontCfg = FONT_CONFIGS_MAP[currentSelectedFontId] || FONT_CONFIGS[0];
  const fontStack = fontCfg.fontFamily;
  const dayWeight = (fontCfg.fontWeight && fontCfg.fontWeight.day) || 800;
  const myWeight = (fontCfg.fontWeight && fontCfg.fontWeight.monthYear) || 700;
  const timeWeight = (fontCfg.fontWeight && fontCfg.fontWeight.time) || 500;
  const daySpacingFactor = (fontCfg.letterSpacing && fontCfg.letterSpacing.day !== undefined) ? fontCfg.letterSpacing.day : -0.025;
  const mySpacingFactor = (fontCfg.letterSpacing && fontCfg.letterSpacing.monthYear !== undefined) ? fontCfg.letterSpacing.monthYear : 0.12;
  const timeSpacingFactor = (fontCfg.letterSpacing && fontCfg.letterSpacing.time !== undefined) ? fontCfg.letterSpacing.time : 0.08;

  // 各フォント固有の視覚スケール＆隙間補正値（Default=1.0基準を完全保持）
  const dayScale = (fontCfg.dayScale !== undefined) ? fontCfg.dayScale : 1.0;
  const myScale = (fontCfg.monthYearScale !== undefined) ? fontCfg.monthYearScale : 1.0;
  const timeScale = (fontCfg.timeScale !== undefined) ? fontCfg.timeScale : 1.0;
  const dayToMyGapFactor = (fontCfg.dayToMyGap !== undefined) ? fontCfg.dayToMyGap : 1.0;
  const myToTimeGapFactor = (fontCfg.myToTimeGap !== undefined) ? fontCfg.myToTimeGap : 1.0;

  // スマートフォン縦向き（Portrait）時のDay → Month / Year 視覚余白調整（PC・横向きは基準1.0を完全維持）
  // 縦向き時の空きをさらに約25%引き締め（0.78 → 0.58）
  const isPortraitMobile = (cssH > cssW) && (window.innerWidth <= 768 || (window.matchMedia && window.matchMedia('(orientation: portrait)').matches));
  const portraitDayGapMultiplier = isPortraitMobile ? 0.58 : 1.0;

  // 全体サイズ倍率（currentTypographyScale: 0.50〜1.50）をフォント固有倍率の上に適用
  const userScale = (typeof currentTypographyScale === 'number' && currentTypographyScale > 0) ? currentTypographyScale : 1.0;
  const finalDayFontSize = dayFontSize * dayScale * userScale;
  const finalMyFontSize = myFontSize * myScale * userScale;
  const finalTimeFontSize = timeFontSize * timeScale * userScale;

  // 文字サイズ倍率に応じた非線形Day → Month / Year間隔補正（100%基準を完全維持し、拡大時の空きすぎを自然に圧縮）
  let sizeDependentGapMultiplier = 1.0;
  if (userScale >= 1.0) {
    const s = userScale - 1.0; // 0.0 〜 0.5 (100%〜150%)
    sizeDependentGapMultiplier = 1.0 - (0.36 * s) - (0.16 * s * s); // 100%: 1.00, 125%: 0.90, 150%: 0.78
  } else {
    const s = 1.0 - userScale; // 0.0 〜 0.5 (100%〜50%)
    sizeDependentGapMultiplier = 1.0 - (0.20 * s); // 100%: 1.00, 75%: 0.95, 50%: 0.90
  }

  const effectiveDayToMyGap = dayToMyGapFactor * portraitDayGapMultiplier * sizeDependentGapMultiplier;

  // 9点アンカー設定の解決（初期値: bottom-right）
  const anchorCfg = ANCHOR_CONFIGS.find(a => a.id === currentTypographyAnchor) || ANCHOR_CONFIGS[8];
  const hAlign = anchorCfg.h; // 'left' | 'center' | 'right'
  const vAlign = anchorCfg.v; // 'top' | 'center' | 'bottom'

  // 文字色（全体共通）
  ctx.fillStyle = currentTypographyColor || '#FFFFFF';
  ctx.textBaseline = 'bottom';

  // 水平位置（Left / Center / Right）および textAlign の決定
  const padH = padRight;
  const padV = padBottom;
  let targetX = cssW - padH;
  if (hAlign === 'left') {
    targetX = padH;
    ctx.textAlign = 'left';
  } else if (hAlign === 'center') {
    targetX = cssW / 2;
    ctx.textAlign = 'center';
  } else {
    targetX = cssW - padH;
    ctx.textAlign = 'right';
  }

  // 垂直間隔（フォント固有 × 縦向き補正 × サイズ補正）
  const deltaMyToTime = (finalTimeFontSize * 0.92) + (subGap * myToTimeGapFactor * userScale);
  const deltaDayToMy = (finalMyFontSize * 0.85 * effectiveDayToMyGap);

  // フォントグリフの実測（Ascent / Descent）を考慮した正確なBounding Boxと安全領域マージン計算
  ctx.font = `${dayWeight} ${finalDayFontSize}px ${fontStack}`;
  const dayMetrics = ctx.measureText(dateParts.day);
  const dayAscent = (dayMetrics.actualBoundingBoxAscent && dayMetrics.actualBoundingBoxAscent > 0)
    ? dayMetrics.actualBoundingBoxAscent
    : (finalDayFontSize * 0.78);

  ctx.font = `${timeWeight} ${finalTimeFontSize}px ${fontStack}`;
  const timeMetrics = ctx.measureText(dateParts.time);
  const timeDescent = (timeMetrics.actualBoundingBoxDescent && timeMetrics.actualBoundingBoxDescent > 0)
    ? timeMetrics.actualBoundingBoxDescent
    : (finalTimeFontSize * 0.18);

  // 垂直位置（Top / Center / Bottom）の決定
  let dayY, myY, timeY;
  if (vAlign === 'bottom') {
    // 下端アンカー（初期Default動作：下端padBottom基準を完全維持）
    timeY = cssH - padV;
    myY = timeY - deltaMyToTime;
    dayY = myY - deltaDayToMy;

    // 大きな文字サイズ等で上端または下端がフレーム外へ出る場合のみ最小限位置補正
    const currentTop = dayY - dayAscent;
    if (currentTop < padV) {
      const shiftDown = padV - currentTop;
      dayY += shiftDown;
      myY += shiftDown;
      timeY += shiftDown;
    }
  } else if (vAlign === 'top') {
    // 上端アンカー：Day頂点を正確に padV に合わせ、はみ出しを確実に防止
    dayY = padV + dayAscent;
    myY = dayY + deltaDayToMy;
    timeY = myY + deltaMyToTime;

    // 下端がフレーム外へ出る場合のみ最小限位置補正
    const currentBottom = timeY + timeDescent;
    if (currentBottom > cssH - padV) {
      const shiftUp = currentBottom - (cssH - padV);
      dayY -= shiftUp;
      myY -= shiftUp;
      timeY -= shiftUp;
    }
  } else {
    // 中央アンカー（撮影フレーム中央にTypographyグループ全体を幾何学的に配置）
    const totalGroupHeight = dayAscent + deltaDayToMy + deltaMyToTime + timeDescent;
    const groupTop = (cssH - totalGroupHeight) / 2;
    dayY = groupTop + dayAscent;
    myY = dayY + deltaDayToMy;
    timeY = myY + deltaMyToTime;

    // 上端・下端の安全領域クランプ（必要時のみ）
    const currentTop = dayY - dayAscent;
    if (currentTop < padV) {
      const shiftDown = padV - currentTop;
      dayY += shiftDown;
      myY += shiftDown;
      timeY += shiftDown;
    }
    const currentBottom = timeY + timeDescent;
    if (currentBottom > cssH - padV) {
      const shiftUp = currentBottom - (cssH - padV);
      dayY -= shiftUp;
      myY -= shiftUp;
      timeY -= shiftUp;
    }
  }

  // 1. Time
  ctx.font = `${timeWeight} ${finalTimeFontSize}px ${fontStack}`;
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${finalTimeFontSize * timeSpacingFactor}px`;
  }
  ctx.fillText(dateParts.time, targetX, timeY);

  // 2. Month / Year
  ctx.font = `${myWeight} ${finalMyFontSize}px ${fontStack}`;
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${finalMyFontSize * mySpacingFactor}px`;
  }
  ctx.fillText(dateParts.monthYear, targetX, myY);

  // 3. Day
  ctx.font = `${dayWeight} ${finalDayFontSize}px ${fontStack}`;
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${finalDayFontSize * daySpacingFactor}px`;
  }
  ctx.fillText(dateParts.day, targetX, dayY);

  ctx.restore();
}

/**
 * 画面上のタイポグラフィCanvasの解像度を撮影フレーム/カメラ出力解像度に1:1同期
 */
function syncTypographyCanvasSize() {
  if (!typographyCanvas || !captureFrame) return;
  const frameRect = captureFrame.getBoundingClientRect();
  if (frameRect.width <= 0 || frameRect.height <= 0) return;

  const video = getActiveVideo();
  let targetW, targetH;

  if (video && video.videoWidth && video.videoHeight) {
    // カメラ映像の解像度とフレーム切り抜き倍率から、撮影Canvasと全く同一のピクセル解像度を算出
    const containerRect = cameraContainer.getBoundingClientRect();
    const scale = Math.max(containerRect.width / video.videoWidth, containerRect.height / video.videoHeight);
    const cropW = frameRect.width / scale;
    const cropH = frameRect.height / scale;
    targetW = Math.round(cropW);
    targetH = Math.round(cropH);
  } else {
    // カメラ初期化前のフォールバック（Retina/高DPI解像度）
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    targetW = Math.round(frameRect.width * dpr);
    targetH = Math.round(frameRect.height * dpr);
  }

  if (typographyCanvas.width !== targetW || typographyCanvas.height !== targetH) {
    typographyCanvas.width = targetW;
    typographyCanvas.height = targetH;
  }

  updateRealtimeClock();
}

/**
 * リアルタイムの日時Canvas表示を更新
 */
function updateRealtimeClock() {
  if (!typographyCanvas) return;
  const parts = getCurrentDateTimeParts();
  renderTypographyToCanvas(typographyCanvas, parts);
}

/**
 * 時計タイマーの開始
 */
function startClock() {
  syncTypographyCanvasSize();
  if (clockIntervalId) clearInterval(clockIntervalId);
  clockIntervalId = setInterval(updateRealtimeClock, 1000);
}

/**
 * 時計タイマーの停止
 */
function stopClock() {
  if (clockIntervalId) {
    clearInterval(clockIntervalId);
    clockIntervalId = null;
  }
}

/**
 * AR.js初期化とカメラ準備の監視
 */
function initCameraHandling() {
  showStatus('カメラを起動中...', false);
  shutterBtn.disabled = true;

  const onCameraReady = (v) => {
    hideStatus();
    shutterBtn.disabled = false;
    startClock();
    syncArCanvasAndVideo();
    applyAdjustmentsToPreview();
    // カメラ準備完了と同時にセンサー監視を開始（パーミッション不要環境では即座に監視開始）
    startOrientationListener(false);

    // AR.js ARController の非同期生成に備えた確定同期パルス
    requestAnimationFrame(syncArCanvasAndVideo);
    setTimeout(syncArCanvasAndVideo, 100);
    setTimeout(syncArCanvasAndVideo, 300);
    setTimeout(syncArCanvasAndVideo, 600);
    setTimeout(syncArCanvasAndVideo, 1200);
  };

  const checkVideo = () => {
    const v = getActiveVideo();
    if (v) {
      v.style.pointerEvents = 'none';
    }
    const aCanvas = document.querySelector('.a-canvas');
    if (aCanvas) {
      aCanvas.style.pointerEvents = 'none';
    }
    if (v && v.readyState >= 2 && v.videoWidth > 0) {
      onCameraReady(v);
      return true;
    }
    if (v && !v._hasMetadataListener) {
      v._hasMetadataListener = true;
      const readyHandler = () => {
        v.style.pointerEvents = 'none';
        if (v.videoWidth > 0) {
          onCameraReady(v);
        }
      };
      v.addEventListener('loadedmetadata', readyHandler, { once: true });
      v.addEventListener('loadeddata', readyHandler, { once: true });
      v.addEventListener('canplay', readyHandler, { once: true });
      v.addEventListener('playing', readyHandler, { once: true });
    }
    return false;
  };

  if (!checkVideo()) {
    const checkInterval = setInterval(() => {
      if (checkVideo()) {
        clearInterval(checkInterval);
      }
    }, 150);

    setTimeout(() => {
      const v = getActiveVideo();
      if (!v || !v.videoWidth) {
        clearInterval(checkInterval);
        showStatus('カメラの起動に時間がかかっています。<br>ブラウザのカメラ使用許可を確認してください。', true);
      }
    }, 12000);
  }
}

/**
 * 端末およびカメラの対応能力に応じた最適なカメラConstraintsを取得（フォールバック付き）
 */
async function getCameraStreamWithOptimalResolution(facingMode = 'environment') {
  const constraintTiers = [
    // Tier 1: 4K〜FHDの高品質要求 (端末が対応可能な最大解像度を引き出す)
    {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920, max: 3840 },
        height: { ideal: 1080, max: 2160 }
      }
    },
    // Tier 2: FHD標準 (1920x1080)
    {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    },
    // Tier 3: HD標準 (1280x720)
    {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    },
    // Tier 4: デバイスデフォルト
    {
      audio: false,
      video: {
        facingMode: facingMode
      }
    },
    // Tier 5: 最低限のカメラ起動
    {
      audio: false,
      video: true
    }
  ];

  for (let i = 0; i < constraintTiers.length; i++) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraintTiers[i]);
      const track = stream.getVideoTracks()[0];
      if (track && track.getSettings) {
        const settings = track.getSettings();
        console.log(`[Camera] Acquired Tier ${i + 1}: ${settings.width}x${settings.height} (${settings.facingMode || facingMode})`);
      }
      return stream;
    } catch (err) {
      console.warn(`[Camera] Constraints Tier ${i + 1} failed:`, err);
    }
  }

  throw new Error('All camera constraints failed.');
}

/**
 * カメラの前面 / 背面切り替え
 */
async function switchCameraFacingMode() {
  const v = getActiveVideo();
  if (!v) return;

  showStatus('カメラを切り替え中...', false);
  shutterBtn.disabled = true;

  if (v.srcObject) {
    v.srcObject.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (e) {
        console.warn('Track stop error:', e);
      }
    });
  }

  try {
    const stream = await getCameraStreamWithOptimalResolution(currentFacingMode);
    v.srcObject = stream;

    if (currentFacingMode === 'user') {
      v.classList.add('mirrored');
    } else {
      v.classList.remove('mirrored');
    }

    await new Promise((resolve) => {
      if (v.readyState >= 2) {
        v.play().catch(() => {});
        resolve();
      } else {
        v.onloadedmetadata = () => {
          v.play().catch(() => {});
          resolve();
        };
      }
    });

    hideStatus();
    shutterBtn.disabled = false;
    // カメラ切り替え時はズームを1.0xへリセット（HUDは非表示でリセット）
    cameraZoom = 1.0;
    if (zoomIndicator) zoomIndicator.classList.add('hidden');
    syncArCanvasAndVideo();
    applyAdjustmentsToPreview();
  } catch (error) {
    console.error('カメラ切り替えエラー:', error);
    showStatus('カメラの切り替えに失敗しました。', true);
  }
}

/**
 * アスペクト比を変更する関数
 */
function setAspectRatio(ratioKey) {
  if (!RATIO_CLASSES[ratioKey]) return;

  selectedRatio = ratioKey;

  // 選択肢ボタンのアクティブ状態を切り替え
  ratioOptionButtons.forEach((btn) => {
    if (btn.dataset.ratio === ratioKey) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 撮影フレームの比率クラスを切り替え
  captureFrame.classList.remove('ratio-3-4', 'ratio-9-16', 'ratio-1-1');
  captureFrame.classList.add(RATIO_CLASSES[ratioKey]);

  // タイポグラフィCanvasの解像度と描画をフレームに即時同期
  requestAnimationFrame(() => {
    syncTypographyCanvasSize();
  });
}

/**
 * 横向き（Landscape）および縦幅が狭い画面でのサブメニューの画面内クランプ＆位置最適化
 */
function updateSubmenuPositionLandscape() {
  if (!activeSubmenu) return;

  const isLandscape = window.matchMedia('(orientation: landscape)').matches || (window.innerWidth > window.innerHeight);
  const currentPanel = (activeSubmenu === 'reset') ? resetSubmenu : ((activeSubmenu === 'adjust') ? adjustSubmenu : null);
  const triggerBtn = (activeSubmenu === 'reset') ? resetArBtn : ((activeSubmenu === 'adjust') ? adjustBtn : null);

  if (!currentPanel || !triggerBtn) return;

  if (!isLandscape) {
    // 縦向き（Portrait）時はインラインスタイルをリセットし、Portrait用CSSに完全委任
    currentPanel.style.top = '';
    currentPanel.style.bottom = '';
    currentPanel.style.transform = '';
    currentPanel.style.maxHeight = '';
    currentPanel.style.removeProperty('--arrow-top');
    return;
  }

  // 横向き（Landscape）：画面上下端と安全余白（safe-area含む）を計算
  const vh = window.innerHeight;
  const safeTop = 14;
  const safeBottom = 14;
  const maxAvailableHeight = Math.max(120, vh - safeTop - safeBottom);
  currentPanel.style.maxHeight = `${maxAvailableHeight}px`;

  // トリガーボタン/スロットの中心Y座標
  const triggerRect = triggerBtn.getBoundingClientRect();
  const triggerCenterY = triggerRect.top + triggerRect.height / 2;

  // パネルの描画高さを取得
  const panelHeight = currentPanel.offsetHeight || 220;

  // ボタン中心にパネル中心を揃える理想のTop位置（viewport基準）
  let idealTop = triggerCenterY - (panelHeight / 2);

  // 画面の上端・下端の安全領域内にクランプ（画面外へ飛び出さない）
  if (idealTop < safeTop) {
    idealTop = safeTop;
  } else if (idealTop + panelHeight > vh - safeBottom) {
    idealTop = Math.max(safeTop, vh - safeBottom - panelHeight);
  }

  // スロット（親要素）相対のTop位置に変換して適用
  const slotRect = triggerBtn.parentElement ? triggerBtn.parentElement.getBoundingClientRect() : triggerRect;
  const relativeTop = idealTop - slotRect.top;

  currentPanel.style.top = `${relativeTop}px`;
  currentPanel.style.transform = 'none';

  // 矢印（::after）がトリガーボタンの中心を正確に指すよう動的計算
  const arrowOffsetY = Math.max(14, Math.min(panelHeight - 14, triggerCenterY - idealTop));
  currentPanel.style.setProperty('--arrow-top', `${arrowOffsetY}px`);
}

/**
 * サブメニューを開く
 */
function openSubmenu(menuType) {
  closeAdjustmentSheet();
  closeSpecialSheet();
  closeTypographySheet();
  activeSubmenu = menuType;

  if (resetSubmenu) {
    resetSubmenu.classList.toggle('is-open', menuType === 'reset');
    resetSubmenu.classList.remove('hidden');
  }
  if (adjustSubmenu) {
    adjustSubmenu.classList.toggle('is-open', menuType === 'adjust');
    adjustSubmenu.classList.remove('hidden');
  }

  if (resetArBtn) {
    resetArBtn.classList.toggle('is-active', menuType === 'reset');
    resetArBtn.classList.toggle('active', menuType === 'reset');
    resetArBtn.setAttribute('aria-expanded', menuType === 'reset' ? 'true' : 'false');
  }
  if (adjustBtn) {
    adjustBtn.classList.toggle('is-active', menuType === 'adjust');
    adjustBtn.classList.toggle('active', menuType === 'adjust');
    adjustBtn.setAttribute('aria-expanded', menuType === 'adjust' ? 'true' : 'false');
  }

  requestAnimationFrame(() => {
    updateSubmenuPositionLandscape();
  });
}

/**
 * サブメニューを閉じる
 */
function closeSubmenu() {
  if (!activeSubmenu) return;

  if (resetSubmenu) {
    resetSubmenu.classList.remove('is-open');
    resetSubmenu.classList.add('hidden');
    resetSubmenu.style.top = '';
    resetSubmenu.style.bottom = '';
    resetSubmenu.style.transform = '';
    resetSubmenu.style.maxHeight = '';
    resetSubmenu.style.removeProperty('--arrow-top');
  }
  if (adjustSubmenu) {
    adjustSubmenu.classList.remove('is-open');
    adjustSubmenu.classList.add('hidden');
    adjustSubmenu.style.top = '';
    adjustSubmenu.style.bottom = '';
    adjustSubmenu.style.transform = '';
    adjustSubmenu.style.maxHeight = '';
    adjustSubmenu.style.removeProperty('--arrow-top');
  }

  if (resetArBtn) {
    resetArBtn.classList.remove('is-active');
    resetArBtn.classList.remove('active');
    resetArBtn.setAttribute('aria-expanded', 'false');
  }
  if (adjustBtn) {
    adjustBtn.classList.remove('is-active');
    adjustBtn.classList.remove('active');
    adjustBtn.setAttribute('aria-expanded', 'false');
  }

  activeSubmenu = null;
}

/**
 * サブメニューのトグル
 */
function toggleSubmenu(menuType) {
  if (activeSubmenu === menuType) {
    closeSubmenu();
  } else {
    openSubmenu(menuType);
  }
}

/**
 * 通常加工パラメータからCSS Filter文字列を生成（露出・コントラスト・彩度・色温度・色合い・シャープ・フェード）
 */
function buildNormalFilterString() {
  const exp = adjustmentValues.exposure || 0;
  const con = adjustmentValues.contrast || 0;
  const sat = adjustmentValues.saturation || 0;
  const hl = adjustmentValues.highlights || 0;
  const sh = adjustmentValues.shadows || 0;
  const temp = adjustmentValues.temperature || 0;
  const tint = adjustmentValues.tint || 0;
  const sharp = adjustmentValues.sharpness || 0;
  const fade = adjustmentValues.fade || 0;

  if (
    exp === 0 &&
    con === 0 &&
    sat === 0 &&
    hl === 0 &&
    sh === 0 &&
    temp === 0 &&
    tint === 0 &&
    sharp === 0 &&
    fade === 0
  ) {
    return 'none';
  }

  // 1. 明度（露出 + ハイライト/シャドウ明度成分 + フェード明度補正）
  const totalBrightness = Math.max(0.1, 1 + (exp * 0.6) + (hl * 0.0018) + (sh * 0.0022) + (fade * 0.0015));

  // 2. コントラスト（コントラスト + ハイライト/シャドウ + フェード低減 + シャープ微増）
  const sharpContrast = sharp > 0 ? (sharp * 0.0015) : 0;
  const totalContrast = Math.max(0.1, 1 + (con / 100) + (hl * 0.0012) - (sh * 0.001) - (fade * 0.0035) + sharpContrast);

  // 3. 彩度（彩度 + 色温度暖色時の微増）
  const tempSaturate = temp > 0 ? (temp * 0.001) : 0;
  const totalSaturate = Math.max(0, 1 + (sat / 100) + tempSaturate);

  // 4. 色相・色温度・色合い（hue-rotate, sepia）
  let colorFilter = '';
  const hueDeg = (tint * 0.35) + (temp < 0 ? temp * 0.25 : 0);
  if (Math.abs(hueDeg) > 0.01) {
    colorFilter += ` hue-rotate(${hueDeg.toFixed(2)}deg)`;
  }

  if (temp > 0) {
    const sepiaAmt = (temp * 0.35).toFixed(2);
    colorFilter += ` sepia(${sepiaAmt}%)`;
  }

  // 5. シャープ低下によるブラー
  let blurFilter = '';
  if (sharp < 0) {
    const totalBlurPx = Math.abs(sharp) * 0.02;
    blurFilter += ` blur(${totalBlurPx.toFixed(2)}px)`;
  }

  return `brightness(${totalBrightness.toFixed(4)}) contrast(${totalContrast.toFixed(4)}) saturate(${totalSaturate.toFixed(4)})${colorFilter}${blurFilter}`.trim();
}

/**
 * 互換性のためのCSSフィルタ生成ラッパー
 */
function buildCssFilterString() {
  return buildNormalFilterString();
}

/**
 * 特殊加工が1つでも有効かどうか判定
 */
function hasActiveSpecialEffects() {
  return (
    (specialEffectValues.threshold && specialEffectValues.threshold > 0) ||
    (specialEffectValues.mosaic && specialEffectValues.mosaic > 0) ||
    (specialEffectValues.blur && specialEffectValues.blur > 0) ||
    (specialEffectValues.chromaticAberration && specialEffectValues.chromaticAberration > 0) ||
    (specialEffectValues.posterize && specialEffectValues.posterize > 0) ||
    (specialEffectValues.noise && specialEffectValues.noise > 0)
  );
}

/**
 * リアルタイム・特殊加工プレビューの描画ループ管理
 */
let specialPreviewRafId = null;

function updateSpecialPreviewLoop() {
  if (hasActiveSpecialEffects()) {
    if (specialPreviewCanvas) {
      specialPreviewCanvas.classList.remove('hidden');
    }
    if (!specialPreviewRafId) {
      specialPreviewRafId = requestAnimationFrame(renderSpecialPreviewFrame);
    }
  } else {
    if (specialPreviewCanvas) {
      specialPreviewCanvas.classList.add('hidden');
    }
    if (specialPreviewRafId) {
      cancelAnimationFrame(specialPreviewRafId);
      specialPreviewRafId = null;
    }
  }
}

/**
 * リアルタイム・特殊加工プレビューの1フレーム描画（撮影時と100%同一の画像処理関数を使用）
 */
function renderSpecialPreviewFrame() {
  specialPreviewRafId = null;
  if (!hasActiveSpecialEffects()) {
    if (specialPreviewCanvas) specialPreviewCanvas.classList.add('hidden');
    return;
  }

  const video = getActiveVideo();
  if (!video || !video.videoWidth || !video.videoHeight || !captureFrame || !specialPreviewCanvas) {
    specialPreviewRafId = requestAnimationFrame(renderSpecialPreviewFrame);
    return;
  }

  const frameRect = captureFrame.getBoundingClientRect();
  const containerRect = cameraContainer.getBoundingClientRect();
  if (frameRect.width <= 0 || frameRect.height <= 0) {
    specialPreviewRafId = requestAnimationFrame(renderSpecialPreviewFrame);
    return;
  }

  // プレビュー解像度を設定（画面表示サイズ基準）
  const targetW = Math.round(frameRect.width);
  const targetH = Math.round(frameRect.height);

  if (specialPreviewCanvas.width !== targetW || specialPreviewCanvas.height !== targetH) {
    specialPreviewCanvas.width = targetW;
    specialPreviewCanvas.height = targetH;
  }

  const ctx = specialPreviewCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    specialPreviewRafId = requestAnimationFrame(renderSpecialPreviewFrame);
    return;
  }

  const containerW = containerRect.width;
  const containerH = containerRect.height;
  const vW = video.videoWidth;
  const vH = video.videoHeight;

  const scale = Math.max(containerW / vW, containerH / vH);
  const renderedW = vW * scale;
  const renderedH = vH * scale;
  const vOffsetX = (containerW - renderedW) / 2;
  const vOffsetY = (containerH - renderedH) / 2;

  const frameX = frameRect.left - containerRect.left;
  const frameY = frameRect.top - containerRect.top;
  const frameW = frameRect.width;
  const frameH = frameRect.height;

  let cropX = (frameX - vOffsetX) / scale;
  let cropY = (frameY - vOffsetY) / scale;
  let cropW = frameW / scale;
  let cropH = frameH / scale;

  // カメラズーム（Software Zoom）の適用: フレーム中心を基準にズーム倍率分クロップ矩形を縮小
  if (cameraZoom > 1.0) {
    const origCropCenterX = cropX + cropW / 2;
    const origCropCenterY = cropY + cropH / 2;
    cropW = cropW / cameraZoom;
    cropH = cropH / cameraZoom;
    cropX = origCropCenterX - cropW / 2;
    cropY = origCropCenterY - cropH / 2;
  }

  if (currentFacingMode === 'user') {
    cropX = vW - cropX - cropW;
  }

  ctx.clearRect(0, 0, targetW, targetH);

  // 1. 通常加工フィルタを適用してカメラ映像を描画
  const normalFilter = buildNormalFilterString();
  ctx.filter = normalFilter;

  if (currentFacingMode === 'user') {
    ctx.save();
    ctx.translate(targetW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
    ctx.restore();
  } else {
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
  }

  // 2. AR 3D オブジェクトが存在すれば通常加工を適用して合成
  const sceneEl = document.querySelector('a-scene');
  const aCanvas = (sceneEl && sceneEl.canvas) || document.querySelector('.a-canvas');
  if (aCanvas && aCanvas.width > 0 && aCanvas.height > 0) {
    const scaleCanvas = aCanvas.width / renderedW;
    let arCropX = (frameX - vOffsetX) * scaleCanvas;
    let arCropY = (frameY - vOffsetY) * scaleCanvas;
    let arCropW = frameW * scaleCanvas;
    let arCropH = frameH * scaleCanvas;

    if (cameraZoom > 1.0) {
      const origArCenterX = arCropX + arCropW / 2;
      const origArCenterY = arCropY + arCropH / 2;
      arCropW = arCropW / cameraZoom;
      arCropH = arCropH / cameraZoom;
      arCropX = origArCenterX - arCropW / 2;
      arCropY = origArCenterY - arCropH / 2;
    }

    if (currentFacingMode === 'user') {
      ctx.save();
      ctx.translate(targetW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(aCanvas, arCropX, arCropY, arCropW, arCropH, 0, 0, targetW, targetH);
      ctx.restore();
    } else {
      ctx.drawImage(aCanvas, arCropX, arCropY, arCropW, arCropH, 0, 0, targetW, targetH);
    }
  }

  ctx.filter = 'none';

  // 3. 共通特殊加工画像処理を適用（撮影時と100%同一のピクセル処理！）
  applySpecialEffectsToCanvas(specialPreviewCanvas, specialEffectValues);

  // ループ継続
  specialPreviewRafId = requestAnimationFrame(renderSpecialPreviewFrame);
}

/**
 * リアルタイムのカメラ映像およびAR Canvasへ画像加工フィルタを適用
 * ※ typographyCanvas は別レイヤーのため影響を受けず、純白・鮮明なまま維持
 */
function applyAdjustmentsToPreview() {
  const filterStr = buildNormalFilterString();

  const video = getActiveVideo();
  if (video) {
    video.style.filter = filterStr;
  }

  const aCanvas = document.querySelector('.a-canvas');
  if (aCanvas) {
    aCanvas.style.filter = filterStr;
  }

  // リアルタイム・ビネットオーバーレイ（Typography Canvasの下層）
  if (vignetteOverlay) {
    const vig = adjustmentValues.vignette || 0;
    if (vig > 0) {
      vignetteOverlay.style.opacity = (vig / 100).toFixed(3);
    } else {
      vignetteOverlay.style.opacity = '0';
    }
  }

  // 特殊加工プレビューのリアルタイムCanvasループを更新
  updateSpecialPreviewLoop();
}

/**
 * 使い方全画面オーバーレイを開く（現在のカメラ・AR・Typography等の状態は一切変更せずオーバーレイ表示）
 */
function openUsagePanel() {
  closeSubmenu();
  closeAdjustmentSheet();
  closeSpecialSheet();
  closeTypographySheet();
  closeCaptureSettingsSheet();

  if (usageOverlay) {
    usageOverlay.classList.remove('hidden');
    usageOverlay.setAttribute('aria-hidden', 'false');
    const content = document.getElementById('usage-content');
    if (content) {
      content.scrollTop = 0;
    }
  }
}

/**
 * 使い方全画面オーバーレイを閉じる
 */
function closeUsagePanel() {
  if (usageOverlay) {
    usageOverlay.classList.add('hidden');
    usageOverlay.setAttribute('aria-hidden', 'true');
  }
}

/**
 * セグメントコントロールの選択インジケーター（スライドカプセル）の位置と幅を更新
 */
function updateSegmentedIndicator(controlEl, indicatorEl, activeBtn) {
  if (!controlEl || !indicatorEl || !activeBtn) return;
  const controlRect = controlEl.getBoundingClientRect();
  const btnRect = activeBtn.getBoundingClientRect();

  if (controlRect.width === 0 || btnRect.width === 0) {
    const totalBtns = controlEl.querySelectorAll('.segmented-btn').length || 1;
    const index = parseInt(activeBtn.dataset.index, 10) || 0;
    const percentWidth = 100 / totalBtns;
    indicatorEl.style.width = `calc(${percentWidth}% - 6px)`;
    indicatorEl.style.transform = `translateX(${index * 100}%)`;
    return;
  }

  const offsetLeft = btnRect.left - controlRect.left;
  const width = btnRect.width;

  indicatorEl.style.width = `${width}px`;
  indicatorEl.style.transform = `translateX(${offsetLeft - 3}px)`;
}

/**
 * 撮影設定ボトムシートを開く
 */
function openCaptureSettingsSheet() {
  startOrientationListener(true);
  closeSubmenu();
  closeAdjustmentSheet();
  closeSpecialSheet();
  closeTypographySheet();
  closeUsagePanel();

  if (captureSettingsSheet) {
    captureSettingsSheet.classList.add('is-open');

    // 開いた直後にセグメントインジケーターのDOM位置を確実に同期
    requestAnimationFrame(() => {
      setTimerDuration(currentTimerSeconds);
      setGridMode(currentGridMode);
    });
  }
}

/**
 * 撮影設定ボトムシートを閉じる
 */
function closeCaptureSettingsSheet() {
  if (captureSettingsSheet) {
    captureSettingsSheet.classList.remove('is-open', 'is-dragging');
    captureSettingsSheet.style.transform = '';
  }
}

/**
 * 構図グリッドモードの設定（'off' | 'rule-of-thirds'）
 */
function setGridMode(mode) {
  currentGridMode = mode;
  let activeBtn = null;

  // UIボタンスタイル更新
  if (gridOptionButtons && gridOptionButtons.length > 0) {
    gridOptionButtons.forEach((btn) => {
      const isTarget = btn.dataset.grid === mode;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
      if (isTarget) activeBtn = btn;
    });
  }

  // セグメントインジケーターのスライド更新
  if (gridSegmentedControl && gridSegmentedIndicator && activeBtn) {
    updateSegmentedIndicator(gridSegmentedControl, gridSegmentedIndicator, activeBtn);
  }

  // 画面上のグリッド表示切替
  if (cameraGridOverlay) {
    if (mode === 'rule-of-thirds') {
      cameraGridOverlay.classList.remove('hidden');
    } else {
      cameraGridOverlay.classList.add('hidden');
    }
  }
}

/**
 * ジャイロ・加速度センサーリスナーの開始（自動検知用）
 * @param {boolean} isUserGesture ユーザー操作（タップ・クリック）のコールスタック内から呼ばれたか
 */
function startOrientationListener(isUserGesture = false) {
  if (isOrientationListening) {
    return;
  }

  // iOS 13+ Safariのパーミッション要求対応（ユーザー操作時のみ実行）
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    if (isUserGesture) {
      DeviceOrientationEvent.requestPermission()
        .then((permissionState) => {
          if (permissionState === 'granted') {
            attachOrientationListeners();
            setupMotionFallback(true);
          }
        })
        .catch((err) => {
          console.warn('DeviceOrientation permission error:', err);
        });
    }
  } else if ('DeviceOrientationEvent' in window) {
    // Android Chrome / 一般ブラウザ（パーミッション不要）
    attachOrientationListeners();
    setupMotionFallback(isUserGesture);
  } else {
    setupMotionFallback(isUserGesture);
  }
}

/**
 * 実際のorientationイベントリスナー登録
 */
function attachOrientationListeners() {
  if (isOrientationListening) return;
  try {
    window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    isOrientationListening = true;
  } catch (err) {
    console.warn('Failed to attach deviceorientation listener:', err);
  }
}

/**
 * devicemotion フォールバックの登録
 * deviceorientation から値が届かない端末や環境で重力加速度を用いて水平角を補完
 */
function setupMotionFallback(isUserGesture = false) {
  if (isMotionListening) return;

  // iOS 13+ Safari DeviceMotionEvent permission
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    if (isUserGesture) {
      DeviceMotionEvent.requestPermission()
        .then((state) => {
          if (state === 'granted') {
            attachMotionListeners();
          }
        })
        .catch((err) => {
          console.warn('DeviceMotionEvent permission error:', err);
        });
    }
  } else if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
    attachMotionListeners();
  }
}

/**
 * 実際のmotionイベントリスナー登録
 */
function attachMotionListeners() {
  if (isMotionListening) return;
  try {
    window.addEventListener('devicemotion', handleDeviceMotion, true);
    isMotionListening = true;
  } catch (err) {
    console.warn('Failed to attach devicemotion listener:', err);
  }
}

/**
 * 画面の向きに応じた正確なロール角（水平からの傾き）を計算
 * @param {number} beta 前後の傾き (-180 ~ 180)
 * @param {number} gamma 左右の傾き (-90 ~ 90)
 * @param {number} screenAngle 画面の回転角 (0, 90, 180, 270)
 * @returns {number} 水平からの傾き角度 (-180 ~ 180)
 */
function computeCameraRollAngle(beta, gamma, screenAngle) {
  const betaRad = ((beta || 0) * Math.PI) / 180;
  const gammaRad = ((gamma || 0) * Math.PI) / 180;

  // 画面平面における重力ベクトルの投影成分 (X: 右, Y: 下)
  const x = Math.sin(gammaRad);
  const y = -Math.sin(betaRad) * Math.cos(gammaRad);

  // 画面平面上での重力ベクトルの角度 (度)
  let roll = Math.atan2(x, -y) * (180 / Math.PI);

  // 画面の物理回転角を補正
  let adjustedRoll = roll - screenAngle;
  while (adjustedRoll > 180) adjustedRoll -= 360;
  while (adjustedRoll < -180) adjustedRoll += 360;

  return adjustedRoll;
}

/**
 * 水平ガイドの描画更新（ロール角に基づく自動表示・ハイライト・フェードアウト共通処理）
 * @param {number} rawRoll 水平からの生の傾き角度 (-180 ~ 180)
 */
function updateLevelGuideWithRoll(rawRoll) {
  if (!levelGuideOverlay || !levelRollBar) {
    return;
  }
  if (typeof rawRoll !== 'number' || isNaN(rawRoll)) return;

  // 指数移動平均（EMA）による滑らかなジッター抑制フィルター
  const SMOOTH_ALPHA = 0.25;
  smoothRollAngle = smoothRollAngle * (1 - SMOOTH_ALPHA) + rawRoll * SMOOTH_ALPHA;

  const absAngle = Math.abs(smoothRollAngle);

  // しきい値設定
  const LEVEL_GUIDE_SHOW_THRESHOLD = 8.0;   // 約8°以下に近づいたら表示開始（水平合わせアシスト）
  const LEVEL_GUIDE_HIDE_THRESHOLD = 12.0;  // 12°以上に離れたらガイド非表示（大きく傾いている時は邪魔にならないよう非表示）
  const ALIGNED_THRESHOLD = 1.1;            // ±1.1°以内を水平と判定（手持ちスマホで実用的な高精度範囲）
  const STABLE_DURATION = 900;              // 水平が約0.9秒安定して継続したら自然にフェードアウト (ms)

  // 1. 水平から離れた場合、フェードアウト抑制フラグを解除（再度水平に戻したときに表示できるようにする）
  if (absAngle > LEVEL_GUIDE_SHOW_THRESHOLD) {
    isLevelDismissed = false;
  }

  // 2. 表示開始・終了判定
  if (!isLevelGuideActive) {
    // 非表示中：8°以下に近づき、かつフェードアウト直後でなければ表示開始
    if (!isLevelDismissed && absAngle <= LEVEL_GUIDE_SHOW_THRESHOLD) {
      isLevelGuideActive = true;
      isLevelAligned = false;
      levelAlignedStartTime = null;
    }
  } else {
    // 表示中：12°以上に大きく傾いたら邪魔にならないよう非表示に戻す
    if (absAngle >= LEVEL_GUIDE_HIDE_THRESHOLD) {
      isLevelGuideActive = false;
      isLevelAligned = false;
      levelAlignedStartTime = null;
    }
  }

  // 3. ガイドのアクティブ状態に応じた表示・追従・ハイライト制御
  if (isLevelGuideActive) {
    levelGuideOverlay.classList.add('is-visible');
    levelRollBar.style.transform = `rotate(${smoothRollAngle.toFixed(2)}deg)`;

    if (absAngle <= ALIGNED_THRESHOLD) {
      // 水平成立！黄色ハイライト #FFD84D
      levelGuideOverlay.classList.add('is-aligned');

      if (!isLevelAligned) {
        isLevelAligned = true;
        levelAlignedStartTime = Date.now();
      } else if (levelAlignedStartTime && (Date.now() - levelAlignedStartTime >= STABLE_DURATION)) {
        // 水平が安定して約0.9秒継続したら自然にフェードアウト
        levelGuideOverlay.classList.remove('is-visible', 'is-aligned');
        isLevelGuideActive = false;
        isLevelAligned = false;
        levelAlignedStartTime = null;
        isLevelDismissed = true; // 水平を維持している間は再表示を抑制
      }
    } else {
      // 水平未成立（傾き調整中）
      levelGuideOverlay.classList.remove('is-aligned');
      isLevelAligned = false;
      levelAlignedStartTime = null;
    }
  } else {
    levelGuideOverlay.classList.remove('is-visible', 'is-aligned');
    isLevelAligned = false;
    levelAlignedStartTime = null;
  }
}

/**
 * デバイスの傾きイベント処理（deviceorientation）
 */
function handleDeviceOrientation(e) {
  const gamma = e.gamma; // 左右の傾き (-90 to 90)
  const beta = e.beta;   // 上下の傾き (-180 to 180)

  if (gamma === null || beta === null || gamma === undefined || beta === undefined) {
    return;
  }

  hasReceivedOrientationData = true;

  // 画面の向き（回転角度）を取得
  const screenOrientation = window.screen?.orientation?.angle !== undefined
    ? window.screen.orientation.angle
    : (typeof window.orientation === 'number' ? window.orientation : 0);

  // 3D重力ベクトルに基づく正確なロール角（真の傾き）の算出
  const rawRoll = computeCameraRollAngle(beta, gamma, screenOrientation);
  updateLevelGuideWithRoll(rawRoll);
}

/**
 * 加速度センサーイベント処理（devicemotion フォールバック）
 */
function handleDeviceMotion(e) {
  const acc = e.accelerationIncludingGravity;

  // deviceorientation で既に有効なデータを受信できている場合はそちらを優先
  if (hasReceivedOrientationData) return;

  if (!acc || acc.x === null || acc.y === null || acc.x === undefined || acc.y === undefined) {
    return;
  }

  // 画面の向き（回転角度）を取得
  const screenOrientation = window.screen?.orientation?.angle !== undefined
    ? window.screen.orientation.angle
    : (typeof window.orientation === 'number' ? window.orientation : 0);

  // 重力加速度 (X: 右向き, Y: 下向き)
  const gx = acc.x || 0;
  const gy = acc.y || 0;

  // 画面平面上での重力ベクトルの角度 (度)
  let roll = Math.atan2(gx, gy) * (180 / Math.PI);
  let adjustedRoll = roll - screenOrientation;
  while (adjustedRoll > 180) adjustedRoll -= 360;
  while (adjustedRoll < -180) adjustedRoll += 360;

  updateLevelGuideWithRoll(adjustedRoll);
}

/**
 * 加工ボトムシートを開く（最後に選択した加工項目をそのまま保持して開く）
 */
function openAdjustmentSheet() {
  closeSubmenu();
  closeCaptureSettingsSheet();
  closeSpecialSheet();
  closeTypographySheet();
  closeUsagePanel();

  if (adjustmentSheet) {
    adjustmentSheet.classList.add('is-open');
  }

  // 最後に選択した項目を保持して開く（初回は exposure）
  selectAdjustmentItem(currentSelectedAdjustment || 'exposure');
}

/**
 * 加工ボトムシートを閉じる
 */
function closeAdjustmentSheet() {
  if (adjustmentSheet) {
    adjustmentSheet.classList.remove('is-open', 'is-dragging');
    adjustmentSheet.style.transform = '';
  }
}

/**
 * 特殊加工ボトムシートを開く（最後に選択した特殊加工項目を保持して開く）
 */
function openSpecialSheet() {
  closeSubmenu();
  closeCaptureSettingsSheet();
  closeAdjustmentSheet();
  closeTypographySheet();
  closeUsagePanel();

  if (currentSelectedSpecial && SPECIAL_CONFIGS_MAP[currentSelectedSpecial]) {
    // 最後に選択していた特殊加工項目をそのまま復元
    selectSpecialItem(currentSelectedSpecial);
  } else {
    // リセット後または初回未選択状態
    if (specialEmptyContainer) {
      specialEmptyContainer.classList.remove('hidden');
    }
    if (specialActiveContainer) {
      specialActiveContainer.classList.add('hidden');
    }

    if (specialTabButtons && specialTabButtons.length > 0) {
      specialTabButtons.forEach((btn) => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      });
    }
  }

  if (specialAdjustmentSheet) {
    specialAdjustmentSheet.classList.add('is-open');
  }
}

/**
 * 特殊加工ボトムシートを閉じる
 */
function closeSpecialSheet() {
  if (specialAdjustmentSheet) {
    specialAdjustmentSheet.classList.remove('is-open', 'is-dragging');
    specialAdjustmentSheet.style.transform = '';
  }
}

/**
 * 特殊加工項目の選択
 * ・最初に選ぶ1個目の特殊加工: 初期値 50
 * ・2個目以降に初めて選ぶ特殊加工: 初期値 0
 * ・すでに設定済みの値は再選択時にも維持
 */
function selectSpecialItem(itemId) {
  const config = SPECIAL_CONFIGS_MAP[itemId];
  if (!config) return;

  // 1個目の選択かどうか判定（まだどの特殊加工も触られておらず全て0の場合のみ初回50）
  const anyActive = Object.values(specialEffectValues).some((v) => v > 0);
  const anyTouched = Object.values(specialEffectTouched).some((v) => v === true);

  if (!specialEffectTouched[config.id]) {
    specialEffectTouched[config.id] = true;
    // 最初の1個目だけ50、2個目以降は0
    if (!anyActive && !anyTouched && specialEffectValues[config.id] === 0) {
      specialEffectValues[config.id] = 50;
    }
  }

  currentSelectedSpecial = config.id;

  // タブのアクティブ状態更新
  if (specialTabButtons && specialTabButtons.length > 0) {
    specialTabButtons.forEach((btn) => {
      const isTarget = btn.dataset.special === config.id;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });
  }

  // 未選択メッセージを非表示にして、調整エリアを表示
  if (specialEmptyContainer) {
    specialEmptyContainer.classList.add('hidden');
  }
  if (specialActiveContainer) {
    specialActiveContainer.classList.remove('hidden');
  }

  // 項目名・現在値・スライダーの更新
  const currentVal = specialEffectValues[config.id];
  if (specialCurrentItemName) {
    specialCurrentItemName.textContent = config.name;
  }
  if (specialCurrentItemVal) {
    specialCurrentItemVal.textContent = String(currentVal);
  }
  if (specialAdjustmentSlider) {
    specialAdjustmentSlider.value = String(currentVal);
  }

  applyAdjustmentsToPreview();
}

/**
 * 特殊加工スライダー値の更新
 */
function updateSpecialSlider(val) {
  if (!currentSelectedSpecial) return;

  const numVal = Math.min(100, Math.max(0, parseInt(val, 10) || 0));
  specialEffectValues[currentSelectedSpecial] = numVal;

  if (specialCurrentItemVal) {
    specialCurrentItemVal.textContent = String(numVal);
  }

  applyAdjustmentsToPreview();
}

/**
 * 個別加工項目のリセット（現在選択中の1項目のみ初期値0に戻す）
 */
function resetSingleAdjustment() {
  if (!currentSelectedAdjustment) return;
  const config = ADJUSTMENT_CONFIGS_MAP[currentSelectedAdjustment];
  const itemName = config ? config.name : '加工';

  adjustmentValues[currentSelectedAdjustment] = 0;
  selectAdjustmentItem(currentSelectedAdjustment);
  applyAdjustmentsToPreview();
  showFeatureToast(`${itemName}を初期値に戻しました`);
}

/**
 * 個別特殊加工項目のリセット（現在選択中の1項目のみ0に戻す）
 */
function resetSingleSpecialEffect() {
  if (!currentSelectedSpecial) {
    showFeatureToast('特殊加工を0に戻しました');
    return;
  }
  const config = SPECIAL_CONFIGS_MAP[currentSelectedSpecial];
  const itemName = config ? config.name : '特殊加工';

  specialEffectValues[currentSelectedSpecial] = 0;
  specialEffectTouched[currentSelectedSpecial] = false;

  if (specialCurrentItemVal) {
    specialCurrentItemVal.textContent = '0';
  }
  if (specialAdjustmentSlider) {
    specialAdjustmentSlider.value = '0';
  }

  applyAdjustmentsToPreview();
  showFeatureToast(`${itemName}を0に戻しました`);
}

/**
 * 特殊加工のリセット（6種類すべて0に戻す ＆ タッチ状態リセット）
 * ※メインメニューの「リセット → 特殊加工リセット」用
 */
function resetSpecialEffects() {
  Object.keys(specialEffectValues).forEach((key) => {
    specialEffectValues[key] = 0;
  });
  Object.keys(specialEffectTouched).forEach((key) => {
    specialEffectTouched[key] = false;
  });

  // 未選択状態に戻す
  currentSelectedSpecial = null;

  if (specialEmptyContainer) {
    specialEmptyContainer.classList.remove('hidden');
  }
  if (specialActiveContainer) {
    specialActiveContainer.classList.add('hidden');
  }

  if (specialTabButtons && specialTabButtons.length > 0) {
    specialTabButtons.forEach((btn) => {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    });
  }

  applyAdjustmentsToPreview();
}

/**
 * 加工項目の選択切り替え（スライダー位置・幅・高さを完全固定）
 */
function selectAdjustmentItem(itemId) {
  const config = ADJUSTMENT_CONFIGS_MAP[itemId] || ADJUSTMENT_CONFIGS[0];
  if (!config) return;

  currentSelectedAdjustment = config.id;

  // タブのアクティブ状態更新
  const tabBtns = document.querySelectorAll('.sheet-tab-btn');
  tabBtns.forEach(btn => {
    const isTarget = btn.dataset.adjust === config.id;
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  // 項目名・現在値の更新
  if (sheetCurrentItemName) {
    sheetCurrentItemName.textContent = config.name;
  }
  updateSliderDisplay(config.id);
}

/**
 * スライダーの表示と現在値ラベルを更新（位置は不変）
 */
function updateSliderDisplay(itemId) {
  const config = ADJUSTMENT_CONFIGS_MAP[itemId] || ADJUSTMENT_CONFIGS[0];
  if (!config || !adjustmentSlider || !sheetCurrentItemVal) return;

  const currentVal = adjustmentValues[config.id] !== undefined ? adjustmentValues[config.id] : config.default;

  adjustmentSlider.min = String(config.min);
  adjustmentSlider.max = String(config.max);
  adjustmentSlider.step = String(config.step);
  adjustmentSlider.value = String(currentVal);

  sheetCurrentItemVal.textContent = config.format(currentVal);

  // 0基準（- 〜 +）と 0〜100（0 〜 100）のスライダー表示切替（位置・幅・高さは固定）
  if (sliderBoundMinLabel && sliderBoundMaxLabel) {
    if (config.hasCenterZero) {
      sliderBoundMinLabel.textContent = '−';
      sliderBoundMaxLabel.textContent = '＋';
    } else {
      sliderBoundMinLabel.textContent = String(config.min);
      sliderBoundMaxLabel.textContent = String(config.max);
    }
  }

  if (sliderCenterMark) {
    sliderCenterMark.style.display = config.hasCenterZero ? 'block' : 'none';
  }
}

/**
 * 加工パラメータのリセット（10項目すべて0に戻す）
 * ※メインメニューの「リセット → 加工リセット」用
 */
function resetAdjustments() {
  Object.keys(adjustmentValues).forEach(key => {
    adjustmentValues[key] = 0;
  });

  currentSelectedAdjustment = 'exposure';
  selectAdjustmentItem('exposure');
  applyAdjustmentsToPreview();
}

/**
 * 字体プレビューカードUIの生成・更新
 * ・全カードで共通の基準領域（高精細プレビューCanvas）を作成
 * ・actualBoundingBoxAscent / actualBoundingBoxDescent から実グリフ高さを計測
 * ・Defaultの「日」のインク高さを基準（100%）とし、全フォントの縦方向の視覚的高さを統一
 * ・各フォント固有の横幅（Condensedの細身、Displayの太幅等）は自然なまま維持
 * ・グリフの上下境界を基準とした完璧な幾何学・視覚的垂直中央配置
 */
function updateFontCardsUI() {
  if (!fontCardsContainer) return;

  const dateParts = getCurrentDateTimeParts();
  const previewDay = dateParts.day;

  fontCardsContainer.innerHTML = '';

  // 1. Defaultフォントの実際のグリフ描画高さを精密測定（基準値）
  const defaultCfg = FONT_CONFIGS[0];
  const testCanvas = document.createElement('canvas');
  const testCtx = testCanvas.getContext('2d');
  const BASE_FONT_SIZE = 22; // 基準フォントサイズ

  let defaultVisualHeight = 16; // フォールバック
  if (testCtx) {
    testCtx.font = `${(defaultCfg.fontWeight && defaultCfg.fontWeight.day) || 800} ${BASE_FONT_SIZE}px ${defaultCfg.fontFamily}`;
    const defaultMetrics = testCtx.measureText(previewDay);
    if ('actualBoundingBoxAscent' in defaultMetrics && 'actualBoundingBoxDescent' in defaultMetrics) {
      defaultVisualHeight = defaultMetrics.actualBoundingBoxAscent + defaultMetrics.actualBoundingBoxDescent;
    }
  }
  if (defaultVisualHeight <= 0) defaultVisualHeight = 16;

  // プレビュー共通表示領域の寸法（CSS px: 56x28, Retina対応 2x）
  const PREVIEW_WIDTH = 56;
  const PREVIEW_HEIGHT = 28;
  const DPR = Math.min(window.devicePixelRatio || 2, 3);

  FONT_CONFIGS.forEach((cfg) => {
    const card = document.createElement('div');
    const isActive = currentTypographyEnabled && (cfg.id === currentSelectedFontId);
    card.className = `font-card ${isActive ? 'active' : ''}`;
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', isActive ? 'true' : 'false');
    card.dataset.fontId = cfg.id;

    const dayWeight = (cfg.fontWeight && cfg.fontWeight.day) || 800;

    // 共通プレビュー領域（Canvas）を作成
    const canvasEl = document.createElement('canvas');
    canvasEl.className = 'font-card-preview-canvas';
    canvasEl.width = PREVIEW_WIDTH * DPR;
    canvasEl.height = PREVIEW_HEIGHT * DPR;
    canvasEl.style.width = `${PREVIEW_WIDTH}px`;
    canvasEl.style.height = `${PREVIEW_HEIGHT}px`;
    canvasEl.style.display = 'block';

    const ctx = canvasEl.getContext('2d');
    if (ctx) {
      ctx.scale(DPR, DPR);

      // 初回計測
      ctx.font = `${dayWeight} ${BASE_FONT_SIZE}px ${cfg.fontFamily}`;
      let metrics = ctx.measureText(previewDay);
      let glyphHeight = 16;
      if ('actualBoundingBoxAscent' in metrics && 'actualBoundingBoxDescent' in metrics) {
        glyphHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      }

      // Defaultのグリフ高さに揃える動的スケールファクター
      let autoHeightScale = 1.0;
      if (glyphHeight > 0 && defaultVisualHeight > 0) {
        autoHeightScale = defaultVisualHeight / glyphHeight;
      }

      // 補正値（微調整用プレビュースケールがあれば乗算）
      const userScale = (cfg.previewDayScale !== undefined) ? cfg.previewDayScale : 1.0;
      // Defaultの場合は完全な1.0基準を維持
      const finalFontSize = (cfg.id === 'default') ? BASE_FONT_SIZE : (BASE_FONT_SIZE * autoHeightScale * (userScale > 0 ? (userScale / 1.0) : 1.0));

      // 最終フォントサイズで再設定
      ctx.font = `${dayWeight} ${finalFontSize}px ${cfg.fontFamily}`;
      if (cfg.letterSpacing && cfg.letterSpacing.day !== undefined && 'letterSpacing' in ctx) {
        ctx.letterSpacing = `${finalFontSize * cfg.letterSpacing.day}px`;
      }

      const finalMetrics = ctx.measureText(previewDay);
      const ascent = ('actualBoundingBoxAscent' in finalMetrics) ? finalMetrics.actualBoundingBoxAscent : (finalFontSize * 0.72);
      const descent = ('actualBoundingBoxDescent' in finalMetrics) ? finalMetrics.actualBoundingBoxDescent : (finalFontSize * 0.05);

      // 視覚的中心（グリフの上下境界の中央）をCanvasの垂直中央 (PREVIEW_HEIGHT / 2) に正確に配置
      const textCenterY = (ascent - descent) / 2;
      const baselineY = (PREVIEW_HEIGHT / 2) + textCenterY;

      ctx.fillStyle = isActive ? '#FFFFFF' : '#1A1A1A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';

      ctx.fillText(previewDay, PREVIEW_WIDTH / 2, baselineY);
    }

    const nameEl = document.createElement('div');
    nameEl.className = 'font-card-name';
    nameEl.textContent = cfg.name;

    card.appendChild(canvasEl);
    card.appendChild(nameEl);

    card.addEventListener('click', (e) => {
      e.stopPropagation();
      selectFont(cfg.id);
    });

    fontCardsContainer.appendChild(card);
  });
}

/**
 * 文字編集ボトムシートのヘッダー（項目名・現在値）をサブタブに合わせて更新
 */
function updateTypographySheetHeader() {
  if (!typographyHeaderTitle || !typographyCurrentFontName) return;

  if (currentTypographySubtab === 'none') {
    typographyHeaderTitle.textContent = '文字表示';
    typographyCurrentFontName.textContent = 'なし（非表示）';
  } else if (currentTypographySubtab === 'font') {
    typographyHeaderTitle.textContent = '字体';
    const cfg = FONT_CONFIGS_MAP[currentSelectedFontId] || FONT_CONFIGS[0];
    typographyCurrentFontName.textContent = cfg.name;
  } else if (currentTypographySubtab === 'size') {
    typographyHeaderTitle.textContent = '文字サイズ';
    typographyCurrentFontName.textContent = `${Math.round(currentTypographyScale * 100)}%`;
  } else if (currentTypographySubtab === 'color') {
    typographyHeaderTitle.textContent = '文字色';
    const activeColor = COLOR_CONFIGS.find(c => c.hex.toLowerCase() === currentTypographyColor.toLowerCase()) || COLOR_CONFIGS[0];
    typographyCurrentFontName.textContent = activeColor.name;
  } else if (currentTypographySubtab === 'align') {
    typographyHeaderTitle.textContent = '文字配置';
    const activeAnchor = ANCHOR_CONFIGS.find(a => a.id === currentTypographyAnchor) || ANCHOR_CONFIGS[8];
    typographyCurrentFontName.textContent = activeAnchor.name;
  }
}

/**
 * 「文字なし」を選択（文字非表示化・専用選択状態）
 */
function setTypographyNone() {
  currentTypographyEnabled = false;
  currentTypographySubtab = 'none';

  // タブボタンのアクティブ状態更新（文字なしボタン専用スタイル適用）
  if (typeTabNone) {
    typeTabNone.classList.add('is-none-active');
    typeTabNone.setAttribute('aria-selected', 'true');
  }
  if (typeTabFont) {
    typeTabFont.classList.remove('active');
    typeTabFont.setAttribute('aria-selected', 'false');
  }
  if (typeTabSize) {
    typeTabSize.classList.remove('active');
    typeTabSize.setAttribute('aria-selected', 'false');
  }
  if (typeTabColor) {
    typeTabColor.classList.remove('active');
    typeTabColor.setAttribute('aria-selected', 'false');
  }
  if (typeTabAlign) {
    typeTabAlign.classList.remove('active');
    typeTabAlign.setAttribute('aria-selected', 'false');
  }

  // コンテナは直近のコンテナ（例: 字体）を非表示にはせずそのままにするか、あるいは字体等を表示していてもCanvas描画自体を停止
  // ユーザー体験として「文字なし」選択時も字体コンテナを静かに残すか、スライダー等の操作時に自動でON復帰できるようにする
  updateTypographySheetHeader();
  updateFontCardsUI();
  updateRealtimeClock();
}

/**
 * 文字設定サブタブ（字体 / 大きさ / 色 / 配置）の切り替え
 * ※「字体」「大きさ」「色」「配置」のいずれかを押すと自動的に文字表示ONに復帰
 */
function switchTypographySubtab(tabName) {
  // 「字体」「大きさ」「色」「配置」が押された場合は文字表示をONにする
  if (tabName !== 'none') {
    currentTypographyEnabled = true;
  }

  currentTypographySubtab = tabName;

  // タブボタンのアクティブ状態
  if (typeTabNone) {
    const isNone = (tabName === 'none' || !currentTypographyEnabled);
    typeTabNone.classList.toggle('is-none-active', isNone);
    typeTabNone.setAttribute('aria-selected', isNone ? 'true' : 'false');
  }
  if (typeTabFont) {
    const isFont = (tabName === 'font');
    typeTabFont.classList.toggle('active', isFont);
    typeTabFont.setAttribute('aria-selected', isFont ? 'true' : 'false');
  }
  if (typeTabSize) {
    const isSize = (tabName === 'size');
    typeTabSize.classList.toggle('active', isSize);
    typeTabSize.setAttribute('aria-selected', isSize ? 'true' : 'false');
  }
  if (typeTabColor) {
    const isColor = (tabName === 'color');
    typeTabColor.classList.toggle('active', isColor);
    typeTabColor.setAttribute('aria-selected', isColor ? 'true' : 'false');
  }
  if (typeTabAlign) {
    const isAlign = (tabName === 'align');
    typeTabAlign.classList.toggle('active', isAlign);
    typeTabAlign.setAttribute('aria-selected', isAlign ? 'true' : 'false');
  }

  // コンテナの表示切替（none時は直近のタブコンテナ（例: font）を表示維持しつつ文字描画のみOFF）
  const activeContainerTab = (tabName === 'none') ? 'font' : tabName;
  if (fontCardsContainer) {
    fontCardsContainer.classList.toggle('hidden', activeContainerTab !== 'font');
  }
  if (typographySizeContainer) {
    typographySizeContainer.classList.toggle('hidden', activeContainerTab !== 'size');
  }
  if (typographyColorContainer) {
    typographyColorContainer.classList.toggle('hidden', activeContainerTab !== 'color');
  }
  if (typographyAnchorContainer) {
    typographyAnchorContainer.classList.toggle('hidden', activeContainerTab !== 'align');
  }

  // スライダー値の同期
  if (activeContainerTab === 'size' && typographySizeSlider) {
    typographySizeSlider.value = String(Math.round(currentTypographyScale * 100));
  }

  updateTypographySheetHeader();
  updateFontCardsUI();
  updateRealtimeClock();
}

/**
 * 9点アンカー配置用のIllustrator風ミニマルSVGアイコン生成（矩形＋基準点●）
 */
function createAnchorProxySvg(rIdx, cIdx) {
  // 3×3 のドット位置（col: left, center, right / row: top, center, bottom）
  const cols = [8, 14, 20];
  const rows = [8, 14, 20];
  const cx = cols[cIdx];
  const cy = rows[rIdx];

  return `<svg viewBox="0 0 28 28" class="anchor-proxy-svg" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3.5" y="3.5" width="21" height="21" rx="4" stroke="currentColor" stroke-width="1.8" opacity="0.75" />
    <circle cx="${cx}" cy="${cy}" r="3.2" fill="currentColor" />
  </svg>`;
}

/**
 * 9点アンカー選択UI（1列9個 3グループ・アイコンのみ）の生成・更新
 */
function updateAnchorButtonsUI() {
  if (!typographyAnchorContainer) return;
  typographyAnchorContainer.innerHTML = '';

  const groups = ['top', 'center', 'bottom'];
  groups.forEach((grpName, gIdx) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'anchor-group';
    groupEl.setAttribute('role', 'group');
    groupEl.setAttribute('aria-label', grpName === 'top' ? '上段' : grpName === 'center' ? '中央' : '下段');

    const groupItems = ANCHOR_CONFIGS.filter(a => a.group === grpName);
    groupItems.forEach((cfg) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isActive = (cfg.id === currentTypographyAnchor);
      btn.className = `anchor-btn ${isActive ? 'active' : ''}`;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.setAttribute('aria-label', `${cfg.name}配置を選択`);
      btn.title = cfg.name;

      btn.innerHTML = createAnchorProxySvg(cfg.row, cfg.col);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectTypographyAnchor(cfg.id);
      });

      groupEl.appendChild(btn);
    });

    typographyAnchorContainer.appendChild(groupEl);

    // グループ区切り線（最後のグループ以外）
    if (gIdx < groups.length - 1) {
      const div = document.createElement('div');
      div.className = 'anchor-group-divider';
      typographyAnchorContainer.appendChild(div);
    }
  });
}

/**
 * 文字配置アンカーを選択
 */
function selectTypographyAnchor(anchorId) {
  currentTypographyEnabled = true;
  currentTypographyAnchor = anchorId;
  updateAnchorButtonsUI();
  updateTypographySheetHeader();
  updateRealtimeClock();
}

/**
 * 文字色カラーチップUIの生成・更新
 */
function updateColorChipsUI() {
  if (!typographyColorContainer) return;
  typographyColorContainer.innerHTML = '';

  COLOR_CONFIGS.forEach((cfg) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isActive = (cfg.hex.toLowerCase() === currentTypographyColor.toLowerCase());
    btn.className = `color-chip-btn ${cfg.id === 'white' ? 'color-chip-white' : ''} ${isActive ? 'active' : ''}`;
    btn.style.backgroundColor = cfg.hex;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.setAttribute('aria-label', `${cfg.name}を選択`);
    btn.title = cfg.name;

    const check = document.createElement('span');
    check.className = 'material-symbols-outlined color-chip-check';
    check.textContent = 'check';
    check.style.color = cfg.checkColor;

    btn.appendChild(check);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectTypographyColor(cfg.hex);
    });

    typographyColorContainer.appendChild(btn);
  });
}

/**
 * 文字色を選択
 */
function selectTypographyColor(hex) {
  currentTypographyEnabled = true;
  currentTypographyColor = hex;
  updateColorChipsUI();
  updateTypographySheetHeader();
  updateRealtimeClock();
}

/**
 * 字体（フォント）を選択
 */
function selectFont(fontId) {
  const cfg = FONT_CONFIGS_MAP[fontId] || FONT_CONFIGS[0];
  currentTypographyEnabled = true;
  currentSelectedFontId = cfg.id;

  updateTypographySheetHeader();
  updateFontCardsUI();
  updateRealtimeClock();
}

/**
 * 文字編集ボトムシートを開く
 */
function openTypographySheet() {
  closeSubmenu();
  closeCaptureSettingsSheet();
  closeAdjustmentSheet();
  closeSpecialSheet();
  closeUsagePanel();

  if (typographySheet) {
    typographySheet.classList.add('is-open');
  }

  switchTypographySubtab(currentTypographySubtab || 'font');
  updateFontCardsUI();
  updateColorChipsUI();
  updateAnchorButtonsUI();
}

/**
 * 文字編集ボトムシートを閉じる
 */
function closeTypographySheet() {
  if (typographySheet) {
    typographySheet.classList.remove('is-open', 'is-dragging');
    typographySheet.style.transform = '';
  }
}

/**
 * 現在の文字サブタブに応じた個別リセット完了通知メッセージを取得
 * @param {string} tabName - 'font' | 'size' | 'color' | 'align' | 'none'
 */
function getTypographyResetMessage(tabName) {
  switch (tabName) {
    case 'size':
      return '文字の大きさを100%に戻しました';
    case 'color':
      return '文字色をWhiteに戻しました';
    case 'align':
      return '文字の配置を下右に戻しました';
    case 'none':
    case 'font':
    default:
      return '文字の字体をDefaultに戻しました';
  }
}

/**
 * 文字パネル内の個別リセット（現在選択中のサブタブのみ初期値に戻す）
 * ※文字なし（enabled=false）状態は勝手に変更せず維持
 */
function resetTypographySingleTab() {
  const activeTab = currentTypographySubtab || 'font';

  switch (activeTab) {
    case 'size':
      currentTypographyScale = 1.0;
      if (typographySizeSlider) {
        typographySizeSlider.value = '100';
      }
      break;

    case 'color':
      currentTypographyColor = '#FFFFFF';
      updateColorChipsUI();
      break;

    case 'align':
      currentTypographyAnchor = 'bottom-right';
      updateAnchorButtonsUI();
      break;

    case 'none':
    case 'font':
    default:
      currentSelectedFontId = 'default';
      updateFontCardsUI();
      break;
  }

  // enabled状態および現在のサブタブ（activeTab）は維持したままUIと時計描画を更新
  updateTypographySheetHeader();
  updateRealtimeClock();

  const resetMsg = getTypographyResetMessage(activeTab);
  showFeatureToast(resetMsg);
}

/**
 * 文字設定の全体リセット（文字表示有効・Defaultフォント・100%サイズ・White色・bottom-right配置）
 * ※メインメニューの「リセット → 文字リセット」用
 */
function resetTypography() {
  currentTypographyEnabled = true;
  currentSelectedFontId = 'default';
  currentTypographyScale = 1.0;
  currentTypographyColor = '#FFFFFF';
  currentTypographyAnchor = 'bottom-right';

  if (typographySizeSlider) {
    typographySizeSlider.value = '100';
  }

  switchTypographySubtab('font');
  updateTypographySheetHeader();
  updateFontCardsUI();
  updateColorChipsUI();
  updateAnchorButtonsUI();
  updateRealtimeClock();
}

/**
 * 画面を壊さない安全な一時メッセージ（トースト表示）
 */
let toastTimeoutId = null;
function showFeatureToast(message) {
  let toast = document.getElementById('feature-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'feature-toast';
    toast.style.cssText = `
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(26, 26, 26, 0.9);
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 600;
      padding: 8px 18px;
      border-radius: 20px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
      z-index: 120;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease, transform 0.2s ease;
    `;
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';

  if (toastTimeoutId) clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-6px)';
  }, 2200);
}

/**
 * Web Audio APIによるシャッター音の管理と再生
 * iOS Safari / Android Chrome / PC全環境の自動再生ポリシーを確実にクリアする構造
 */
let audioCtx = null;

/**
 * ユーザー操作を契機としてAudioContextを同期的に初期化・再開（アンロック）
 */
function initOrResumeAudioContext() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('[ShutterSound] Web Audio API is not supported in this browser environment.');
      return null;
    }

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(err => {
        console.warn('[ShutterSound] AudioContext resume failed:', err);
      });
    }

    return audioCtx;
  } catch (err) {
    console.warn('[ShutterSound] Error initializing AudioContext:', err);
    return null;
  }
}

/**
 * 初回ユーザー操作時にAudioContextをアンロック
 */
function setupAudioUnlock() {
  const unlockEvents = ['touchstart', 'touchend', 'pointerdown', 'click'];
  const unlockHandler = () => {
    initOrResumeAudioContext();
    unlockEvents.forEach(evt => window.removeEventListener(evt, unlockHandler, true));
  };
  unlockEvents.forEach(evt => window.addEventListener(evt, unlockHandler, { capture: true, once: true }));
}

/**
 * 初回ユーザー操作時にDeviceOrientationパーミッション要求・リスナー開始を実行
 * iOS 13+ Safariのジェスチャー要件を満たし、Android/PC等ではバックグラウンド監視を補強
 */
function setupOrientationUnlock() {
  const unlockEvents = ['click', 'touchend', 'pointerdown'];
  const unlockHandler = () => {
    startOrientationListener(true);
    if (isOrientationListening) {
      unlockEvents.forEach(evt => window.removeEventListener(evt, unlockHandler, true));
    }
  };
  unlockEvents.forEach(evt => window.addEventListener(evt, unlockHandler, { capture: true }));
}

/**
 * シャッター音の再生（撮影ボタンのユーザー操作を起点として即座に同期実行）
 * 音割れ・過度なクリッピングを防ぎつつ、モバイル端末でも明瞭で十分な音量を出力
 */
function playShutterSound() {
  try {
    const ctx = initOrResumeAudioContext();
    if (!ctx) {
      console.warn('[ShutterSound] AudioContext is unavailable.');
      return;
    }

    const t = ctx.currentTime;

    // 音割れ防止と音圧（Loudness）向上のためのダイナミクスコンプレッサー
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-6, t);
    compressor.knee.setValueAtTime(6, t);
    compressor.ratio.setValueAtTime(4, t);
    compressor.attack.setValueAtTime(0.003, t);
    compressor.release.setValueAtTime(0.05, t);
    compressor.connect(ctx.destination);

    // 1. シャッター先幕のメカニカルなクリック音（明瞭なアタック）
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.035);

    oscGain.gain.setValueAtTime(0.75, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    osc.connect(oscGain);
    oscGain.connect(compressor);
    osc.start(t);
    osc.stop(t + 0.04);

    // 2. シャッター幕開閉のノイズ音（「カ・シャッ」の2段エンベロープ）
    const duration = 0.095;
    const sampleRate = ctx.sampleRate || 44100;
    const bufferSize = Math.floor(sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, t);
    filter.Q.setValueAtTime(2.2, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.75, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.12, t + 0.025);
    noiseGain.gain.setValueAtTime(0.95, t + 0.03);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(compressor);

    noise.start(t);
    noise.stop(t + duration);
  } catch (err) {
    console.warn('[ShutterSound] Shutter sound playback error:', err, 'AudioContext state:', audioCtx ? audioCtx.state : 'null');
  }
}

/**
 * タイマー秒数の設定
 */
function setTimerDuration(seconds) {
  currentTimerSeconds = seconds;
  let activeBtn = null;

  if (timerOptionButtons && timerOptionButtons.length > 0) {
    timerOptionButtons.forEach((btn) => {
      const btnSec = parseInt(btn.dataset.timer, 10) || 0;
      const isActive = (btnSec === currentTimerSeconds);
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) activeBtn = btn;
    });
  }

  // セグメントインジケーターのスライド更新
  if (timerSegmentedControl && timerSegmentedIndicator && activeBtn) {
    updateSegmentedIndicator(timerSegmentedControl, timerSegmentedIndicator, activeBtn);
  }
}

/**
 * 進行中のカウントダウンを安全にキャンセル
 */
function cancelCountdown() {
  if (countdownIntervalId) {
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
  }
  isCountingDown = false;
  if (countdownOverlay) {
    countdownOverlay.classList.add('hidden');
  }
}

/**
 * タイマー付き撮影トリガー（0秒時は即座に撮影、3/5/10秒時はカウントダウン後に撮影）
 */
function handleShutterTrigger() {
  // レビュー中または既にカウントダウン実行中の場合は無視
  if (!reviewControls.classList.contains('hidden') || isCountingDown) return;

  // OFF (0秒) の場合は即時撮影
  if (currentTimerSeconds <= 0) {
    takePhoto();
    return;
  }

  // カウントダウン開始
  isCountingDown = true;

  // 編集メニューなどを閉じる
  closeSubmenu();
  closeAdjustmentSheet();
  closeTypographySheet();

  let remaining = currentTimerSeconds;

  if (countdownOverlay && countdownNumber) {
    countdownOverlay.classList.remove('hidden');
    countdownNumber.textContent = remaining;
    countdownNumber.classList.remove('pulse');
    void countdownNumber.offsetWidth; // 強制リフローによるアニメーション再発火
    countdownNumber.classList.add('pulse');
  }

  countdownIntervalId = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      if (countdownNumber) {
        countdownNumber.textContent = remaining;
        countdownNumber.classList.remove('pulse');
        void countdownNumber.offsetWidth;
        countdownNumber.classList.add('pulse');
      }
    } else {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
      if (countdownOverlay) {
        countdownOverlay.classList.add('hidden');
      }
      isCountingDown = false;
      // カウントダウン終了時に撮影（ここでシャッター音・フラッシュが同期実行される）
      takePhoto();
    }
  }, 1000);
}

/**
 * 撮影Canvasへの特殊加工適用関数（6種類の独立・組み合わせ可能な高品質ピクセル/Canvas処理）
 * 順序: カメラ/AR(通常加工) → 特殊加工(モザイク・ブラー・色収差・ポスタライズ・二階調・ノイズ) → ビネット → Typography
 */
function applySpecialEffectsToCanvas(targetCanvas, values) {
  if (!targetCanvas || !values) return;
  const { threshold, mosaic, blur, chromaticAberration, posterize, noise } = values;

  // すべて0の場合は何もしない
  if (
    (!threshold || threshold <= 0) &&
    (!mosaic || mosaic <= 0) &&
    (!blur || blur <= 0) &&
    (!chromaticAberration || chromaticAberration <= 0) &&
    (!posterize || posterize <= 0) &&
    (!noise || noise <= 0)
  ) {
    return;
  }

  const w = targetCanvas.width;
  const h = targetCanvas.height;
  if (w <= 0 || h <= 0) return;

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  // 1. モザイク（均一な正方形グリッド ＆ 代表色サンプリングによる規則的モザイク画）
  if (mosaic && mosaic > 0) {
    const t = mosaic / 100;
    // 解像度非依存のグリッド分割数（横方向の正方形セル列数）
    // 0: 元画像
    // 25: 少しモザイク（横約52列の細かいグリッド）
    // 50: はっきりモザイク（横約24列の明確な正方形）
    // 75: かなり粗い（横約12列）
    // 100: 明確な大きい正方形グリッド（横わずか5列の巨大正方形ブロック！圧倒的な粗さ！）
    const maxCols = 80;
    const minCols = 5;
    const p = Math.pow(t, 1.4);
    const numCols = Math.max(minCols, Math.round(maxCols * Math.pow(minCols / maxCols, p)));
    const cellSize = Math.max(2, Math.round(w / numCols));

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // グリッド単位でセル内の代表色（平均色）を計算して境界線のない綺麗な正方形セルを塗りつぶす
    for (let y = 0; y < h; y += cellSize) {
      const cellH = Math.min(cellSize, h - y);
      for (let x = 0; x < w; x += cellSize) {
        const cellW = Math.min(cellSize, w - x);
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        const stepX = Math.max(1, Math.floor(cellW / 4));
        const stepY = Math.max(1, Math.floor(cellH / 4));

        for (let sy = y; sy < y + cellH; sy += stepY) {
          const rowOffset = sy * w * 4;
          for (let sx = x; sx < x + cellW; sx += stepX) {
            const idx = rowOffset + sx * 4;
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
            count++;
          }
        }

        const avgR = count > 0 ? ((sumR / count) | 0) : data[(y * w + x) * 4];
        const avgG = count > 0 ? ((sumG / count) | 0) : data[(y * w + x) * 4 + 1];
        const avgB = count > 0 ? ((sumB / count) | 0) : data[(y * w + x) * 4 + 2];

        for (let sy = y; sy < y + cellH; sy++) {
          const rowOffset = sy * w * 4;
          for (let sx = x; sx < x + cellW; sx++) {
            const idx = rowOffset + sx * 4;
            data[idx] = avgR;
            data[idx + 1] = avgG;
            data[idx + 2] = avgB;
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // 2. ブラー（Canvas filter blur による高精度平滑化）
  if (blur && blur > 0) {
    const blurRadius = (blur / 100) * Math.max(2, w * 0.022);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.filter = `blur(${blurRadius.toFixed(2)}px)`;
      tempCtx.drawImage(targetCanvas, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tempCanvas, 0, 0);
    }
  }

  // ピクセルレベル操作（色収差、ポスタライズ、二階調、ノイズ）
  if (
    (chromaticAberration && chromaticAberration > 0) ||
    (posterize && posterize > 0) ||
    (threshold && threshold > 0) ||
    (noise && noise > 0)
  ) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const len = data.length;

    // 3. 色収差（RGBチャンネル分離・輪郭エッジずれ）
    // Rチャンネルを左シフト、Gチャンネルを基準、Bチャンネルを右シフト
    if (chromaticAberration && chromaticAberration > 0) {
      const shift = Math.max(2, Math.round((chromaticAberration / 100) * (w * 0.024)));
      const srcData = new Uint8ClampedArray(data);
      for (let y = 0; y < h; y++) {
        const rowOffset = y * w * 4;
        for (let x = 0; x < w; x++) {
          const idx = rowOffset + x * 4;
          // Red チャンネルを -shift (左)
          const rx = Math.max(0, x - shift);
          const rIdx = rowOffset + rx * 4;
          data[idx] = srcData[rIdx];

          // Green チャンネルはそのまま (基準)
          data[idx + 1] = srcData[idx + 1];

          // Blue チャンネルを +shift (右)
          const bx = Math.min(w - 1, x + shift);
          const bIdx = rowOffset + bx * 4;
          data[idx + 2] = srcData[bIdx + 2];
        }
      }
    }

    // 4. ポスタライズ（階調数の離散化・0〜100で滑らかに階調減少）
    if (posterize && posterize > 0) {
      const levels = Math.max(3, Math.round(24 - (posterize / 100) * 21));
      const step = 255 / (levels - 1);
      for (let i = 0; i < len; i += 4) {
        data[i] = Math.round(Math.round(data[i] / step) * step);
        data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
        data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
      }
    }

    // 5. 二階調（輝度判定による白黒2階調化・0〜100で連続変化）
    if (threshold && threshold > 0) {
      const blend = threshold / 100;
      for (let i = 0; i < len; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const targetVal = lum >= 128 ? 255 : 0;
        data[i] = Math.round(r * (1 - blend) + targetVal * blend);
        data[i + 1] = Math.round(g * (1 - blend) + targetVal * blend);
        data[i + 2] = Math.round(b * (1 - blend) + targetVal * blend);
      }
    }

    // 6. ノイズ（ランダムノイズの加算合成）
    if (noise && noise > 0) {
      const maxNoise = (noise / 100) * 65;
      for (let i = 0; i < len; i += 4) {
        const rand = (Math.random() - 0.5) * maxNoise * 2;
        data[i] = Math.min(255, Math.max(0, data[i] + rand));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + rand));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + rand));
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }
}

/**
 * 写真を撮影する関数（フレーム切り抜き + 3D ARオブジェクト + 特殊加工 + ビネット + 日時タイポグラフィDOMラスタライズ合成）
 */
async function takePhoto() {
  // 1. ユーザー操作起点で同期的にシャッター音と白フラッシュを実行（最優先）
  playShutterSound();

  if (flashEffect) {
    flashEffect.classList.add('active');
    setTimeout(() => {
      flashEffect.classList.remove('active');
    }, 150);
  }

  // サブメニュー・加工シート・特殊加工シート・文字シートが開いていれば閉じる
  closeSubmenu();
  closeAdjustmentSheet();
  closeSpecialSheet();
  closeTypographySheet();

  const video = getActiveVideo();
  if (!video || !video.videoWidth || !video.videoHeight) {
    console.warn('Cannot take photo: Video stream is not ready');
    return;
  }

  // 撮影時点の確定日時を取得
  const snapDateParts = getCurrentDateTimeParts();

  // 現在の画面と撮影フレームの寸法を取得
  const containerRect = cameraContainer.getBoundingClientRect();
  const frameRect = captureFrame.getBoundingClientRect();

  const containerW = containerRect.width;
  const containerH = containerRect.height;
  const vW = video.videoWidth;
  const vH = video.videoHeight;

  // object-fit: cover によるスケール倍率と表示オフセットを算出
  const scale = Math.max(containerW / vW, containerH / vH);
  const renderedW = vW * scale;
  const renderedH = vH * scale;
  const vOffsetX = (containerW - renderedW) / 2;
  const vOffsetY = (containerH - renderedH) / 2;

  // 撮影フレームのコンテナ基準座標
  const frameX = frameRect.left - containerRect.left;
  const frameY = frameRect.top - containerRect.top;
  const frameW = frameRect.width;
  const frameH = frameRect.height;

  // ビデオ実ピクセル上の切り抜き座標とサイズ
  let cropX = (frameX - vOffsetX) / scale;
  let cropY = (frameY - vOffsetY) / scale;
  let cropW = frameW / scale;
  let cropH = frameH / scale;

  // カメラズーム（Software Zoom）の適用: フレーム中心を基準にズーム倍率分クロップ矩形を縮小
  if (cameraZoom > 1.0) {
    const origCropCenterX = cropX + cropW / 2;
    const origCropCenterY = cropY + cropH / 2;
    cropW = cropW / cameraZoom;
    cropH = cropH / cameraZoom;
    cropX = origCropCenterX - cropW / 2;
    cropY = origCropCenterY - cropH / 2;
  }

  // 前面カメラで左右反転している場合の座標補正
  if (currentFacingMode === 'user') {
    cropX = vW - cropX - cropW;
  }

  // Canvasの解像度を設定（高画質な解像度を保持）
  canvas.width = Math.round(cropW);
  canvas.height = Math.round(cropH);

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // カメラ映像＋ARオブジェクトに適用する画像加工フィルタ
  const filterStr = buildCssFilterString();
  ctx.filter = filterStr;

  // 1. カメラ映像の描画（加工フィルタ適用）
  if (currentFacingMode === 'user') {
    // 前面カメラの場合は映像のみ水平反転して描画（プレビューと同じ向き）
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      video,
      cropX, cropY, cropW, cropH,
      0, 0, canvas.width, canvas.height
    );
    ctx.restore();
  } else {
    ctx.drawImage(
      video,
      cropX, cropY, cropW, cropH,
      0, 0, canvas.width, canvas.height
    );
  }

  // 2. AR.js / A-Frame の 3D ARオブジェクトを描画・合成（加工フィルタ適用）
  const sceneEl = document.querySelector('a-scene');
  if (sceneEl && sceneEl.renderer && sceneEl.camera) {
    try {
      sceneEl.renderer.render(sceneEl.object3D, sceneEl.camera);
    } catch (e) {
      console.warn('Scene render error:', e);
    }
  }
  const aCanvas = (sceneEl && sceneEl.canvas) || document.querySelector('.a-canvas');
  if (aCanvas && aCanvas.width > 0 && aCanvas.height > 0) {
    const scaleCanvas = aCanvas.width / renderedW;
    let arCropX = (frameX - vOffsetX) * scaleCanvas;
    let arCropY = (frameY - vOffsetY) * scaleCanvas;
    let arCropW = frameW * scaleCanvas;
    let arCropH = frameH * scaleCanvas;

    if (cameraZoom > 1.0) {
      const origArCenterX = arCropX + arCropW / 2;
      const origArCenterY = arCropY + arCropH / 2;
      arCropW = arCropW / cameraZoom;
      arCropH = arCropH / cameraZoom;
      arCropX = origArCenterX - arCropW / 2;
      arCropY = origArCenterY - arCropH / 2;
    }

    if (currentFacingMode === 'user') {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(
        aCanvas,
        arCropX, arCropY, arCropW, arCropH,
        0, 0, canvas.width, canvas.height
      );
      ctx.restore();
    } else {
      ctx.drawImage(
        aCanvas,
        arCropX, arCropY, arCropW, arCropH,
        0, 0, canvas.width, canvas.height
      );
    }
  }

  // 3. 特殊加工（モザイク・ブラー・色収差・ポスタライズ・二階調・ノイズ）を撮影Canvasへ適用
  ctx.filter = 'none';
  applySpecialEffectsToCanvas(canvas, specialEffectValues);

  // 4. ビネット効果（画面端の暗転）を合成（※ タイポグラフィより前層に合成）
  const vig = adjustmentValues.vignette || 0;
  if (vig > 0) {
    ctx.save();
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
    const innerRadius = maxRadius * 0.35;
    const vigGradient = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, maxRadius);
    vigGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGradient.addColorStop(1, `rgba(0, 0, 0, ${(vig * 0.0088).toFixed(3)})`);
    ctx.fillStyle = vigGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // 5. タイポグラフィCanvas（画面表示と100%同一のレンダリング結果）を撮影Canvasへ最高品質で合成
  // ※ タイポグラフィ文字には加工フィルタを適用しない（純白・鮮明・クリアを保証）
  if (typographyCanvas) {
    // 撮影直前の確定解像度と日時を再同期（1:1ダイレクト合成の保証）
    if (typographyCanvas.width !== canvas.width || typographyCanvas.height !== canvas.height) {
      typographyCanvas.width = canvas.width;
      typographyCanvas.height = canvas.height;
    }
    renderTypographyToCanvas(typographyCanvas, snapDateParts);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(typographyCanvas, 0, 0, canvas.width, canvas.height);
  }

  // 6. 完成写真のDataURLを最高品質（0.98）で生成してプレビューにセット
  capturedImageDataUrl = canvas.toDataURL('image/jpeg', 0.98);
  photoPreview.src = capturedImageDataUrl;

  // プレビュー表示モードへ切り替え
  showReviewMode();
}

/**
 * 撮影後のプレビュー画面へ切り替え
 */
function showReviewMode() {
  photoPreview.classList.remove('hidden');
  if (typographyCanvas) typographyCanvas.classList.add('hidden'); // 焼き込み済み画像を表示するためオーバーレイは隠す

  // ARシーンをプレビュー中は非表示にして背後で重ならないようにする
  if (arScene) {
    arScene.style.opacity = '0';
    arScene.style.pointerEvents = 'none';
  }

  captureControls.classList.add('hidden');
  reviewControls.classList.remove('hidden');

  stopClock();
  const video = getActiveVideo();
  if (video) {
    video.pause();
  }
}

/**
 * 撮り直し（カメラ画面へ戻る）
 */
function retakePhoto() {
  photoPreview.classList.add('hidden');
  photoPreview.src = '';
  capturedImageDataUrl = null;

  if (typographyCanvas) typographyCanvas.classList.remove('hidden');

  // ARシーンの表示を再開
  if (arScene) {
    arScene.style.opacity = '1';
  }

  reviewControls.classList.add('hidden');
  captureControls.classList.remove('hidden');

  const video = getActiveVideo();
  if (video) {
    video.play().catch(() => {});
  }
  startClock();
}

/**
 * 撮影した写真を保存（ダウンロード）
 */
function savePhoto() {
  if (!capturedImageDataUrl) return;

  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const ratioLabel = selectedRatio.replace(':', '_');
  const isLandscape = window.innerWidth > window.innerHeight;
  const orientationLabel = isLandscape ? 'landscape' : 'portrait';
  const fileName = `photo_${ratioLabel}_${orientationLabel}_${timestamp}.jpg`;

  const link = document.createElement('a');
  link.href = capturedImageDataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 撮影した写真を共有（Web Share API / フォールバックとして保存）
 */
async function sharePhoto() {
  if (!capturedImageDataUrl) return;

  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const ratioLabel = selectedRatio.replace(':', '_');
  const isLandscape = window.innerWidth > window.innerHeight;
  const orientationLabel = isLandscape ? 'landscape' : 'portrait';
  const fileName = `photo_${ratioLabel}_${orientationLabel}_${timestamp}.jpg`;

  // Web Share API（ファイルの共有）をサポートしているか検証
  if (navigator.canShare && navigator.share) {
    try {
      const res = await fetch(capturedImageDataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: 'image/jpeg' });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'AR Photo'
        });
        return;
      }
    } catch (err) {
      // ユーザーによる共有キャンセル時は何もしない
      if (err && err.name === 'AbortError') {
        return;
      }
      console.warn('Web Share API failed, falling back to download:', err);
    }
  }

  // Web Share API非対応または共有不可時のフォールバック：既存の保存を実行
  savePhoto();
}

/**
 * 内カメラ / 外カメラの切り替え
 */
function toggleCamera() {
  closeSubmenu();
  currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
  switchCameraFacingMode();
}

/**
 * ステータスメッセージ表示
 */
function showStatus(htmlMessage, showRetryButton = false) {
  statusText.innerHTML = htmlMessage;
  if (showRetryButton) {
    retryCameraBtn.classList.remove('hidden');
  } else {
    retryCameraBtn.classList.add('hidden');
  }
  statusMessage.classList.remove('hidden');
}

/**
 * ステータスメッセージ非表示
 */
function hideStatus() {
  statusMessage.classList.add('hidden');
}

/**
 * 複数マーカーおよびARオブジェクトの定義と独立状態管理
 * Hiro -> Cube, Kanji -> Sphere
 * 将来的にMarker A / B / C、3Dモデル(OBJ/GLTF)、透過PNGフォトフレーム、Custom Imageなどを追加しやすい拡張構造
 */
const AR_MARKERS_CONFIG = {
  'hiro-marker': {
    id: 'hiro-marker',
    name: 'Hiro',
    preset: 'hiro',
    objectType: 'cube',
    targetSelector: '#ar-cube',
    initialPosition: { x: 0, y: 0.5, z: 0 },
    initialRotation: { x: 0, y: 45, z: 0 },
    initialScale: { x: 1, y: 1, z: 1 },
    state: {
      scale: 1.0,
      rotationY: 45,
      isFound: false
    }
  },
  'kanji-marker': {
    id: 'kanji-marker',
    name: 'Kanji',
    preset: 'kanji',
    objectType: 'sphere',
    targetSelector: '#ar-sphere',
    initialPosition: { x: 0, y: 0.5, z: 0 },
    initialRotation: { x: 0, y: 0, z: 0 },
    initialScale: { x: 1, y: 1, z: 1 },
    state: {
      scale: 1.0,
      rotationY: 0,
      isFound: false
    }
  }
};

const MIN_SCALE = 0.25;
const MAX_SCALE = 4.5;
const ROTATION_SENSITIVITY = 0.4; // 1ピクセル移動あたりの回転角度(deg)

let lastActiveMarkerId = 'hiro-marker';

/**
 * Custom ARマーカー・独自画像オブジェクトの探索
 * ① 既存targetSelector
 * ② marker内の代表表示オブジェクト（a-image, a-box, a-sphere, a-plane, a-entity, a-gltf-model, a-cylinder 等）
 */
function findVisualElementInsideMarker(markerEl) {
  if (!markerEl) return null;

  // 優先探索セレクタリスト
  const selectors = [
    'a-image',
    'a-gltf-model',
    'a-box',
    'a-sphere',
    'a-cylinder',
    'a-plane',
    'a-entity[gltf-model]',
    'a-entity[geometry]',
    'a-entity:not([camera]):not([cursor])'
  ];

  for (let sel of selectors) {
    const el = markerEl.querySelector(sel);
    if (el) return el;
  }

  // 子要素の探索
  for (let child of Array.from(markerEl.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag !== 'a-camera' && tag !== 'a-cursor' && tag !== 'a-light') {
      return child;
    }
  }

  return null;
}

/**
 * 指定マーカーのAR要素を取得
 * 既存設定の targetSelector を最優先し、見つからない場合は該当 marker 内部の表示オブジェクトを動的探索
 */
function getArElementForMarker(markerId) {
  const config = AR_MARKERS_CONFIG[markerId];
  if (config && config.targetSelector) {
    const el = document.querySelector(config.targetSelector);
    if (el) return el;
  }

  const markerEl = document.getElementById(markerId);
  if (markerEl) {
    return findVisualElementInsideMarker(markerEl);
  }

  return null;
}

/**
 * シーン内のすべての a-marker を走査し、Custom marker があれば既存設定を壊さず自動登録
 */
function scanAndRegisterCustomMarkers() {
  const markerEls = document.querySelectorAll('a-scene a-marker');
  markerEls.forEach((markerEl, index) => {
    const markerId = markerEl.id || `custom-marker-${index}`;
    if (!markerEl.id) {
      markerEl.id = markerId;
    }

    // 既存設定があれば上書きしない（Hiro / Kanji は完全保護）
    if (!AR_MARKERS_CONFIG[markerId]) {
      const visualEl = findVisualElementInsideMarker(markerEl);

      AR_MARKERS_CONFIG[markerId] = {
        id: markerId,
        name: markerEl.getAttribute('preset') || markerId,
        preset: markerEl.getAttribute('preset') || 'custom',
        objectType: visualEl ? visualEl.tagName.toLowerCase().replace('a-', '') : 'custom',
        targetSelector: visualEl && visualEl.id ? `#${visualEl.id}` : null,
        initialQuaternion: null, // A-Frame初期化完了後またはドラッグ時に正しく保存
        state: {
          scale: 1.0,
          rotationY: 0,
          isFound: false
        }
      };

      // イベントリスナー登録
      markerEl.addEventListener('markerFound', () => {
        if (AR_MARKERS_CONFIG[markerId] && AR_MARKERS_CONFIG[markerId].state) {
          AR_MARKERS_CONFIG[markerId].state.isFound = true;
        }
        lastActiveMarkerId = markerId;
      });
      markerEl.addEventListener('markerLost', () => {
        if (AR_MARKERS_CONFIG[markerId] && AR_MARKERS_CONFIG[markerId].state) {
          AR_MARKERS_CONFIG[markerId].state.isFound = false;
        }
      });
    }
  });
}

/**
 * 指定マーカーのスケールのみを反映（Three.js Object3D のみで完結）
 * A-Frame の setAttribute('scale') による DOM/Transform 再同期（rotation巻き込み）を防ぐため
 * el.object3D.scale のみを更新し、rotation や position には一切触れない
 */
function applyMarkerScale(markerId) {
  const config = AR_MARKERS_CONFIG[markerId];
  if (!config || !config.state) return;
  const el = getArElementForMarker(markerId);
  if (!el || !el.object3D) return;

  const s = config.state.scale;
  el.object3D.scale.set(s, s, s);
}

/**
 * 指定マーカーの回転のみを反映（Three.js Object3D）
 * scale や position には一切触れない
 * - Hiro / Kanji: 既存の初期角度（Hiro: 45°, Kanji: 0°）およびY軸回転を維持
 * - Custom: JavaScript側で初期回転を一切強制設定せず、HTML/A-Frameの生成姿勢を100%そのまま使用。
 *   rY === 0 の初期状態では rotation/quaternion に一切書き込まない。
 *   ユーザーがドラッグ操作（rY !== 0）を行った場合のみ、HTML/A-Frame初期姿勢に対するマーカー法線（Y軸）周りの相対回転を適用。
 */
function applyMarkerRotation(markerId) {
  const config = AR_MARKERS_CONFIG[markerId];
  if (!config || !config.state) return;
  const el = getArElementForMarker(markerId);
  if (!el || !el.object3D) return;

  const rY = config.state.rotationY;

  if (markerId === 'hiro-marker' || markerId === 'kanji-marker') {
    el.setAttribute('rotation', `0 ${rY} 0`);
    el.object3D.rotation.set(0, THREE.MathUtils.degToRad(rY), 0);
    return;
  }

  // Custom オブジェクトの場合：
  // ユーザーが一度も回転ドラッグしていない初期状態（rY === 0）では、
  // JavaScriptから rotation/quaternion を一切書き換えない（HTML/A-Frameの初期姿勢を100%そのまま保持）
  if (rY === 0) {
    return;
  }

  // 初回ドラッグ操作時に初期クォータニオンが未保存であれば、現在のA-Frame生成姿勢を初期姿勢として保存
  if (!config.initialQuaternion) {
    config.initialQuaternion = el.object3D.quaternion.clone();
  }

  // 初期姿勢に対してユーザー回転量 rY（Y軸周り）を合成
  const qBase = config.initialQuaternion.clone();
  const qUserRot = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.degToRad(rY)
  );

  // マーカー座標系のY軸周り回転を合成して適用
  qUserRot.multiply(qBase);
  el.object3D.quaternion.copy(qUserRot);
}

/**
 * 指定マーカーの位置のみを反映
 */
function applyMarkerPosition(markerId) {
  const el = getArElementForMarker(markerId);
  if (!el) return;

  if (markerId === 'hiro-marker' || markerId === 'kanji-marker') {
    el.setAttribute('position', '0 0.5 0');
    if (el.object3D) {
      el.object3D.position.set(0, 0.5, 0);
    }
  }
}

/**
 * 初期化時またはリセット時用の一括トランスフォーム反映
 */
function applyTransformForMarker(markerId) {
  applyMarkerPosition(markerId);
  applyMarkerScale(markerId);
  applyMarkerRotation(markerId);
}

/**
 * すべてのマーカーのトランスフォームを適用
 */
function applyAllTransforms() {
  Object.keys(AR_MARKERS_CONFIG).forEach(markerId => {
    applyTransformForMarker(markerId);
  });
}

/**
 * 操作対象のマーカーを特定
 * - 認識中のマーカーが1つの場合: 距離判定（maxDistance指定時）を満たせばそのマーカー、満たさなければnull
 * - 複数認識中の場合: スクリーン座標（画面上の2D投影距離）でタッチ/マウス位置に最も近いマーカー（maxDistance判定あり）
 * - 認識されていない場合、または距離閾値（maxDistance）を超える場合: maxDistance指定時はnull、未指定時はlastActiveMarkerId
 */
function getTargetMarkerId(clientX, clientY, maxDistance = null) {
  const sceneEl = document.querySelector('a-scene');
  const camera = sceneEl && sceneEl.camera;
  const aCanvas = (sceneEl && sceneEl.canvas) || document.querySelector('.a-canvas');
  
  // 現在認識中のマーカー一覧
  const foundMarkers = Object.keys(AR_MARKERS_CONFIG).filter(id => AR_MARKERS_CONFIG[id].state && AR_MARKERS_CONFIG[id].state.isFound);

  if (foundMarkers.length > 0 && camera) {
    // 実際のAR Canvasの画面表示領域（getBoundingClientRect: cover配置、margin、scale(cameraZoom)を正確に反映）を取得
    const rect = aCanvas ? aCanvas.getBoundingClientRect() : null;
    const hasValidRect = rect && rect.width > 0 && rect.height > 0;
    const canvasLeft = hasValidRect ? rect.left : 0;
    const canvasTop = hasValidRect ? rect.top : 0;
    const canvasWidth = hasValidRect ? rect.width : window.innerWidth;
    const canvasHeight = hasValidRect ? rect.height : window.innerHeight;
    const isUserMode = (currentFacingMode === 'user');

    let closestId = null;
    let minDistanceSq = Infinity;
    let closestEffectiveThreshold = maxDistance ? (maxDistance * maxDistance) : Infinity;

    foundMarkers.forEach(markerId => {
      const el = getArElementForMarker(markerId);
      const markerConfig = AR_MARKERS_CONFIG[markerId];
      if (el && el.object3D) {
        const worldPos = new THREE.Vector3();
        el.object3D.getWorldPosition(worldPos);
        const projected = worldPos.clone().project(camera);

        // カメラ前方に存在するか判定（z <= 1.0）
        if (projected.z <= 1.0) {
          // NDC座標（-1〜+1）を画面上の実際のピクセル座標（clientX / clientY基準）に高精度変換
          // 前面カメラ（ミラー反転）時はX座標の左右を反転
          let sx;
          if (isUserMode) {
            sx = canvasLeft + ((-projected.x + 1) / 2) * canvasWidth;
          } else {
            sx = canvasLeft + ((projected.x + 1) / 2) * canvasWidth;
          }
          const sy = canvasTop + ((-projected.y + 1) / 2) * canvasHeight;

          const distSq = (clientX - sx) ** 2 + (clientY - sy) ** 2;

          // オブジェクトの現在のscaleを考慮した実効ヒット半径（基本120px、拡大時はオブジェクトサイズに自然追従）
          const currentScale = (markerConfig && markerConfig.state && markerConfig.state.scale) ? markerConfig.state.scale : 1.0;
          const effectiveMaxDist = maxDistance !== null ? Math.max(maxDistance, maxDistance * Math.min(currentScale, 2.5) * 0.75) : null;
          const effectiveThresholdSq = effectiveMaxDist !== null ? (effectiveMaxDist * effectiveMaxDist) : Infinity;

          if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            closestId = markerId;
            closestEffectiveThreshold = effectiveThresholdSq;
          }
        }
      }
    });

    if (closestId) {
      if (maxDistance !== null) {
        if (minDistanceSq <= closestEffectiveThreshold) {
          lastActiveMarkerId = closestId;
          return closestId;
        }
        return null;
      }
      lastActiveMarkerId = closestId;
      return closestId;
    }
  }

  if (maxDistance !== null) {
    return null;
  }

  // 距離指定なし（ドラッグ回転等）の場合、現在認識中のマーカーがあればそれを優先
  if (foundMarkers.length > 0) {
    return foundMarkers[0];
  }

  return lastActiveMarkerId || 'hiro-marker';
}

/**
 * すべてのARオブジェクトを初期状態へリセット
 */
function resetAllTransforms() {
  Object.keys(AR_MARKERS_CONFIG).forEach(markerId => {
    const config = AR_MARKERS_CONFIG[markerId];
    if (config && config.state) {
      config.state.scale = 1.0;
      if (markerId === 'hiro-marker') {
        config.state.rotationY = 45;
      } else if (markerId === 'kanji-marker') {
        config.state.rotationY = 0;
      } else {
        config.state.rotationY = 0;
        // Custom オブジェクトは A-Frame 初期化完了時に保存した初期姿勢へ復元
        const el = getArElementForMarker(markerId);
        if (el && el.object3D && config.initialQuaternion) {
          el.object3D.quaternion.copy(config.initialQuaternion);
        }
      }
    }
  });
  applyAllTransforms();
}

/**
 * ARオブジェクトの操作機能（スケール & Y軸1軸回転）
 * - Hiro（Cube）とKanji（Sphere）は完全に独立した状態として管理
 * - 移動は実装せず position は常に固定（0 0.5 0）
 * - 拡大・縮小：PCはマウスホイール、スマートフォンは2本指ピンチ操作（縦横比完全維持）
 * - 回転：PCはドラッグ、スマートフォンは1本指左右ドラッグ（Y軸1軸回転固定）
 */
function initArObjectInteraction() {
  // シーン内のすべての a-marker（カスタム含む）を走査・登録
  scanAndRegisterCustomMarkers();

  // 初期状態を適用（Hiro/Kanjiのスケール・回転、Customのスケールのみ反映）
  applyAllTransforms();

  // シーンの読み込み完了時にもカスタムマーカーの補完走査とリセット用初期姿勢の記録を実施
  const sceneEl = document.querySelector('a-scene');
  if (sceneEl) {
    const onSceneReady = () => {
      scanAndRegisterCustomMarkers();
      // A-Frame初期化完了後の正規の姿勢をリセット用基準値として一度だけ保存
      Object.keys(AR_MARKERS_CONFIG).forEach(markerId => {
        if (markerId !== 'hiro-marker' && markerId !== 'kanji-marker') {
          const config = AR_MARKERS_CONFIG[markerId];
          const el = getArElementForMarker(markerId);
          if (config && el && el.object3D && !config.initialQuaternion) {
            config.initialQuaternion = el.object3D.quaternion.clone();
          }
        }
      });
    };

    if (sceneEl.hasLoaded) {
      onSceneReady();
    } else {
      sceneEl.addEventListener('loaded', onSceneReady);
    }
  }

  // 各マーカーの認識イベント登録
  Object.keys(AR_MARKERS_CONFIG).forEach(markerId => {
    const markerEl = document.getElementById(markerId);
    if (markerEl) {
      markerEl.addEventListener('markerFound', () => {
        if (AR_MARKERS_CONFIG[markerId] && AR_MARKERS_CONFIG[markerId].state) {
          AR_MARKERS_CONFIG[markerId].state.isFound = true;
        }
        lastActiveMarkerId = markerId;
      });
      markerEl.addEventListener('markerLost', () => {
        if (AR_MARKERS_CONFIG[markerId] && AR_MARKERS_CONFIG[markerId].state) {
          AR_MARKERS_CONFIG[markerId].state.isFound = false;
        }
      });
    }
  });

  // インタラクティブUI（ボタン・メニュー・加工シート・特殊加工シート・文字シート・プレビュー画面等）上での誤操作防止判定
  function isInteractiveUiElement(target) {
    if (!target) return false;
    return !!target.closest(
      '#capture-controls, #review-controls, .controls-bar, .submenu-panel, .submenu-item, .ratio-opt-btn, #adjustment-sheet, #special-adjustment-sheet, .special-sheet, #typography-sheet, .typography-sheet, .sheet-tab-btn, .custom-range-slider, .sheet-drag-handle-container, .sheet-close-btn, .font-card, .font-cards-scroll, #status-message, button, .icon-btn, .shutter-btn, .photo-preview, .preview-actions'
    );
  }

  function isReviewing() {
    return reviewControls && !reviewControls.classList.contains('hidden');
  }

  function isUsageOpen() {
    return usageOverlay && !usageOverlay.classList.contains('hidden');
  }

  // インタラクティブUI（ボタン・メニュー・加工シート・特殊加工シート・文字シート・撮影設定シート・プレビュー画面・使い方画面等）上での誤操作防止判定
  function isInteractiveUiElement(target) {
    if (!target) return false;
    if (isUsageOpen()) return true;
    return !!target.closest(
      '#usage-overlay, .usage-overlay, #usage-content, .usage-content, #usage-close-btn, .usage-close-btn, #capture-controls, #review-controls, .controls-bar, .submenu-panel, .submenu-item, .ratio-opt-btn, #adjustment-sheet, #special-adjustment-sheet, .special-sheet, #typography-sheet, .typography-sheet, #capture-settings-sheet, .capture-settings-sheet, .sheet-tab-btn, .setting-pill-btn, .custom-range-slider, .sheet-drag-handle-container, .sheet-close-btn, .font-card, .font-cards-scroll, #status-message, button, .icon-btn, .shutter-btn, .photo-preview, .preview-actions'
    );
  }

  const AR_PINCH_MAX_DISTANCE = 120; // ARオブジェクトと判定する距離閾値 (px)

  // === 1. PC: マウスホイールによる拡大・縮小 / カメラズーム ===
  window.addEventListener('wheel', (e) => {
    if (isUsageOpen() || isReviewing() || isInteractiveUiElement(e.target)) return;

    e.preventDefault();
    const targetMarkerId = getTargetMarkerId(e.clientX, e.clientY, AR_PINCH_MAX_DISTANCE);

    if (targetMarkerId && AR_MARKERS_CONFIG[targetMarkerId]) {
      // 120px以内の認識中ARオブジェクトの拡大・縮小（Scale のみ変更し Rotation には一切触れない）
      const targetConfig = AR_MARKERS_CONFIG[targetMarkerId];
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      targetConfig.state.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetConfig.state.scale * zoomFactor));
      applyMarkerScale(targetMarkerId);
    } else {
      // カメラズーム（1.0x 〜 3.0x）: 上回転でズームイン、下回転でズームアウト
      const zoomStep = e.deltaY < 0 ? 0.08 : -0.08;
      setCameraZoom(cameraZoom + zoomStep, true);
    }
  }, { passive: false });

  // === 2. PC: マウスドラッグによるY軸1軸回転 ===
  let isMouseDragging = false;
  let lastMouseX = 0;
  let activeDragMarkerId = null;

  window.addEventListener('mousedown', (e) => {
    if (isUsageOpen() || isReviewing() || isInteractiveUiElement(e.target) || e.button !== 0) return;
    isMouseDragging = true;
    lastMouseX = e.clientX;
    activeDragMarkerId = getTargetMarkerId(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => {
    if (isUsageOpen() || !isMouseDragging || isReviewing() || !activeDragMarkerId) return;
    const deltaX = e.clientX - lastMouseX;
    lastMouseX = e.clientX;
    const targetConfig = AR_MARKERS_CONFIG[activeDragMarkerId];
    if (targetConfig) {
      targetConfig.state.rotationY = (targetConfig.state.rotationY + deltaX * ROTATION_SENSITIVITY) % 360;
      applyMarkerRotation(activeDragMarkerId);
    }
  });

  window.addEventListener('mouseup', () => {
    isMouseDragging = false;
    activeDragMarkerId = null;
  });

  // === 3. スマートフォン: タッチ操作（1本指左右ドラッグ回転 / 2本指ピンチ拡大縮小 / カメラズーム） ===
  let lastTouchX = 0;
  let initialPinchDistance = null;
  let pinchStartScale = 1.0;
  let pinchStartCameraZoom = 1.0;
  let pinchMode = null; // 'ar' | 'camera' | null
  let activeTouchMarkerId = null;
  let isPinchingActive = false; // ピンチジェスチャー中フラグ（終了時に全指が離れるまでドラッグ誤発火を防止）

  window.addEventListener('touchstart', (e) => {
    if (isUsageOpen() || isReviewing() || isInteractiveUiElement(e.target)) {
      initialPinchDistance = null;
      pinchMode = null;
      activeTouchMarkerId = null;
      isPinchingActive = false;
      return;
    }

    if (e.touches.length === 1 && !isPinchingActive) {
      // 1本指回転開始（ピンチジェスチャー終了後の残留指でない場合のみ）
      lastTouchX = e.touches[0].clientX;
      activeTouchMarkerId = getTargetMarkerId(e.touches[0].clientX, e.touches[0].clientY);
      initialPinchDistance = null;
      pinchMode = null;
    } else if (e.touches.length >= 2) {
      // 2本指ピンチ開始: 直前の1本指ドラッグ状態を即座に破棄・解除
      isPinchingActive = true;

      // ピンチ中心座標を算出
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      // 認識中ARオブジェクトから120px以内であればARオブジェクトのスケール操作、それ以外はカメラズーム操作
      let targetArId = getTargetMarkerId(midX, midY, AR_PINCH_MAX_DISTANCE);
      if (!targetArId) {
        targetArId = getTargetMarkerId(e.touches[0].clientX, e.touches[0].clientY, AR_PINCH_MAX_DISTANCE) ||
                     getTargetMarkerId(e.touches[1].clientX, e.touches[1].clientY, AR_PINCH_MAX_DISTANCE) ||
                     (activeTouchMarkerId && AR_MARKERS_CONFIG[activeTouchMarkerId] && AR_MARKERS_CONFIG[activeTouchMarkerId].state.isFound ? activeTouchMarkerId : null);
      }
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDistance = Math.hypot(dx, dy);

      if (targetArId && AR_MARKERS_CONFIG[targetArId]) {
        pinchMode = 'ar';
        activeTouchMarkerId = targetArId;
        pinchStartScale = AR_MARKERS_CONFIG[targetArId].state.scale || 1.0;
      } else {
        pinchMode = 'camera';
        activeTouchMarkerId = null;
        pinchStartCameraZoom = cameraZoom;
      }
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (isUsageOpen() || isReviewing() || isInteractiveUiElement(e.target)) return;

    if (e.touches.length === 1 && !isPinchingActive && !pinchMode && activeTouchMarkerId) {
      // 1本指左右ドラッグでARオブジェクト回転（Rotation のみ変更）
      const targetConfig = AR_MARKERS_CONFIG[activeTouchMarkerId];
      if (!targetConfig) return;
      const touchX = e.touches[0].clientX;
      const deltaX = touchX - lastTouchX;
      lastTouchX = touchX;
      targetConfig.state.rotationY = (targetConfig.state.rotationY + deltaX * ROTATION_SENSITIVITY) % 360;
      applyMarkerRotation(activeTouchMarkerId);
    } else if (e.touches.length >= 2 && initialPinchDistance && initialPinchDistance > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDistance = Math.hypot(dx, dy);
      const ratio = currentDistance / initialPinchDistance;

      if (pinchMode === 'ar' && activeTouchMarkerId) {
        // ARオブジェクトのピンチ拡大・縮小（Scale のみ変更）
        const targetConfig = AR_MARKERS_CONFIG[activeTouchMarkerId];
        if (targetConfig) {
          targetConfig.state.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchStartScale * ratio));
          applyMarkerScale(activeTouchMarkerId);
        }
      } else if (pinchMode === 'camera') {
        // カメラ映像全体のピンチズーム（1.0x 〜 3.0x）
        const newZoom = pinchStartCameraZoom * ratio;
        setCameraZoom(newZoom, true);
      }
    }
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
      // 全ての指が離れた時にピンチ完了フラグをリセットし、次のジェスチャーを受け付け
      initialPinchDistance = null;
      pinchMode = null;
      activeTouchMarkerId = null;
      isPinchingActive = false;
    } else if (e.touches.length === 1 && isPinchingActive) {
      // 2本指ピンチから1本指が離れた瞬間は回転ドラッグへ誤遷移させず、ピンチモード終了のみ行う
      initialPinchDistance = null;
      pinchMode = null;
      activeTouchMarkerId = null;
    }
  }, { passive: true });

  window.addEventListener('touchcancel', () => {
    initialPinchDistance = null;
    pinchMode = null;
    activeTouchMarkerId = null;
    isPinchingActive = false;
  }, { passive: true });
}

/**
 * 画面回転・リサイズ時の適応処理
 */
function handleOrientationOrResize() {
  setAspectRatio(selectedRatio);
  syncTypographyCanvasSize();
  syncArCanvasAndVideo();
}

// メインボタン（リセット / 調整 / 使い方）のイベント管理
if (resetArBtn) {
  resetArBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSubmenu('reset');
  });
}

if (adjustBtn) {
  adjustBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSubmenu('adjust');
  });
}

if (helpBtn) {
  helpBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeSubmenu();
    openUsagePanel();
  });
}

// サブメニューパネル本体内でのクリック伝播防止
if (resetSubmenu) {
  resetSubmenu.addEventListener('click', (e) => e.stopPropagation());
}
if (adjustSubmenu) {
  adjustSubmenu.addEventListener('click', (e) => e.stopPropagation());
}

// リセット サブメニュー項目（各操作を実行してもメニューは維持）
if (resetArItem) {
  resetArItem.addEventListener('click', (e) => {
    e.stopPropagation();
    resetAllTransforms();
    showFeatureToast('ARオブジェクトを初期状態にリセットしました');
  });
}

if (resetTextItem) {
  resetTextItem.addEventListener('click', (e) => {
    e.stopPropagation();
    resetTypography();
    showFeatureToast('文字デザインをDefaultにリセットしました');
  });
}

// リセット サブメニューの「加工リセット」
if (resetAdjustItem) {
  resetAdjustItem.addEventListener('click', (e) => {
    e.stopPropagation();
    resetAdjustments();
    showFeatureToast('加工パラメータをリセットしました');
  });
}

// リセット サブメニューの「特殊加工リセット」
if (resetSpecialItem) {
  resetSpecialItem.addEventListener('click', (e) => {
    e.stopPropagation();
    resetSpecialEffects();
    showFeatureToast('特殊加工をリセットしました');
  });
}

// リセット サブメニューの「閉じる」ボタン（明示的閉鎖）
if (closeResetSubmenuBtn) {
  closeResetSubmenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSubmenu();
  });
}

// 調整 サブメニュー項目（撮影設定 / 加工 / 特殊加工 / 文字）
if (adjustCaptureSettingsItem) {
  adjustCaptureSettingsItem.addEventListener('click', (e) => {
    e.stopPropagation();
    openCaptureSettingsSheet();
  });
}

if (adjustCameraItem) {
  adjustCameraItem.addEventListener('click', (e) => {
    e.stopPropagation();
    openAdjustmentSheet();
  });
}

if (adjustSpecialItem) {
  adjustSpecialItem.addEventListener('click', (e) => {
    e.stopPropagation();
    openSpecialSheet();
  });
}

if (adjustTextItem) {
  adjustTextItem.addEventListener('click', (e) => {
    e.stopPropagation();
    openTypographySheet();
  });
}

// 調整 サブメニューの「閉じる」ボタン（明示的閉鎖）
if (closeAdjustSubmenuBtn) {
  closeAdjustSubmenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSubmenu();
  });
}

/**
 * ボトムシート（撮影設定・加工・特殊加工・文字）のドラッグ＆スワイプ閉鎖ジェスチャー設定
 * ・ハンドル部分のみを対象とし、スライダーやタブの横スクロールに干渉しない
 * ・一定距離（45px以上）ドラッグで確実に閉じる
 * ・タップ操作（クリック）と競合しない
 */
function setupBottomSheetSwipeToClose(sheetEl, handleEl, closeFn) {
  if (!sheetEl || !handleEl) return;

  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let pointerId = null;
  const SWIPE_CLOSE_THRESHOLD = 45; // 45px以上下へドラッグしたら閉じる

  handleEl.addEventListener('pointerdown', (e) => {
    if (!sheetEl.classList.contains('is-open')) return;
    // メインボタン以外のクリックやマルチタッチは無視
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    startY = e.clientY;
    currentY = e.clientY;
    isDragging = true;
    pointerId = e.pointerId;

    try {
      handleEl.setPointerCapture(e.pointerId);
    } catch (err) {
      // ignore
    }

    sheetEl.classList.add('is-dragging');
  });

  handleEl.addEventListener('pointermove', (e) => {
    if (!isDragging || e.pointerId !== pointerId) return;

    currentY = e.clientY;
    const deltaY = currentY - startY;

    // 下方向へのドラッグのみ追従（上方向へはわずかな抵抗）
    if (deltaY > 0) {
      sheetEl.style.transform = `translateY(${deltaY}px)`;
    } else {
      sheetEl.style.transform = `translateY(${deltaY * 0.2}px)`;
    }
  });

  function finishSwipe(e) {
    if (!isDragging) return;
    if (pointerId !== null && e.pointerId !== undefined && e.pointerId !== pointerId) return;

    isDragging = false;
    sheetEl.classList.remove('is-dragging');

    try {
      if (pointerId !== null) {
        handleEl.releasePointerCapture(pointerId);
      }
    } catch (err) {
      // ignore
    }
    pointerId = null;

    const deltaY = currentY - startY;

    if (deltaY >= SWIPE_CLOSE_THRESHOLD) {
      // しきい値を超えたら閉じる
      sheetEl.style.transform = '';
      closeFn();
    } else {
      // しきい値未満なら元の開いた位置へスプリングバック
      sheetEl.style.transform = '';
    }
  }

  handleEl.addEventListener('pointerup', finishSwipe);
  handleEl.addEventListener('pointercancel', finishSwipe);
}

// 撮影設定ボトムシートのスワイプ閉鎖有効化
setupBottomSheetSwipeToClose(captureSettingsSheet, captureSettingsDragHandleBtn, closeCaptureSettingsSheet);

// 加工ボトムシートのスワイプ閉鎖有効化
setupBottomSheetSwipeToClose(adjustmentSheet, sheetDragHandleBtn, closeAdjustmentSheet);

// 特殊加工ボトムシートのスワイプ閉鎖有効化
setupBottomSheetSwipeToClose(specialAdjustmentSheet, specialSheetDragHandleBtn, closeSpecialSheet);

// 文字編集ボトムシートのスワイプ閉鎖有効化
setupBottomSheetSwipeToClose(typographySheet, typographyDragHandleBtn, closeTypographySheet);

// 撮影設定ボトムシートの閉じる操作（ドラッグバー / 閉じるボタン）
if (closeCaptureSettingsSheetBtn) {
  closeCaptureSettingsSheetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeCaptureSettingsSheet();
  });
}

if (captureSettingsDragHandleBtn) {
  captureSettingsDragHandleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeCaptureSettingsSheet();
  });
}

// 撮影設定ボトムシート本体クリックでの伝播防止
if (captureSettingsSheet) {
  captureSettingsSheet.addEventListener('click', (e) => e.stopPropagation());
}

// タイマー選択ボタン（セグメントコントロール）
if (timerOptionButtons && timerOptionButtons.length > 0) {
  timerOptionButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const seconds = parseInt(btn.dataset.timer, 10) || 0;
      setTimerDuration(seconds);
    });
  });
}

// 構図グリッド選択ボタン（セグメントコントロール）
if (gridOptionButtons && gridOptionButtons.length > 0) {
  gridOptionButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const mode = btn.dataset.grid || 'off';
      setGridMode(mode);
    });
  });
}

// 使い方全画面オーバーレイの閉じる操作（画面下中央固定×ボタン）
if (usageCloseBtn) {
  usageCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeUsagePanel();
  });
}

// 加工ボトムシートの閉じる操作（ドラッグバー / 閉じるボタン）
if (closeAdjustmentSheetBtn) {
  closeAdjustmentSheetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAdjustmentSheet();
  });
}

// 加工パネル個別リセットボタン（現在の選択項目のみ初期値0へ戻す）
if (btnResetAdjustment) {
  btnResetAdjustment.addEventListener('click', (e) => {
    e.stopPropagation();
    resetSingleAdjustment();
  });
}

if (sheetDragHandleBtn) {
  sheetDragHandleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAdjustmentSheet();
  });
}

// 加工ボトムシート本体クリックでの伝播防止
if (adjustmentSheet) {
  adjustmentSheet.addEventListener('click', (e) => e.stopPropagation());
}

// 特殊加工ボトムシートの閉じる操作（ドラッグバー / 閉じるボタン / 未選択時閉じるボタン）
if (closeSpecialSheetBtn) {
  closeSpecialSheetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSpecialSheet();
  });
}

if (closeSpecialEmptyBtn) {
  closeSpecialEmptyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSpecialSheet();
  });
}

// 特殊加工パネル個別リセットボタン（現在選択中の特殊加工のみ0に戻す）
if (btnResetSpecialEmpty) {
  btnResetSpecialEmpty.addEventListener('click', (e) => {
    e.stopPropagation();
    resetSingleSpecialEffect();
  });
}

if (btnResetSpecialFx) {
  btnResetSpecialFx.addEventListener('click', (e) => {
    e.stopPropagation();
    resetSingleSpecialEffect();
  });
}

if (specialSheetDragHandleBtn) {
  specialSheetDragHandleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSpecialSheet();
  });
}

// 特殊加工ボトムシート本体クリックでの伝播防止
if (specialAdjustmentSheet) {
  specialAdjustmentSheet.addEventListener('click', (e) => e.stopPropagation());
}

// 特殊加工スライダー操作イベント（リアルタイム値更新 & プレビュー反映）
if (specialAdjustmentSlider) {
  specialAdjustmentSlider.addEventListener('input', (e) => {
    updateSpecialSlider(e.target.value);
  });
}

// 特殊加工タブ切り替え
if (specialTabButtons && specialTabButtons.length > 0) {
  specialTabButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const specialId = btn.dataset.special;
      if (specialId) {
        selectSpecialItem(specialId);
      }
    });
  });
}

// 文字編集ボトムシートの閉じる操作（ドラッグバー / 閉じるボタン）
if (closeTypographySheetBtn) {
  closeTypographySheetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeTypographySheet();
  });
}

// 文字パネル個別リセットボタン（現在開いているサブタブ項目のみ初期値に戻す）
if (btnResetTypography) {
  btnResetTypography.addEventListener('click', (e) => {
    e.stopPropagation();
    resetTypographySingleTab();
  });
}

if (typographyDragHandleBtn) {
  typographyDragHandleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeTypographySheet();
  });
}

// 文字編集ボトムシート本体クリックでの伝播防止
if (typographySheet) {
  typographySheet.addEventListener('click', (e) => e.stopPropagation());
}

// 文字設定サブタブ（文字なし / 字体 / 大きさ / 色 / 配置）
if (typeTabNone) {
  typeTabNone.addEventListener('click', (e) => {
    e.stopPropagation();
    setTypographyNone();
  });
}

if (typeTabFont) {
  typeTabFont.addEventListener('click', (e) => {
    e.stopPropagation();
    switchTypographySubtab('font');
  });
}

if (typeTabSize) {
  typeTabSize.addEventListener('click', (e) => {
    e.stopPropagation();
    switchTypographySubtab('size');
  });
}

if (typeTabColor) {
  typeTabColor.addEventListener('click', (e) => {
    e.stopPropagation();
    switchTypographySubtab('color');
  });
}

if (typeTabAlign) {
  typeTabAlign.addEventListener('click', (e) => {
    e.stopPropagation();
    switchTypographySubtab('align');
  });
}

// 文字サイズスライダー操作イベント（リアルタイム値更新 & Typography反映）
if (typographySizeSlider) {
  typographySizeSlider.addEventListener('input', (e) => {
    const percentVal = parseInt(e.target.value, 10);
    currentTypographyScale = percentVal / 100.0;
    if (typographyCurrentFontName && currentTypographySubtab === 'size') {
      typographyCurrentFontName.textContent = `${percentVal}%`;
    }
    updateRealtimeClock();
  });
}

// スライダー操作イベント（リアルタイム値更新 & プレビュー反映）
if (adjustmentSlider) {
  adjustmentSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    adjustmentValues[currentSelectedAdjustment] = val;

    const config = ADJUSTMENT_CONFIGS_MAP[currentSelectedAdjustment] || ADJUSTMENT_CONFIGS[0];
    if (config && sheetCurrentItemVal) {
      sheetCurrentItemVal.textContent = config.format(val);
    }

    applyAdjustmentsToPreview();
  });
}

// 項目タブ（露出・コントラスト・彩度・ハイライト・シャドウ・色温度・色合い・シャープ・フェード・ビネット）切り替え
const allSheetTabButtons = document.querySelectorAll('.sheet-tab-btn');
allSheetTabButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const adjustId = btn.dataset.adjust;
    if (adjustId) {
      selectAdjustmentItem(adjustId);
    }
  });
});

// 比率選択ボタン（比率を切り替えてもメニューは維持）
ratioOptionButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const ratio = btn.dataset.ratio;
    if (ratio) {
      setAspectRatio(ratio);
    }
  });
});

// タイマー選択ボタン（タイマーを切り替えてもメニューは維持）
if (timerOptionButtons && timerOptionButtons.length > 0) {
  timerOptionButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sec = parseInt(btn.dataset.timer, 10) || 0;
      setTimerDuration(sec);
    });
  });
}

// 各種操作ボタンのイベントリスナー（1ボタン 1リスナー）
shutterBtn.addEventListener('pointerdown', () => {
  // ユーザーのタップ/クリック開始と同時にAudioContextを即座にアンロック・再開
  initOrResumeAudioContext();
});
shutterBtn.addEventListener('click', handleShutterTrigger);

switchCameraBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  cancelCountdown();
  closeSubmenu();
  toggleCamera();
});

retakeBtn.addEventListener('click', () => {
  cancelCountdown();
  retakePhoto();
});
if (shareBtn) shareBtn.addEventListener('click', sharePhoto);
saveBtn.addEventListener('click', savePhoto);
retryCameraBtn.addEventListener('click', () => {
  cancelCountdown();
  const v = getActiveVideo();
  if (v) {
    switchCameraFacingMode();
  } else {
    window.location.reload();
  }
});

/**
 * 画面回転 & リサイズ検知イベント処理（デバイスの解像度確定待機と多段階同期）
 */
function handleOrientationOrResize() {
  syncArCanvasAndVideo();
  syncTypographyCanvasSize();
  if (activeSubmenu) {
    updateSubmenuPositionLandscape();
  }

  // 画面回転時、OSやブラウザによるvideo要素のvideoWidth/videoHeight更新タイミングのズレを吸収
  requestAnimationFrame(() => {
    syncArCanvasAndVideo();
  });
}

// 画面回転 & リサイズ検知イベント
window.addEventListener('resize', handleOrientationOrResize);
window.addEventListener('orientationchange', () => {
  handleOrientationOrResize();
  setTimeout(handleOrientationOrResize, 150);
  setTimeout(handleOrientationOrResize, 350);
});
if (window.screen && window.screen.orientation) {
  window.screen.orientation.addEventListener('change', () => {
    handleOrientationOrResize();
    setTimeout(handleOrientationOrResize, 150);
    setTimeout(handleOrientationOrResize, 350);
  });
}

// ページ読み込み時に初期比率適用 & カメラ監視開始 & ARオブジェクト操作初期化 & オーディオアンロック設定 & 自動水平検知リスナー開始
window.addEventListener('DOMContentLoaded', () => {
  setupAudioUnlock();
  setupOrientationUnlock();
  startOrientationListener();
  setAspectRatio('3:4');
  setTimerDuration(0); // タイマー初期値: OFF
  setGridMode('off'); // グリッド初期値: OFF
  startClock();
  hookSceneResizeHandler();
  initCameraHandling();
  initArObjectInteraction();
  updateColorChipsUI();
  updateAnchorButtonsUI();

  // フォント読み込み完了時にCanvasとプレビューカードを再描画
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      updateRealtimeClock();
      updateFontCardsUI();
    });
  }
});

// ページ離脱・タブ切り替え時の管理
window.addEventListener('beforeunload', () => {
  cancelCountdown();
  stopClock();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelCountdown();
    stopClock();
  } else if (reviewControls.classList.contains('hidden')) {
    startClock();
  }
});
